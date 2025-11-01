# workflow_schema

from enum     import Enum
from pydantic import field_validator
from typing   import Any, Dict, List, Optional


from schema   import Index, ConfigModel, InfoConfig, AppConfig


class WorkflowEdgeCondition(ConfigModel):
	type: str = "always"  # always, equals, contains, greater, less, custom
	field: Optional[str] = None
	value: Optional[Any] = None
	expression: Optional[str] = None


class WorkflowEdgeConfig(ConfigModel):
	source: Index  # source node INDEX in nodes list
	target: Index  # target node INDEX in nodes list
	condition: Optional[WorkflowEdgeCondition] = None
	label: Optional[str] = None


class WorkflowNodeType(str, Enum):
	START = "start"
	END = "end"
	DECISION = "decision"
	MERGE = "merge"
	PARALLEL = "parallel"
	LOOP = "loop"
	AGENT = "agent"
	PROMPT = "prompt"
	TRANSFORM = "transform"
	TOOL = "tool"
	USER_INPUT = "user_input"


class WorkflowNodeStatus(str, Enum):
	PENDING = "pending"
	RUNNING = "running"
	COMPLETED = "completed"
	FAILED = "failed"
	SKIPPED = "skipped"
	WAITING = "waiting"


class WorkflowNodeConfig(ConfigModel):
	id: str  # Keep id for human readability, but use indices for references
	type: WorkflowNodeType
	label: Optional[str] = None
	timeout: Optional[int] = None


class StartNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.START
	initial_data: Optional[Dict[str, Any]] = None


class EndNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.END
	output_mapping: Optional[Dict[str, str]] = None


class DecisionNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.DECISION
	condition_field: str
	branches: Dict[str, Index]  # branch_name -> target node INDEX


class MergeNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.MERGE
	strategy: str = "first"  # first, last, all
	wait_for: List[Index] = []  # List of node INDICES we're waiting for (empty = wait for all incoming)


class ParallelNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.PARALLEL
	branches: List[Index] = []  # List of node INDICES to execute in parallel
	wait_for_all: bool = True
	max_concurrent: Optional[int] = None


class LoopNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.LOOP
	body: Index  # Node INDEX of loop body start
	max_iterations: int = 10
	condition_field: Optional[str] = None
	condition_value: Optional[Any] = None
	break_on: Optional[str] = None  # Field to check for break condition


class AgentNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.AGENT
	agent: Index  # reference to agent by index
	input_mapping: Optional[Dict[str, str]] = None
	output_mapping: Optional[Dict[str, str]] = None


class PromptNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.PROMPT
	prompt: Index  # reference to prompt by index
	model: Optional[Index] = None
	input_mapping: Optional[Dict[str, str]] = None
	output_mapping: Optional[Dict[str, str]] = None


class TransformNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.TRANSFORM
	transform_type: str = "jq"  # jq, python, custom
	transform_script: str
	input_mapping: Optional[Dict[str, str]] = None
	output_mapping: Optional[Dict[str, str]] = None


class ToolNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.TOOL
	tool: Index  # reference to tool by index
	input_mapping: Optional[Dict[str, str]] = None
	output_mapping: Optional[Dict[str, str]] = None


class UserInputNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.USER_INPUT
	prompt_text: str
	input_schema: Optional[Dict[str, Any]] = None
	timeout: Optional[int] = 300  # 5 minutes default


class WorkflowOptionsConfig(ConfigModel):
	tag : int = 0


class WorkflowConfig(ConfigModel):
	info: Optional[InfoConfig] = InfoConfig()
	options: Optional[WorkflowOptionsConfig] = WorkflowOptionsConfig()
	nodes: List[WorkflowNodeConfig] = []
	edges: List[WorkflowEdgeConfig] = []
	variables: Optional[Dict[str, Any]] = None
	

	@field_validator('edges')
	def validate_edges(cls, edges, info):
		"""Validate that edge references are valid"""
		if 'nodes' in info.data:
			nodes = info.data['nodes']
			node_count = len(nodes)
			
			for edge in edges:
				if edge.source < 0 or edge.source >= node_count:
					raise ValueError(f"Invalid edge source index: {edge.source}")
				if edge.target < 0 or edge.target >= node_count:
					raise ValueError(f"Invalid edge target index: {edge.target}")
		
		return edges


	def validate_against_app_config(self, app_config: AppConfig) -> List[str]:
		"""
		Validate that workflow references to app config are valid.
		Returns list of validation errors (empty if valid).
		"""
		errors = []
		
		for i, node in enumerate(self.nodes):
			if node.type == WorkflowNodeType.AGENT:
				if node.agent >= len(app_config.agents):
					errors.append(f"Node {i} ({node.id}): Invalid agent index {node.agent}")
			
			elif node.type == WorkflowNodeType.TOOL:
				if node.tool >= len(app_config.tools):
					errors.append(f"Node {i} ({node.id}): Invalid tool index {node.tool}")
			
			elif node.type == WorkflowNodeType.PROMPT:
				if node.prompt >= len(app_config.prompts):
					errors.append(f"Node {i} ({node.id}): Invalid prompt index {node.prompt}")
				if node.model is not None and node.model >= len(app_config.models):
					errors.append(f"Node {i} ({node.id}): Invalid model index {node.model}")
		
		return errors
