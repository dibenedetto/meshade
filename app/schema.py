# schema

from   pydantic        import BaseModel
from   typing          import Any, Dict, List, Optional, Union
from   enum            import Enum


DEFAULT_APP_MAX_AGENTS                            : int  = 100
DEFAULT_APP_PORT                                  : int  = 8000
DEFAULT_APP_API_KEY                               : str  = None

DEFAULT_APP_OPTIONS_RELOAD                        : bool = True
DEFAULT_APP_OPTIONS_SEED                          : int  = None

DEFAULT_BACKEND_TYPE                              : str  = "agno"
DEFAULT_BACKEND_VERSION                           : str  = ""
DEFAULT_BACKEND_FALLBACK                          : bool = False

DEFAULT_MODEL_TYPE                                : str  = "ollama"
DEFAULT_MODEL_ID                                  : str  = "mistral"
DEFAULT_MODEL_FALLBACK                            : bool = False

DEFAULT_EMBEDDING_TYPE                            : str  = "ollama"
DEFAULT_EMBEDDING_ID                              : str  = "mistral"
DEFAULT_EMBEDDING_FALLBACK                        : bool = False

DEFAULT_CONTENT_DB_ENGINE                         : str  = "sqlite"
DEFAULT_CONTENT_DB_URL                            : str  = "storage/content"
DEFAULT_CONTENT_DB_FALLBACK                       : bool = False

DEFAULT_INDEX_DB_ENGINE                           : str  = "lancedb"
DEFAULT_INDEX_DB_URL                              : str  = "storage/index"
DEFAULT_INDEX_DB_SEARCH_TYPE                      : str  = "hybrid"
DEFAULT_INDEX_DB_FALLBACK                         : bool = False

DEFAULT_MEMORY_MANAGER_QUERY                      : bool = False
DEFAULT_MEMORY_MANAGER_UPDATE                     : bool = False
DEFAULT_MEMORY_MANAGER_MANAGED                    : bool = False
DEFAULT_MEMORY_MANAGER_CONTENT_DB_TABLE_NAME      : str  = "memory_manager_content_db_table"

DEFAULT_SESSION_MANAGER_QUERY                     : bool = False
DEFAULT_SESSION_MANAGER_UPDATE                    : bool = False
DEFAULT_SESSION_MANAGER_HISTORY_SIZE              : int  = 10
DEFAULT_SESSION_MANAGER_SUMMARIZE                 : bool = False
DEFAULT_SESSION_MANAGER_CONTENT_DB_TABLE_NAME     : str  = "session_manager_content_db_table"

DEFAULT_KNOWLEDGE_MANAGER_QUERY                   : bool = True
DEFAULT_KNOWLEDGE_MANAGER_MAX_RESULTS             : int  = 10
DEFAULT_KNOWLEDGE_MANAGER_CONTENT_DB_TABLE_NAME   : str  = "knowledge_manager_content_db_table"
DEFAULT_KNOWLEDGE_MANAGER_INDEX_DB_TABLE_NAME     : str  = "knowledge_manager_index_db_table"

DEFAULT_TOOL_FALLBACK                             : bool = False
DEFAULT_TOOL_MAX_WEB_SEARCH_RESULTS               : int  = 5

DEFAULT_AGENT_OPTIONS_MARKDOWN                    : bool = True
DEFAULT_AGENT_OPTIONS_USE_SESSION                 : bool = False
DEFAULT_AGENT_OPTIONS_SESSION_HISTORY_SIZE        : int  = 10
DEFAULT_AGENT_OPTIONS_SUMMARIZE_SESSIONS          : bool = False
DEFAULT_AGENT_OPTIONS_USE_KNOWLEDGE               : bool = False


Index = int


class ConfigModel(BaseModel):
	data : Optional[Any] = None  # custom data


class InfoConfig(ConfigModel):
	version      : Optional[str      ] = None
	name         : Optional[str      ] = None
	author       : Optional[str      ] = None
	description  : Optional[str      ] = None
	instructions : Optional[List[str]] = None


class BackendConfig(ConfigModel):
	type     : str  = DEFAULT_BACKEND_TYPE      # backend name
	version  : str  = DEFAULT_BACKEND_VERSION   # backend version
	fallback : bool = DEFAULT_BACKEND_FALLBACK  # backend fallback


class ModelConfig(ConfigModel):
	type     : str  = DEFAULT_MODEL_TYPE      # model provider name
	id       : str  = DEFAULT_MODEL_ID        # model name (relative to llm)
	fallback : bool = DEFAULT_MODEL_FALLBACK  # model fallback


class EmbeddingConfig(ConfigModel):
	type     : str  = DEFAULT_EMBEDDING_TYPE      # embedding provider name
	id       : str  = DEFAULT_EMBEDDING_TYPE      # embedding name (relative to embedder)
	fallback : bool = DEFAULT_EMBEDDING_FALLBACK  # embedding fallback


class PromptConfig(ConfigModel):
	model        : Optional[Union[ModelConfig    , Index]] = None  # model to use for agentic knowledge processing
	embedding    : Optional[Union[EmbeddingConfig, Index]] = None  # embedding to use for agentic knowledge processing
	description  : Optional[str]                           = None
	instructions : Optional[List[str]]                     = None
	override     : Optional[str]                           = None  # override prompt template


class ContentDBConfig(ConfigModel):
	engine               : str  = DEFAULT_CONTENT_DB_ENGINE                        # db engine name (eg. sqlite)
	url                  : str  = DEFAULT_CONTENT_DB_URL                           # db url (eg. sqlite file path)
	memory_table_name    : str  = DEFAULT_MEMORY_MANAGER_CONTENT_DB_TABLE_NAME     # name of the table to store memory content
	session_table_name   : str  = DEFAULT_SESSION_MANAGER_CONTENT_DB_TABLE_NAME    # name of the table to store session content
	knowledge_table_name : str  = DEFAULT_KNOWLEDGE_MANAGER_CONTENT_DB_TABLE_NAME  # name of the table to store knowledge content
	fallback             : bool = DEFAULT_CONTENT_DB_FALLBACK                      # engine fallback


class IndexDBConfig(ConfigModel):
	engine      : str  = DEFAULT_INDEX_DB_ENGINE       # db engine name (eg. sqlite)
	embedding   : Union[EmbeddingConfig, Index]
	url         : str  = DEFAULT_INDEX_DB_URL          # db url (eg. sqlite file path)
	search_type : str  = DEFAULT_INDEX_DB_SEARCH_TYPE  # search type (eg. hybrid)
	fallback    : bool = DEFAULT_INDEX_DB_FALLBACK     # engine fallback


class MemoryManagerConfig(ConfigModel):
	query   : bool                                 = DEFAULT_MEMORY_MANAGER_QUERY
	update  : bool                                 = DEFAULT_MEMORY_MANAGER_UPDATE
	managed : bool                                 = DEFAULT_MEMORY_MANAGER_MANAGED
	prompt  : Optional[Union[PromptConfig, Index]] = None  # prompt for memory processing


class SessionManagerConfig(ConfigModel):
	query        : bool                                 = DEFAULT_SESSION_MANAGER_QUERY
	update       : bool                                 = DEFAULT_SESSION_MANAGER_UPDATE
	summarize    : bool                                 = DEFAULT_SESSION_MANAGER_SUMMARIZE
	history_size : int                                  = DEFAULT_SESSION_MANAGER_HISTORY_SIZE
	prompt       : Optional[Union[PromptConfig, Index]] = None  # prompt for session summarization


class KnowledgeManagerConfig(ConfigModel):
	query       : bool                                      = DEFAULT_KNOWLEDGE_MANAGER_QUERY
	description : Optional [str                           ] = None
	content_db  : Optional [Union [ContentDBConfig, Index]] = None  # where to store knowledge content
	index_db    : Union    [IndexDBConfig, Index          ] = None  # where to store knowledge index
	max_results : int                                       = DEFAULT_KNOWLEDGE_MANAGER_MAX_RESULTS
	urls        : Optional [List  [str                   ]] = None  # urls to fetch knowledge from


class ToolConfig(ConfigModel):
	type     : str
	args     : Optional[Dict[str, Any]] = None
	ref      : Optional[str           ] = None
	fallback : bool                     = DEFAULT_TOOL_FALLBACK


class AgentOptionsConfig(ConfigModel):
	markdown : bool = DEFAULT_AGENT_OPTIONS_MARKDOWN


class AgentConfig(ConfigModel):
	info          : Optional [InfoConfig                            ] = InfoConfig()
	options       : Optional [Union [AgentOptionsConfig    , Index ]] = AgentOptionsConfig()
	backend       : Union    [BackendConfig, Index                  ]
	prompt        : Union    [PromptConfig , Index                  ]
	content_db    : Optional [Union [ContentDBConfig       , Index ]] = None
	memory_mgr    : Optional [Union [MemoryManagerConfig   , Index ]] = None
	session_mgr   : Optional [Union [SessionManagerConfig  , Index ]] = None
	knowledge_mgr : Optional [Union [KnowledgeManagerConfig, Index ]] = None
	tools         : Optional [List  [Union[ToolConfig      , Index]]] = []
	port          : int                                               = 0


class TeamOptionsConfig(ConfigModel):
	tag : int = 0


class TeamConfig(ConfigModel):
	info    : Optional[InfoConfig]                      = InfoConfig()
	options : Optional[Union[TeamOptionsConfig, Index]] = TeamOptionsConfig()
	agents  : List[Union[AgentConfig, Index]]           = []


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


class WorkflowEdgeCondition(ConfigModel):
	type: str = "always"  # always, equals, contains, greater, less, custom
	field: Optional[str] = None
	value: Optional[Any] = None
	expression: Optional[str] = None


class WorkflowEdgeConfig(ConfigModel):
	id: str
	source: str  # source node id
	target: str  # target node id
	condition: Optional[WorkflowEdgeCondition] = None
	label: Optional[str] = None


class WorkflowNodeConfig(ConfigModel):
	id: str
	type: WorkflowNodeType
	label: Optional[str] = None
	timeout: Optional[int] = None  # timeout in seconds


class StartNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.START
	initial_data: Optional[Dict[str, Any]] = None


class EndNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.END
	output_mapping: Optional[Dict[str, str]] = None


class DecisionNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.DECISION
	condition_field: str
	branches: Dict[str, Any]  # branch_name -> condition_value


class MergeNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.MERGE
	strategy: str = "first"  # first, last, all, custom


class ParallelNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.PARALLEL
	wait_for_all: bool = True
	max_concurrent: Optional[int] = None


class LoopNodeConfig(WorkflowNodeConfig):
	type: WorkflowNodeType = WorkflowNodeType.LOOP
	max_iterations: int = 10
	condition_field: Optional[str] = None
	condition_value: Optional[Any] = None


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
	options: Optional[Union[WorkflowOptionsConfig, Index]] = WorkflowOptionsConfig()
	nodes: List[WorkflowNodeConfig] = []
	edges: List[WorkflowEdgeConfig] = []
	variables: Optional[Dict[str, Any]] = None


class AppOptionsConfig(ConfigModel):
	seed   : Optional[int] = DEFAULT_APP_OPTIONS_SEED
	reload : bool          = DEFAULT_APP_OPTIONS_RELOAD


class AppConfig(ConfigModel):
	info             : Optional[Union[InfoConfig      , Index]] = InfoConfig()
	options          : Optional[Union[AppOptionsConfig, Index]] = AppOptionsConfig()
	infos            : Optional[List[InfoConfig              ]] = []
	app_options      : Optional[List[AppOptionsConfig        ]] = []
	backends         : Optional[List[BackendConfig           ]] = []
	models           : Optional[List[ModelConfig             ]] = []
	embeddings       : Optional[List[EmbeddingConfig         ]] = []
	prompts          : Optional[List[PromptConfig            ]] = []
	content_dbs      : Optional[List[ContentDBConfig         ]] = []
	index_dbs        : Optional[List[IndexDBConfig           ]] = []
	memory_mgrs      : Optional[List[MemoryManagerConfig     ]] = []
	session_mgrs     : Optional[List[SessionManagerConfig    ]] = []
	knowledge_mgrs   : Optional[List[KnowledgeManagerConfig  ]] = []
	tools            : Optional[List[ToolConfig              ]] = []
	agent_options    : Optional[List[AgentOptionsConfig      ]] = []
	agents           : Optional[List[AgentConfig             ]] = []
	team_options     : Optional[List[TeamOptionsConfig       ]] = []
	teams            : Optional[List[TeamConfig              ]] = []
	workflow_options : Optional[List[WorkflowOptionsConfig   ]] = []
	workflows        : Optional[List[WorkflowConfig          ]] = []
	port             : int                                      = DEFAULT_APP_PORT
