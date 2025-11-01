# workflow_engine

import asyncio
import uuid
from collections import defaultdict
from datetime import datetime
from jinja2 import Template
from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Set

from schema import (
	AppConfig,
)
from workflow_schema import (
	WorkflowConfig, WorkflowNodeConfig, WorkflowEdgeConfig,
	WorkflowNodeType, WorkflowNodeStatus,
	AgentNodeConfig, PromptNodeConfig, TransformNodeConfig,
	ToolNodeConfig, UserInputNodeConfig, DecisionNodeConfig,
	MergeNodeConfig, ParallelNodeConfig, LoopNodeConfig,
)
from event_bus import (
	EventBus, EventType, get_event_bus,
)

class WorkflowExecutionState(BaseModel):
	workflow_id: str
	execution_id: str
	status: WorkflowNodeStatus
	current_nodes: List[int] = []  # Indices of currently executing nodes
	completed_nodes: List[int] = []  # Indices of completed nodes
	failed_nodes: List[int] = []  # Indices of failed nodes
	node_states: Dict[int, Any] = {}  # Index -> state mapping
	context: Dict[str, Any] = {}  # Global workflow context
	start_time: Optional[str] = None
	end_time: Optional[str] = None
	error: Optional[str] = None


class NodeExecutionResult:
	"""Result of a node execution"""
	def __init__(self, node_index: int, success: bool, output: Any = None, error: str = None):
		self.node_index = node_index
		self.success = success
		self.output = output
		self.error = error


class WorkflowExecutionContext:
	"""Context for workflow execution with frontier-based tracking"""
	
	def __init__(self, workflow: WorkflowConfig, execution_id: str):
		self.workflow = workflow
		self.execution_id = execution_id
		self.workflow_id = workflow.info.name if workflow.info else "unnamed_workflow"
		
		# Global variables
		self.variables: Dict[str, Any] = workflow.variables or {}
		
		# Node-specific outputs (index -> output)
		self.node_outputs: Dict[int, Any] = {}
		
		# Node execution tracking
		self.pending_nodes: Set[int] = set()  # Not yet ready
		self.ready_nodes: Set[int] = set()  # Ready to execute
		self.running_nodes: Set[int] = set()  # Currently executing
		self.completed_nodes: Set[int] = set()  # Completed successfully
		self.failed_nodes: Set[int] = set()  # Failed
		
		# Dependency tracking
		self.node_dependencies: Dict[int, Set[int]] = defaultdict(set)  # node -> set of nodes it depends on
		self.node_dependents: Dict[int, Set[int]] = defaultdict(set)  # node -> set of nodes that depend on it
		
		# Edge tracking (for condition evaluation)
		self.edges_by_source: Dict[int, List[WorkflowEdgeConfig]] = defaultdict(list)
		self.edges_by_target: Dict[int, List[WorkflowEdgeConfig]] = defaultdict(list)
		
		# Special handling
		self.merge_waiting: Dict[int, Set[int]] = {}  # merge node -> set of incomplete dependencies
		self.parallel_branches: Dict[int, Set[int]] = {}  # parallel node -> set of running branches
		self.loop_iterations: Dict[int, int] = defaultdict(int)  # loop node -> iteration count
		
		# User input handling
		self.pending_user_inputs: Dict[int, asyncio.Future] = {}
		
		# Build dependency graph
		self._build_dependency_graph()
		
	def _build_dependency_graph(self):
		"""Build the dependency graph from edges"""
		# Index edges by source and target
		for edge in self.workflow.edges:
			self.edges_by_source[edge.source].append(edge)
			self.edges_by_target[edge.target].append(edge)
			
			# Add dependency: target depends on source
			self.node_dependencies[edge.target].add(edge.source)
			self.node_dependents[edge.source].add(edge.target)
		
		# Find start nodes (nodes with no dependencies)
		for i in range(len(self.workflow.nodes)):
			if i not in self.node_dependencies or len(self.node_dependencies[i]) == 0:
				self.ready_nodes.add(i)
			else:
				self.pending_nodes.add(i)
		
		# Initialize merge nodes
		for i, node in enumerate(self.workflow.nodes):
			if node.type == WorkflowNodeType.MERGE:
				incoming = self.edges_by_target.get(i, [])
				if hasattr(node, 'wait_for') and node.wait_for:
					self.merge_waiting[i] = set(node.wait_for)
				else:
					# Wait for all incoming edges
					self.merge_waiting[i] = set(edge.source for edge in incoming)
	
	def mark_node_running(self, node_index: int):
		"""Mark a node as currently running"""
		self.ready_nodes.discard(node_index)
		self.running_nodes.add(node_index)
	
	def mark_node_completed(self, node_index: int, output: Any):
		"""Mark a node as completed and update frontier"""
		self.running_nodes.discard(node_index)
		self.completed_nodes.add(node_index)
		self.node_outputs[node_index] = output
		
		# Check if any dependent nodes are now ready
		for dependent_idx in self.node_dependents.get(node_index, []):
			if self._is_node_ready(dependent_idx):
				self.pending_nodes.discard(dependent_idx)
				self.ready_nodes.add(dependent_idx)
	
	def mark_node_failed(self, node_index: int, error: str):
		"""Mark a node as failed"""
		self.running_nodes.discard(node_index)
		self.failed_nodes.add(node_index)
	
	def _is_node_ready(self, node_index: int) -> bool:
		"""Check if a node is ready to execute (all dependencies completed)"""
		if node_index in self.completed_nodes or node_index in self.failed_nodes:
			return False
		
		# Check if all dependencies are completed
		dependencies = self.node_dependencies.get(node_index, set())
		return dependencies.issubset(self.completed_nodes)
	
	def has_work(self) -> bool:
		"""Check if there's still work to do"""
		return len(self.ready_nodes) > 0 or len(self.running_nodes) > 0
	
	def is_complete(self) -> bool:
		"""Check if workflow is complete"""
		total_nodes = len(self.workflow.nodes)
		processed_nodes = len(self.completed_nodes) + len(self.failed_nodes)
		return processed_nodes >= total_nodes or not self.has_work()
	
	def get_ready_nodes(self) -> List[int]:
		"""Get list of ready node indices"""
		return list(self.ready_nodes)


class NodeExecutor:
	"""Base class for node executors"""
	
	def __init__(self, app_config: AppConfig, event_bus: EventBus):
		self.app_config = app_config
		self.event_bus = event_bus
	
	async def execute(self, node_index: int, node: WorkflowNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		"""Execute a node and return result"""
		raise NotImplementedError()
	
	def apply_mapping(self, mapping: Optional[Dict[str, str]], 
					data: Dict[str, Any], 
					context: WorkflowExecutionContext) -> Dict[str, Any]:
		"""Apply input/output mapping"""
		if not mapping:
			return data
		
		result = {}
		for target_key, source_path in mapping.items():
			# Support dot notation and node output references
			value = self._resolve_path(source_path, data, context)
			result[target_key] = value
		return result
	
	def _resolve_path(self, path: str, data: Dict[str, Any], 
					context: WorkflowExecutionContext) -> Any:
		"""Resolve a path like 'node[0].output.field' or 'variables.x'"""
		parts = path.split('.')
		
		# Check for node reference: node[index] or $index
		if parts[0].startswith('node[') and parts[0].endswith(']'):
			node_idx = int(parts[0][5:-1])
			value = context.node_outputs.get(node_idx, {})
			parts = parts[1:]
		elif parts[0].startswith('$'):
			node_idx = int(parts[0][1:])
			value = context.node_outputs.get(node_idx, {})
			parts = parts[1:]
		elif parts[0] == 'variables':
			value = context.variables
			parts = parts[1:]
		else:
			value = data
		
		# Navigate the path
		for part in parts:
			if isinstance(value, dict):
				value = value.get(part)
			else:
				break
		
		return value


class StartNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: WorkflowNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Initialize variables from start node data
		if hasattr(node, 'initial_data') and node.initial_data:
			context.variables.update(node.initial_data)
		
		output = {"status": "started", "variables": context.variables}
		return NodeExecutionResult(node_index, True, output)


class EndNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: WorkflowNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Collect final output
		if hasattr(node, 'output_mapping') and node.output_mapping:
			output = self.apply_mapping(node.output_mapping, context.variables, context)
		else:
			output = context.variables
		
		return NodeExecutionResult(node_index, True, {"status": "completed", "output": output})


class DecisionNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: DecisionNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Get condition value
		value = context.variables.get(node.condition_field)
		
		# Find matching branch
		matched_branch = None
		for branch_name, target_idx in node.branches.items():
			if value == branch_name:
				matched_branch = target_idx
				break
		
		# Only mark the matching branch's target as ready
		if matched_branch is not None:
			# Remove other branches from pending
			for target_idx in node.branches.values():
				if target_idx != matched_branch:
					context.pending_nodes.discard(target_idx)
			
			# Mark matched branch as ready
			if matched_branch in context.pending_nodes:
				context.pending_nodes.discard(matched_branch)
				context.ready_nodes.add(matched_branch)
		
		output = {
			"branch": matched_branch,
			"value": value,
			"branches": node.branches
		}
		return NodeExecutionResult(node_index, True, output)


class MergeNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: MergeNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		"""
		Merge node waits for multiple inputs and combines them.
		Strategy:
		- 'first': Return first completed input
		- 'last': Return last completed input
		- 'all': Return all inputs as a list
		"""
		# Get all incoming node outputs
		incoming_nodes = context.merge_waiting.get(node_index, set())
		incoming_outputs = []
		
		for dep_idx in incoming_nodes:
			if dep_idx in context.node_outputs:
				incoming_outputs.append(context.node_outputs[dep_idx])
		
		# Apply merge strategy
		if node.strategy == "first":
			output = incoming_outputs[0] if incoming_outputs else None
		elif node.strategy == "last":
			output = incoming_outputs[-1] if incoming_outputs else None
		else:  # all
			output = incoming_outputs
		
		return NodeExecutionResult(node_index, True, {"merged": output, "count": len(incoming_outputs)})


class ParallelNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: ParallelNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		"""
		Parallel node triggers multiple branches to execute concurrently.
		The branches are already in the dependency graph, so we just mark them as ready.
		"""
		# Mark all branch target nodes as ready
		if node.branches:
			for branch_idx in node.branches:
				if branch_idx in context.pending_nodes:
					context.pending_nodes.discard(branch_idx)
					context.ready_nodes.add(branch_idx)
			
			# Track branches for this parallel node
			context.parallel_branches[node_index] = set(node.branches)
		
		output = {
			"status": "parallel_started",
			"branches": node.branches,
			"max_concurrent": node.max_concurrent
		}
		return NodeExecutionResult(node_index, True, output)


class LoopNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: LoopNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		"""
		Loop node executes a body node multiple times.
		"""
		current_iteration = context.loop_iterations[node_index]
		context.loop_iterations[node_index] += 1
		
		# Check if we should continue
		should_continue = current_iteration < node.max_iterations
		
		# Check break condition
		if should_continue and node.break_on:
			break_value = context.variables.get(node.break_on)
			if break_value:
				should_continue = False
		
		# Check custom condition
		if should_continue and node.condition_field:
			value = context.variables.get(node.condition_field)
			should_continue = (value != node.condition_value)
		
		# If continuing, mark body as ready
		if should_continue and node.body is not None:
			if node.body in context.pending_nodes:
				context.pending_nodes.discard(node.body)
				context.ready_nodes.add(node.body)
		
		output = {
			"iteration": current_iteration,
			"should_continue": should_continue,
			"max_iterations": node.max_iterations
		}
		return NodeExecutionResult(node_index, True, output)


class AgentNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: AgentNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Prepare input
		input_data = context.variables.copy()
		if node.input_mapping:
			input_data = self.apply_mapping(node.input_mapping, input_data, context)
		
		# TODO: Execute agent (placeholder)
		output = {
			"agent_index": node.agent,
			"input": input_data,
			"response": f"Agent {node.agent} execution placeholder"
		}
		
		# Apply output mapping
		if node.output_mapping:
			mapped_output = self.apply_mapping(node.output_mapping, output, context)
			context.variables.update(mapped_output)
		else:
			context.variables["agent_output"] = output
		
		return NodeExecutionResult(node_index, True, output)


class PromptNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: PromptNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Get prompt config
		if node.prompt >= len(self.app_config.prompts):
			return NodeExecutionResult(node_index, False, error=f"Invalid prompt index: {node.prompt}")
		
		prompt_config = self.app_config.prompts[node.prompt]
		
		# Prepare input
		input_data = context.variables.copy()
		if node.input_mapping:
			input_data = self.apply_mapping(node.input_mapping, input_data, context)
		
		# Render prompt
		instructions = prompt_config.instructions or []
		rendered_prompt = "\n".join(instructions)
		
		# Replace variables
		for key, value in input_data.items():
			rendered_prompt = rendered_prompt.replace(f"{{{{{key}}}}}", str(value))
		
		# TODO: Execute with model (placeholder)
		output = {
			"prompt": rendered_prompt,
			"response": f"Prompt execution placeholder"
		}
		
		# Apply output mapping
		if node.output_mapping:
			mapped_output = self.apply_mapping(node.output_mapping, output, context)
			context.variables.update(mapped_output)
		else:
			context.variables["prompt_output"] = output
		
		return NodeExecutionResult(node_index, True, output)


class TransformNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: TransformNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Prepare input
		input_data = context.variables.copy()
		if node.input_mapping:
			input_data = self.apply_mapping(node.input_mapping, input_data, context)
		
		output = None
		
		try:
			if node.transform_type == "python":
				# Execute Python transform
				local_vars = {"input": input_data, "output": None, "context": context}
				exec(node.transform_script, {}, local_vars)
				output = local_vars.get("output", input_data)
			elif node.transform_type == "jinja2":
				# Render Jinja2 template
				template = Template(node.transform_script)
				output = template.render(**input_data)
			else:
				# Default: pass through
				output = input_data
		except Exception as e:
			return NodeExecutionResult(node_index, False, error=str(e))
		
		# Apply output mapping
		if node.output_mapping:
			mapped_output = self.apply_mapping(node.output_mapping, {"result": output}, context)
			context.variables.update(mapped_output)
		else:
			context.variables["transform_output"] = output
		
		return NodeExecutionResult(node_index, True, output)


class ToolNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: ToolNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Prepare input
		input_data = context.variables.copy()
		if node.input_mapping:
			input_data = self.apply_mapping(node.input_mapping, input_data, context)
		
		# TODO: Execute tool (placeholder)
		output = {
			"tool_index": node.tool,
			"input": input_data,
			"result": f"Tool {node.tool} execution placeholder"
		}
		
		# Apply output mapping
		if node.output_mapping:
			mapped_output = self.apply_mapping(node.output_mapping, output, context)
			context.variables.update(mapped_output)
		else:
			context.variables["tool_output"] = output
		
		return NodeExecutionResult(node_index, True, output)


class UserInputNodeExecutor(NodeExecutor):
	async def execute(self, node_index: int, node: UserInputNodeConfig, 
					context: WorkflowExecutionContext) -> NodeExecutionResult:
		# Create future for user input
		future = asyncio.Future()
		context.pending_user_inputs[node_index] = future
		
		# Emit event requesting user input
		await self.event_bus.emit(
			event_type=EventType.USER_INPUT_REQUESTED,
			workflow_id=context.workflow_id,
			execution_id=context.execution_id,
			node_id=str(node_index),
			data={
				"prompt": node.prompt_text,
				"schema": node.input_schema
			}
		)
		
		# Wait for input (with timeout)
		timeout = node.timeout or 300
		try:
			user_input = await asyncio.wait_for(future, timeout=timeout)
			return NodeExecutionResult(node_index, True, {"user_input": user_input})
		except asyncio.TimeoutError:
			return NodeExecutionResult(node_index, False, 
									error=f"User input timeout after {timeout} seconds")


class WorkflowEngine:
	"""Frontier-based workflow execution engine"""
	
	def __init__(self, app_config: AppConfig, event_bus: Optional[EventBus] = None):
		self.app_config = app_config
		self.event_bus = event_bus or get_event_bus()
		self.executions: Dict[str, WorkflowExecutionState] = {}
		self.contexts: Dict[str, WorkflowExecutionContext] = {}
		self.execution_tasks: Dict[str, asyncio.Task] = {}
		self.workflow_manager = None
		
		# Register node executors
		self.executors = {
			WorkflowNodeType.START: StartNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.END: EndNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.DECISION: DecisionNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.MERGE: MergeNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.PARALLEL: ParallelNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.LOOP: LoopNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.AGENT: AgentNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.PROMPT: PromptNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.TRANSFORM: TransformNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.TOOL: ToolNodeExecutor(app_config, self.event_bus),
			WorkflowNodeType.USER_INPUT: UserInputNodeExecutor(app_config, self.event_bus),
		}

	def set_workflow_manager(self, workflow_manager):
		"""Set the workflow manager for accessing workflow definitions"""
		self.workflow_manager = workflow_manager
	
	async def start_workflow_by_name(self, workflow_name: str, 
	                                  initial_data = None):
		"""Start a workflow by name from the workflow manager"""
		if not self.workflow_manager:
			raise ValueError("Workflow manager not set")
		
		workflow = self.workflow_manager.get_workflow(workflow_name)
		if not workflow:
			raise ValueError(f"Workflow not found: {workflow_name}")
		
		return await self.start_workflow(workflow, initial_data)

	async def start_workflow(self, workflow: WorkflowConfig, 
							initial_data: Optional[Dict[str, Any]] = None) -> str:
		"""Start workflow execution"""
		execution_id = str(uuid.uuid4())
		
		# Create execution context
		context = WorkflowExecutionContext(workflow, execution_id)
		if initial_data:
			context.variables.update(initial_data)
		
		# Create execution state
		state = WorkflowExecutionState(
			workflow_id=context.workflow_id,
			execution_id=execution_id,
			status=WorkflowNodeStatus.RUNNING,
			start_time=datetime.now().isoformat(),
			context=initial_data or {}
		)
		
		self.executions[execution_id] = state
		self.contexts[execution_id] = context
		
		# Emit started event
		await self.event_bus.emit(
			event_type=EventType.WORKFLOW_STARTED,
			workflow_id=context.workflow_id,
			execution_id=execution_id,
			data={"initial_data": initial_data}
		)
		
		# Start execution task
		task = asyncio.create_task(self._execute_workflow(context, state))
		self.execution_tasks[execution_id] = task
		
		return execution_id
	
	async def _execute_workflow(self, context: WorkflowExecutionContext, 
								state: WorkflowExecutionState):
		"""Execute workflow using frontier-based approach"""
		try:
			# Main execution loop
			while context.has_work() and not context.is_complete():
				# Get ready nodes
				ready_nodes = context.get_ready_nodes()
				
				if not ready_nodes:
					# No ready nodes, but work remains - wait a bit
					if context.running_nodes:
						await asyncio.sleep(0.1)
						continue
					else:
						# Deadlock - no ready nodes and no running nodes
						raise Exception("Workflow deadlock detected - no nodes can execute")
				
				# Execute ready nodes (potentially in parallel)
				tasks = []
				for node_idx in ready_nodes:
					context.mark_node_running(node_idx)
					state.current_nodes.append(node_idx)
					task = asyncio.create_task(self._execute_node(node_idx, context, state))
					tasks.append(task)
				
				# Wait for at least one node to complete
				if tasks:
					done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
					
					# Process completed nodes
					for task in done:
						try:
							result = await task
							if result.success:
								context.mark_node_completed(result.node_index, result.output)
								state.completed_nodes.append(result.node_index)
							else:
								context.mark_node_failed(result.node_index, result.error)
								state.failed_nodes.append(result.node_index)
								# Decide whether to continue or abort on failure
								# For now, we'll continue with other branches
							
							if result.node_index in state.current_nodes:
								state.current_nodes.remove(result.node_index)
						except Exception as e:
							print(f"Error processing node result: {e}")
			
			# Check final status
			if context.failed_nodes:
				state.status = WorkflowNodeStatus.FAILED
				state.error = f"Workflow completed with {len(context.failed_nodes)} failed nodes"
			else:
				state.status = WorkflowNodeStatus.COMPLETED
			
			state.end_time = datetime.now().isoformat()
			
			await self.event_bus.emit(
				event_type=EventType.WORKFLOW_COMPLETED,
				workflow_id=context.workflow_id,
				execution_id=context.execution_id,
				data={"output": context.variables}
			)
			
		except Exception as e:
			state.status = WorkflowNodeStatus.FAILED
			state.error = str(e)
			state.end_time = datetime.now().isoformat()
			
			await self.event_bus.emit(
				event_type=EventType.WORKFLOW_FAILED,
				workflow_id=context.workflow_id,
				execution_id=context.execution_id,
				error=str(e)
			)
	
	async def _execute_node(self, node_index: int, context: WorkflowExecutionContext, 
						state: WorkflowExecutionState) -> NodeExecutionResult:
		"""Execute a single node"""
		node = context.workflow.nodes[node_index]
		
		# Update state
		state.node_states[node_index] = {"status": WorkflowNodeStatus.RUNNING}
		
		await self.event_bus.emit(
			event_type=EventType.NODE_STARTED,
			workflow_id=context.workflow_id,
			execution_id=context.execution_id,
			node_id=str(node_index),
			data={"node_type": node.type, "node_label": node.label}
		)
		
		try:
			# Get executor
			executor = self.executors.get(node.type)
			if not executor:
				raise ValueError(f"No executor for node type: {node.type}")
			
			# Execute node
			result = await executor.execute(node_index, node, context)
			
			# Update state
			if result.success:
				state.node_states[node_index] = {
					"status": WorkflowNodeStatus.COMPLETED,
					"output": result.output
				}
				
				await self.event_bus.emit(
					event_type=EventType.NODE_COMPLETED,
					workflow_id=context.workflow_id,
					execution_id=context.execution_id,
					node_id=str(node_index),
					data={"output": result.output}
				)
			else:
				state.node_states[node_index] = {
					"status": WorkflowNodeStatus.FAILED,
					"error": result.error
				}
				
				await self.event_bus.emit(
					event_type=EventType.NODE_FAILED,
					workflow_id=context.workflow_id,
					execution_id=context.execution_id,
					node_id=str(node_index),
					error=result.error
				)
			
			return result
			
		except Exception as e:
			state.node_states[node_index] = {
				"status": WorkflowNodeStatus.FAILED,
				"error": str(e)
			}
			
			await self.event_bus.emit(
				event_type=EventType.NODE_FAILED,
				workflow_id=context.workflow_id,
				execution_id=context.execution_id,
				node_id=str(node_index),
				error=str(e)
			)
			
			return NodeExecutionResult(node_index, False, error=str(e))
	
	async def provide_user_input(self, execution_id: str, node_id: str, user_input: Any):
		"""Provide user input for waiting node"""
		context = self.contexts.get(execution_id)
		if not context:
			raise ValueError(f"Execution not found: {execution_id}")
		
		node_index = int(node_id)
		future = context.pending_user_inputs.get(node_index)
		if not future:
			raise ValueError(f"No pending input for node: {node_id}")
		
		future.set_result(user_input)
		
		await self.event_bus.emit(
			event_type=EventType.USER_INPUT_RECEIVED,
			workflow_id=context.workflow_id,
			execution_id=execution_id,
			node_id=node_id,
			data={"input": user_input}
		)
	
	def get_execution_state(self, execution_id: str) -> Optional[WorkflowExecutionState]:
		"""Get execution state"""
		return self.executions.get(execution_id)
	
	def list_executions(self) -> List[WorkflowExecutionState]:
		"""List all executions"""
		return list(self.executions.values())
	
	async def cancel_execution(self, execution_id: str):
		"""Cancel workflow execution"""
		if execution_id in self.execution_tasks:
			task = self.execution_tasks[execution_id]
			task.cancel()
			
			state = self.executions.get(execution_id)
			if state:
				state.status = WorkflowNodeStatus.FAILED
				state.error = "Cancelled by user"
				state.end_time = datetime.now().isoformat()
				
				context = self.contexts.get(execution_id)
				if context:
					await self.event_bus.emit(
						event_type=EventType.WORKFLOW_CANCELLED,
						workflow_id=context.workflow_id,
						execution_id=execution_id
					)
