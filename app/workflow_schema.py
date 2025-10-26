from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Union
from enum import Enum


# ========================================================================
# EVENT SYSTEM
# ========================================================================

class EventType(str, Enum):
    """Core event types in the workflow system"""
    # Workflow lifecycle
    WORKFLOW_START = "workflow.start"
    WORKFLOW_END = "workflow.end"
    WORKFLOW_ERROR = "workflow.error"
    
    # Node execution
    NODE_START = "node.start"
    NODE_END = "node.end"
    NODE_ERROR = "node.error"
    NODE_SKIP = "node.skip"
    
    # Agent events
    AGENT_MESSAGE = "agent.message"
    AGENT_RESPONSE = "agent.response"
    AGENT_TOOL_CALL = "agent.tool_call"
    AGENT_TOOL_RESULT = "agent.tool_result"
    
    # User events
    USER_INPUT = "user.input"
    USER_APPROVAL = "user.approval"
    
    # Data events
    DATA_CHANGED = "data.changed"
    STATE_UPDATED = "state.updated"
    
    # Custom events
    CUSTOM = "custom"


class EventConfig(BaseModel):
    """Configuration for an event"""
    type: EventType
    name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None  # Conditions for event matching


class Event(BaseModel):
    """Runtime event instance"""
    id: str
    type: EventType
    name: Optional[str] = None
    source_node_id: Optional[str] = None
    timestamp: float
    data: Dict[str, Any] = {}
    workflow_id: str
    execution_id: str


# ========================================================================
# WORKFLOW NODES
# ========================================================================

class NodeType(str, Enum):
    """Types of nodes in workflow"""
    # Control flow
    START = "start"
    END = "end"
    DECISION = "decision"
    MERGE = "merge"
    PARALLEL = "parallel"
    LOOP = "loop"
    
    # AI operations
    AGENT = "agent"
    PROMPT = "prompt"
    EMBEDDING = "embedding"
    
    # Data operations
    TRANSFORM = "transform"
    EXTRACT = "extract"
    VALIDATE = "validate"
    
    # External operations
    API_CALL = "api_call"
    TOOL_CALL = "tool_call"
    WEBHOOK = "webhook"
    
    # User interaction
    USER_INPUT = "user_input"
    USER_APPROVAL = "user_approval"
    NOTIFICATION = "notification"
    
    # Storage
    SAVE = "save"
    LOAD = "load"
    QUERY = "query"


class NodeConfig(BaseModel):
    """Configuration for a workflow node"""
    id: str
    type: NodeType
    name: str
    description: Optional[str] = None
    
    # Position in visual editor
    position: Dict[str, float] = {"x": 0, "y": 0}
    
    # Node-specific configuration
    config: Dict[str, Any] = {}
    
    # Input/output definitions
    inputs: Dict[str, Any] = {}
    outputs: Dict[str, Any] = {}
    
    # Events this node can emit
    emits: List[EventConfig] = []
    
    # Events this node listens to
    listens: List[EventConfig] = []
    
    # Error handling
    on_error: Optional[str] = None  # Node ID to route to on error
    retry_config: Optional[Dict[str, Any]] = None


class AgentNodeConfig(BaseModel):
    """Specific config for agent nodes"""
    agent_ref: Union[int, str]  # Reference to agent in config
    prompt_template: Optional[str] = None
    input_mapping: Dict[str, str] = {}  # Map workflow state to agent input
    output_mapping: Dict[str, str] = {}  # Map agent output to workflow state
    streaming: bool = True
    max_iterations: int = 1


class DecisionNodeConfig(BaseModel):
    """Specific config for decision nodes"""
    conditions: List[Dict[str, Any]]  # List of {condition, target_node}
    default_node: Optional[str] = None
    evaluation_mode: str = "first_match"  # or "all_match"


class LoopNodeConfig(BaseModel):
    """Specific config for loop nodes"""
    loop_over: str  # State variable to iterate
    loop_body_node: str  # Entry node for loop body
    max_iterations: int = 100
    break_condition: Optional[str] = None


# ========================================================================
# WORKFLOW EDGES
# ========================================================================

class EdgeType(str, Enum):
    """Types of edges in workflow"""
    DEFAULT = "default"  # Normal execution flow
    CONDITIONAL = "conditional"  # Based on condition
    EVENT = "event"  # Triggered by event
    ERROR = "error"  # Error handling path


class EdgeConfig(BaseModel):
    """Configuration for workflow edge"""
    id: str
    source_node_id: str
    target_node_id: str
    type: EdgeType = EdgeType.DEFAULT
    
    # Condition for conditional edges
    condition: Optional[str] = None  # Python expression or JSONPath
    
    # Event trigger for event edges
    event_trigger: Optional[EventConfig] = None
    
    # Data transformation on edge
    transform: Optional[str] = None
    
    # Visual properties
    style: Dict[str, Any] = {}


# ========================================================================
# WORKFLOW DEFINITION
# ========================================================================

class WorkflowState(BaseModel):
    """State structure for workflow execution"""
    variables: Dict[str, Any] = {}
    context: Dict[str, Any] = {}
    memory: List[Dict[str, Any]] = []
    outputs: Dict[str, Any] = {}


class WorkflowConfig(BaseModel):
    """Complete workflow definition"""
    id: str
    name: str
    description: Optional[str] = None
    version: str = "1.0.0"
    
    # Graph structure
    nodes: List[NodeConfig]
    edges: List[EdgeConfig]
    
    # Entry and exit points
    start_node_id: str
    end_node_ids: List[str] = []
    
    # Initial state
    initial_state: WorkflowState = WorkflowState()
    
    # Workflow-level configuration
    config: Dict[str, Any] = {}
    
    # Agents, tools, etc. used in this workflow
    agents: List[int] = []  # References to app-level agents
    tools: List[int] = []
    
    # Event handlers
    global_event_handlers: Dict[str, str] = {}  # event_type -> node_id


# ========================================================================
# WORKFLOW EXECUTION
# ========================================================================

class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_INPUT = "waiting_input"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeExecutionRecord(BaseModel):
    """Record of a single node execution"""
    node_id: str
    status: ExecutionStatus
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    input_data: Dict[str, Any] = {}
    output_data: Dict[str, Any] = {}
    error: Optional[str] = None
    events_emitted: List[str] = []  # Event IDs


class WorkflowExecutionState(BaseModel):
    """Runtime state of workflow execution"""
    workflow_id: str
    execution_id: str
    status: ExecutionStatus
    
    # Execution graph
    current_node_ids: List[str] = []  # For parallel execution
    completed_node_ids: List[str] = []
    node_executions: Dict[str, NodeExecutionRecord] = {}
    
    # State and data
    state: WorkflowState = WorkflowState()
    
    # Event queue
    event_queue: List[Event] = []
    processed_events: List[str] = []  # Event IDs
    
    # Timing
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    
    # Error handling
    errors: List[Dict[str, Any]] = []


# ========================================================================
# WORKFLOW REGISTRY
# ========================================================================

class WorkflowRegistryEntry(BaseModel):
    """Entry in the workflow registry"""
    workflow: WorkflowConfig
    created_at: float
    updated_at: float
    tags: List[str] = []
    metadata: Dict[str, Any] = {}


# ========================================================================
# INTEGRATION WITH EXISTING SCHEMA
# ========================================================================

# Add to existing AppConfig
class ExtendedAppConfig(BaseModel):
    """Extended app config with workflow support"""
    # ... all existing fields ...
    
    # New workflow fields
    workflows: List[WorkflowConfig] = []
    workflow_registry: Dict[str, WorkflowRegistryEntry] = {}
