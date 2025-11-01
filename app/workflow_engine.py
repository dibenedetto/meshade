# workflow_engine

import asyncio
import uuid


from   datetime import datetime
from   jinja2   import Template
from   pydantic import BaseModel
from   typing   import Any, Dict, List, Optional


from   schema   import (
    WorkflowConfig, WorkflowNodeConfig, WorkflowEdgeConfig,
    WorkflowNodeType, WorkflowNodeStatus,
    AgentNodeConfig, PromptNodeConfig, TransformNodeConfig,
    ToolNodeConfig, UserInputNodeConfig, DecisionNodeConfig,
    MergeNodeConfig, ParallelNodeConfig, LoopNodeConfig,
    AppConfig
)
from event_bus  import EventBus, EventType, get_event_bus


class WorkflowExecutionState(BaseModel):
    workflow_id: str
    execution_id: str
    status: WorkflowNodeStatus
    current_nodes: List[str] = []
    completed_nodes: List[str] = []
    failed_nodes: List[str] = []
    node_states: Dict[str, Any] = {}
    context: Dict[str, Any] = {}
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    error: Optional[str] = None


class WorkflowExecutionContext:
    """Context for workflow execution"""
    
    def __init__(self, workflow_id: str, execution_id: str):
        self.workflow_id = workflow_id
        self.execution_id = execution_id
        self.variables: Dict[str, Any] = {}
        self.node_outputs: Dict[str, Any] = {}
        self.iteration_counts: Dict[str, int] = {}
        self.pending_user_inputs: Dict[str, asyncio.Future] = {}
        
    def set_variable(self, name: str, value: Any):
        self.variables[name] = value
        
    def get_variable(self, name: str, default: Any = None) -> Any:
        return self.variables.get(name, default)
        
    def set_node_output(self, node_id: str, output: Any):
        self.node_outputs[node_id] = output
        
    def get_node_output(self, node_id: str) -> Any:
        return self.node_outputs.get(node_id)
        
    def apply_mapping(self, mapping: Optional[Dict[str, str]], data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply input/output mapping"""
        if not mapping:
            return data
            
        result = {}
        for target_key, source_path in mapping.items():
            # Support dot notation: "node1.output.field"
            value = data
            for part in source_path.split('.'):
                if isinstance(value, dict):
                    value = value.get(part)
                else:
                    break
            result[target_key] = value
        return result


class NodeExecutor:
    """Base class for node executors"""
    
    def __init__(self, app_config: AppConfig, event_bus: EventBus):
        self.app_config = app_config
        self.event_bus = event_bus
        
    async def execute(self, node: WorkflowNodeConfig, context: WorkflowExecutionContext) -> Any:
        raise NotImplementedError()


class StartNodeExecutor(NodeExecutor):
    async def execute(self, node: WorkflowNodeConfig, context: WorkflowExecutionContext) -> Any:
        if node.data and isinstance(node.data, dict):
            context.variables.update(node.data)
        return {"status": "started", "data": node.data}


class EndNodeExecutor(NodeExecutor):
    async def execute(self, node: WorkflowNodeConfig, context: WorkflowExecutionContext) -> Any:
        output = {}
        if hasattr(node, 'output_mapping') and node.output_mapping:
            output = context.apply_mapping(node.output_mapping, context.variables)
        else:
            output = context.variables
        return {"status": "completed", "output": output}


class DecisionNodeExecutor(NodeExecutor):
    async def execute(self, node: DecisionNodeConfig, context: WorkflowExecutionContext) -> Any:
        value = context.get_variable(node.condition_field)
        
        # Find matching branch
        matched_branch = None
        for branch_name, branch_value in node.branches.items():
            if value == branch_value:
                matched_branch = branch_name
                break
                
        return {
            "branch": matched_branch,
            "value": value,
            "branches": node.branches
        }


class MergeNodeExecutor(NodeExecutor):
    async def execute(self, node: MergeNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Merge strategy handled at workflow level
        return {"status": "merged"}


class ParallelNodeExecutor(NodeExecutor):
    async def execute(self, node: ParallelNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Parallel execution handled at workflow level
        return {"status": "parallel_started"}


class LoopNodeExecutor(NodeExecutor):
    async def execute(self, node: LoopNodeConfig, context: WorkflowExecutionContext) -> Any:
        current_iteration = context.iteration_counts.get(node.id, 0)
        context.iteration_counts[node.id] = current_iteration + 1
        
        should_continue = current_iteration < node.max_iterations
        
        if node.condition_field:
            value = context.get_variable(node.condition_field)
            should_continue = should_continue and (value != node.condition_value)
            
        return {
            "iteration": current_iteration,
            "should_continue": should_continue,
            "max_iterations": node.max_iterations
        }


class AgentNodeExecutor(NodeExecutor):
    async def execute(self, node: AgentNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Get agent from config
        if node.agent >= len(self.app_config.agents):
            raise ValueError(f"Agent index {node.agent} out of range")
            
        # Prepare input
        input_data = context.variables
        if node.input_mapping:
            input_data = context.apply_mapping(node.input_mapping, context.variables)
            
        # TODO: Execute agent (needs implementation based on agent type)
        # For now, return placeholder
        output = {
            "agent_index": node.agent,
            "input": input_data,
            "response": "Agent execution placeholder"
        }
        
        # Apply output mapping
        if node.output_mapping:
            mapped_output = context.apply_mapping(node.output_mapping, output)
            context.variables.update(mapped_output)
        else:
            context.variables["agent_output"] = output
            
        return output


class PromptNodeExecutor(NodeExecutor):
    async def execute(self, node: PromptNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Get prompt from config
        if node.prompt >= len(self.app_config.prompts):
            raise ValueError(f"Prompt index {node.prompt} out of range")
            
        prompt_config = self.app_config.prompts[node.prompt]
        
        # Prepare input
        input_data = context.variables
        if node.input_mapping:
            input_data = context.apply_mapping(node.input_mapping, context.variables)
            
        # Render prompt with context
        instructions = prompt_config.instructions or []
        rendered_prompt = "\n".join(instructions)
        
        # Replace variables in prompt
        for key, value in input_data.items():
            rendered_prompt = rendered_prompt.replace(f"{{{{{key}}}}}", str(value))
            
        # TODO: Execute prompt with model
        output = {
            "prompt": rendered_prompt,
            "response": "Prompt execution placeholder"
        }
        
        # Apply output mapping
        if node.output_mapping:
            mapped_output = context.apply_mapping(node.output_mapping, output)
            context.variables.update(mapped_output)
        else:
            context.variables["prompt_output"] = output
            
        return output


class TransformNodeExecutor(NodeExecutor):
    async def execute(self, node: TransformNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Prepare input
        input_data = context.variables
        if node.input_mapping:
            input_data = context.apply_mapping(node.input_mapping, context.variables)
            
        output = None
        
        if node.transform_type == "python":
            # Execute Python transform
            local_vars = {"input": input_data, "output": None}
            exec(node.transform_script, {}, local_vars)
            output = local_vars.get("output", input_data)
        elif node.transform_type == "jinja2":
            # Render Jinja2 template
            template = Template(node.transform_script)
            output = template.render(**input_data)
        else:
            # Default: pass through
            output = input_data
            
        # Apply output mapping
        if node.output_mapping:
            mapped_output = context.apply_mapping(node.output_mapping, {"result": output})
            context.variables.update(mapped_output)
        else:
            context.variables["transform_output"] = output
            
        return output


class ToolNodeExecutor(NodeExecutor):
    async def execute(self, node: ToolNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Get tool from config
        if node.tool >= len(self.app_config.tools):
            raise ValueError(f"Tool index {node.tool} out of range")
            
        # Prepare input
        input_data = context.variables
        if node.input_mapping:
            input_data = context.apply_mapping(node.input_mapping, context.variables)
            
        # TODO: Execute tool
        output = {
            "tool_index": node.tool,
            "input": input_data,
            "result": "Tool execution placeholder"
        }
        
        # Apply output mapping
        if node.output_mapping:
            mapped_output = context.apply_mapping(node.output_mapping, output)
            context.variables.update(mapped_output)
        else:
            context.variables["tool_output"] = output
            
        return output


class UserInputNodeExecutor(NodeExecutor):
    async def execute(self, node: UserInputNodeConfig, context: WorkflowExecutionContext) -> Any:
        # Create future for user input
        future = asyncio.Future()
        context.pending_user_inputs[node.id] = future
        
        # Emit event requesting user input
        await self.event_bus.emit(
            event_type=EventType.USER_INPUT_REQUESTED,
            workflow_id=context.workflow_id,
            execution_id=context.execution_id,
            node_id=node.id,
            data={
                "prompt": node.prompt_text,
                "schema": node.input_schema
            }
        )
        
        # Wait for input (with timeout)
        timeout = node.timeout or 300
        try:
            user_input = await asyncio.wait_for(future, timeout=timeout)
            return {"user_input": user_input}
        except asyncio.TimeoutError:
            raise Exception(f"User input timeout after {timeout} seconds")


class WorkflowEngine:
    """Main workflow execution engine"""
    
    def __init__(self, app_config: AppConfig, event_bus: Optional[EventBus] = None):
        self.app_config = app_config
        self.event_bus = event_bus or get_event_bus()
        self.executions: Dict[str, WorkflowExecutionState] = {}
        self.execution_tasks: Dict[str, asyncio.Task] = {}
        
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
        
    async def start_workflow(self, workflow: WorkflowConfig, initial_data: Optional[Dict[str, Any]] = None) -> str:
        """Start workflow execution"""
        execution_id = str(uuid.uuid4())
        workflow_id = workflow.info.name if workflow.info else "unnamed_workflow"
        
        # Create execution state
        state = WorkflowExecutionState(
            workflow_id=workflow_id,
            execution_id=execution_id,
            status=WorkflowNodeStatus.RUNNING,
            start_time=datetime.now().isoformat()
        )
        
        if initial_data:
            state.context = initial_data
            
        self.executions[execution_id] = state
        
        # Emit started event
        await self.event_bus.emit(
            event_type=EventType.WORKFLOW_STARTED,
            workflow_id=workflow_id,
            execution_id=execution_id,
            data={"initial_data": initial_data}
        )
        
        # Start execution task
        task = asyncio.create_task(self._execute_workflow(workflow, state))
        self.execution_tasks[execution_id] = task
        
        return execution_id
        
    async def _execute_workflow(self, workflow: WorkflowConfig, state: WorkflowExecutionState):
        """Execute workflow"""
        context = WorkflowExecutionContext(state.workflow_id, state.execution_id)
        context.variables = state.context
        
        try:
            # Find start node
            start_nodes = [n for n in workflow.nodes if n.type == WorkflowNodeType.START]
            if not start_nodes:
                raise ValueError("No start node found in workflow")
                
            # Execute from start node
            await self._execute_node(start_nodes[0], workflow, context, state)
            
            # Mark as completed
            state.status = WorkflowNodeStatus.COMPLETED
            state.end_time = datetime.now().isoformat()
            
            await self.event_bus.emit(
                event_type=EventType.WORKFLOW_COMPLETED,
                workflow_id=state.workflow_id,
                execution_id=state.execution_id,
                data={"output": context.variables}
            )
            
        except Exception as e:
            state.status = WorkflowNodeStatus.FAILED
            state.error = str(e)
            state.end_time = datetime.now().isoformat()
            
            await self.event_bus.emit(
                event_type=EventType.WORKFLOW_FAILED,
                workflow_id=state.workflow_id,
                execution_id=state.execution_id,
                error=str(e)
            )
            
    async def _execute_node(self, node: WorkflowNodeConfig, workflow: WorkflowConfig, 
                           context: WorkflowExecutionContext, state: WorkflowExecutionState):
        """Execute a single node"""
        # Mark node as running
        state.current_nodes.append(node.id)
        state.node_states[node.id] = {"status": WorkflowNodeStatus.RUNNING}
        
        await self.event_bus.emit(
            event_type=EventType.NODE_STARTED,
            workflow_id=context.workflow_id,
            execution_id=context.execution_id,
            node_id=node.id,
            data={"node_type": node.type}
        )
        
        try:
            # Execute node
            executor = self.executors.get(node.type)
            if not executor:
                raise ValueError(f"No executor for node type: {node.type}")
                
            result = await executor.execute(node, context)
            
            # Store result
            context.set_node_output(node.id, result)
            state.node_states[node.id] = {
                "status": WorkflowNodeStatus.COMPLETED,
                "output": result
            }
            state.completed_nodes.append(node.id)
            state.current_nodes.remove(node.id)
            
            await self.event_bus.emit(
                event_type=EventType.NODE_COMPLETED,
                workflow_id=context.workflow_id,
                execution_id=context.execution_id,
                node_id=node.id,
                data={"output": result}
            )
            
            # If end node, stop here
            if node.type == WorkflowNodeType.END:
                return
                
            # Find and execute next nodes
            next_edges = [e for e in workflow.edges if e.source == node.id]
            
            for edge in next_edges:
                # Evaluate edge condition
                if await self._evaluate_edge_condition(edge, context, result):
                    next_node = next((n for n in workflow.nodes if n.id == edge.target), None)
                    if next_node:
                        await self._execute_node(next_node, workflow, context, state)
                        
        except Exception as e:
            state.node_states[node.id] = {
                "status": WorkflowNodeStatus.FAILED,
                "error": str(e)
            }
            state.failed_nodes.append(node.id)
            if node.id in state.current_nodes:
                state.current_nodes.remove(node.id)
                
            await self.event_bus.emit(
                event_type=EventType.NODE_FAILED,
                workflow_id=context.workflow_id,
                execution_id=context.execution_id,
                node_id=node.id,
                error=str(e)
            )
            raise
            
    async def _evaluate_edge_condition(self, edge: WorkflowEdgeConfig, 
                                      context: WorkflowExecutionContext, 
                                      node_output: Any) -> bool:
        """Evaluate edge condition"""
        if not edge.condition:
            return True
            
        condition = edge.condition
        
        if condition.type == "always":
            return True
            
        value = context.get_variable(condition.field) if condition.field else node_output
        
        if condition.type == "equals":
            return value == condition.value
        elif condition.type == "contains":
            return condition.value in str(value)
        elif condition.type == "greater":
            return value > condition.value
        elif condition.type == "less":
            return value < condition.value
            
        return True
        
    async def provide_user_input(self, execution_id: str, node_id: str, user_input: Any):
        """Provide user input for waiting node"""
        state = self.executions.get(execution_id)
        if not state:
            raise ValueError(f"Execution not found: {execution_id}")
            
        # Find execution context (this is simplified - would need proper context management)
        # For now, emit event
        await self.event_bus.emit(
            event_type=EventType.USER_INPUT_RECEIVED,
            workflow_id=state.workflow_id,
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
                
                await self.event_bus.emit(
                    event_type=EventType.WORKFLOW_CANCELLED,
                    workflow_id=state.workflow_id,
                    execution_id=execution_id
                )
