# numel

import copy
import json


from   collections.abc import Callable
from   fastapi         import FastAPI
from   pydantic        import BaseModel
from   typing          import Any, Dict, List, Optional, Tuple, Union


from   utils           import log_print


DEFAULT_SEED                                      : int  = 42

DEFAULT_API_KEY                                   : str  = None

DEFAULT_BACKEND_TYPE                              : str  = "agno"
DEFAULT_BACKEND_VERSION                           : str  = ""

DEFAULT_MODEL_TYPE                                : str  = "ollama"
DEFAULT_MODEL_ID                                  : str  = "mistral"

DEFAULT_EMBEDDING_TYPE                            : str  = "ollama"
DEFAULT_EMBEDDING_ID                              : str  = "mistral"

DEFAULT_INDEX_DB_ENGINE                           : str  = "lancedb"
DEFAULT_INDEX_DB_URL                              : str  = "storage/index"
DEFAULT_INDEX_DB_SEARCH_TYPE                      : str  = "hybrid"

DEFAULT_CONTENT_DB_ENGINE                         : str  = "sqlite"
DEFAULT_CONTENT_DB_URL                            : str  = "storage/content"

DEFAULT_MEMORY_MANAGER_CONTENT_DB_TABLE_NAME      : str  = "memory_manager_content_db_table"
DEFAULT_SESSION_MANAGER_CONTENT_DB_TABLE_NAME     : str  = "session_manager_content_db_table"
DEFAULT_KNOWLEDGE_BASE_CONTENT_DB_TABLE_NAME      : str  = "knowledge_base_content_db_table"
DEFAULT_KNOWLEDGE_BASE_INDEX_DB_TABLE_NAME        : str  = "knowledge_base_index_db_table"

DEFAULT_OPTIONS_MARKDOWN                          : bool = True
DEFAULT_OPTIONS_SEARCH_KNOWLEDGE                  : bool = True
DEFAULT_OPTIONS_ENABLE_AGENTIC_MEMORY             : bool = True
DEFAULT_OPTIONS_ADD_HISTORY_TO_MESSAGES           : bool = True
DEFAULT_OPTIONS_NUM_HISTORY_RUNS                  : int  = 3
DEFAULT_OPTIONS_ENABLE_SESSION_SUMMARIES          : bool = True
DEFAULT_OPTIONS_SEARCH_PREVIOUS_SESSIONS_HISTORY  : bool = True
DEFAULT_OPTIONS_NUM_HISTORY_SESSIONS              : int  = 2
DEFAULT_OPTIONS_SHOW_TOOL_CALLS                   : bool = True
DEFAULT_OPTIONS_TOOL_CALL_LIMIT                   : int  = 5
DEFAULT_OPTIONS_REASONING                         : bool = True
DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS         : bool = True
DEFAULT_OPTIONS_MAX_WEB_SEARCH_RESULTS            : int  = 5

DEFAULT_APP_PORT                                  : int  = 8000
DEFAULT_APP_RELOAD                                : bool = True


# BACKEND_TYPES             = ["agno"]
# MODEL_TYPES               = ["ollama", "openai"]
# EMBEDDING_TYPES           = ["ollama", "openai"]
# CONTENT_DB_ENGINES        = ["sqlite"]
# KNOWLEDGE_DB_ENGINES      = ["lancedb"]
# KNOWLEDGE_DB_SEARCH_TYPES = ["hybrid"]


# class Capabilities(BaseModel):
# 	name          : Optional[str]                       = None
# 	description   : Optional[str]                       = None
# 	reference     : Optional[str]                       = None

# 	type          : str
# 	version       : str

# 	models        : Optional[List[ModelConfig]]         = None
# 	embeddings    : Optional[List[EmbeddingConfig]]     = None
# 	knowledge_dbs : Optional[List[KnowledgeDBConfig]]   = None
# 	knowledges    : Optional[List[KnowledgeConfig]]     = None
# 	memory_dbs    : Optional[List[MemoryDBConfig]]      = None
# 	memories      : Optional[List[MemoryConfig]]        = None
# 	storage_dbs   : Optional[List[StorageDBConfig]]     = None
# 	storages      : Optional[List[StorageConfig]]       = None
# 	options       : Optional[List[OptionsConfig]]       = None
# 	data          : Optional[Any]                       = None


class ConfigModel(BaseModel):
	data : Optional[Any] = None  # custom data


class BackendConfig(ConfigModel):
	type    : str = DEFAULT_BACKEND_TYPE     # backend name
	version : str = DEFAULT_BACKEND_VERSION  # backend version


class ModelConfig(ConfigModel):
	type : str = DEFAULT_MODEL_TYPE  # model provider name
	id   : str = DEFAULT_MODEL_ID    # model name (relative to llm)


class EmbeddingConfig(ConfigModel):
	type : str = DEFAULT_EMBEDDING_TYPE  # embedding provider name
	id   : str = DEFAULT_EMBEDDING_TYPE  # embedding name (relative to embedder)


class PromptConfig(ConfigModel):
	model        : Optional[Union[ModelConfig    , int]] = None  # model to use for agentic knowledge processing
	embedding    : Optional[Union[EmbeddingConfig, int]] = None  # embedding to use for agentic knowledge processing
	description  : Optional[str]                         = None
	instructions : Optional[List[str]]                   = None
	override     : Optional[str]                         = None  # override prompt template


class ContentDBConfig(ConfigModel):
	engine               : str = DEFAULT_CONTENT_DB_ENGINE                      # db engine name (eg. sqlite)
	url                  : str = DEFAULT_CONTENT_DB_URL                         # db url (eg. sqlite file path)
	memory_table_name    : str = DEFAULT_MEMORY_MANAGER_CONTENT_DB_TABLE_NAME   # name of the table to store memory content
	session_table_name   : str = DEFAULT_SESSION_MANAGER_CONTENT_DB_TABLE_NAME  # name of the table to store session content
	knowledge_table_name : str = DEFAULT_KNOWLEDGE_BASE_CONTENT_DB_TABLE_NAME   # name of the table to store knowledge base content


class IndexDBConfig(ConfigModel):
	engine      : str = DEFAULT_INDEX_DB_ENGINE       # db engine name (eg. sqlite)
	url         : str = DEFAULT_INDEX_DB_URL          # db url (eg. sqlite file path)
	search_type : str = DEFAULT_INDEX_DB_SEARCH_TYPE  # search type (eg. hybrid)


class MemoryManagerConfig(ConfigModel):
	prompt : Optional[Union[PromptConfig, int]] = None  # prompt for memory processing
	store  : bool                               = False
	use    : bool                               = False


class SessionManagerConfig(ConfigModel):
	prompt       : Optional[Union[PromptConfig, int]] = None  # prompt for session processing
	store        : bool                               = False
	use          : bool                               = False
	history_size : int                                = 10
	# summary      : session_summary_manager,
	# read_chat_history=True
	# add_session_summary_to_context = True
	# enable_session_summaries=True


class KnowledgeBaseConfig(ConfigModel):
	content_db : Optional [Union [ContentDBConfig, int]] = None  # where to store knowledge content
	index_db   : Union    [IndexDBConfig, int          ] = None  # where to store knowledge index
	urls       : Optional [List  [str                 ]] = None  # urls to fetch knowledge from


class KnowledgeManagerConfig(ConfigModel):
	prompt : Optional [Union[PromptConfig, int]]              = None  # prompt for knowledge processing
	bases  : Optional [List[Union[KnowledgeBaseConfig, int]]] = None
	use    : bool                                             = False


class ToolConfig(ConfigModel):
	type : str
	args : Optional[Dict[str, Any]] = None
	ref  : Optional[str           ] = None


class AgentOptionsConfig(ConfigModel):
	markdown                  : bool = DEFAULT_OPTIONS_MARKDOWN
	show_tool_calls           : bool = DEFAULT_OPTIONS_SHOW_TOOL_CALLS
	tool_call_limit           : int  = DEFAULT_OPTIONS_TOOL_CALL_LIMIT
	reasoning                 : bool = DEFAULT_OPTIONS_REASONING
	stream_intermediate_steps : bool = DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS

	# search_knowledge                 : bool = DEFAULT_OPTIONS_SEARCH_KNOWLEDGE
	# enable_agentic_memory            : bool = DEFAULT_OPTIONS_ENABLE_AGENTIC_MEMORY
	# add_history_to_messages          : bool = DEFAULT_OPTIONS_ADD_HISTORY_TO_MESSAGES
	# num_history_runs                 : int  = DEFAULT_OPTIONS_NUM_HISTORY_RUNS
	# enable_session_summaries         : bool = DEFAULT_OPTIONS_ENABLE_SESSION_SUMMARIES
	# search_previous_sessions_history : bool = DEFAULT_OPTIONS_SEARCH_PREVIOUS_SESSIONS_HISTORY
	# num_history_sessions             : int  = DEFAULT_OPTIONS_NUM_HISTORY_SESSIONS
	# show_tool_calls                  : bool = DEFAULT_OPTIONS_SHOW_TOOL_CALLS
	# tool_call_limit                  : int  = DEFAULT_OPTIONS_TOOL_CALL_LIMIT
	# reasoning                        : bool = DEFAULT_OPTIONS_REASONING
	# stream_intermediate_steps        : bool = DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS


class AgentConfig(ConfigModel):
	backend       : Union    [BackendConfig, int                  ]
	prompt        : Union    [PromptConfig , int                  ]
	name          : Optional [str                                 ] = None
	options       : Optional [Union [AgentOptionsConfig    , int ]] = None
	content_db    : Optional [Union [ContentDBConfig       , int ]] = None
	memory_mgr    : Optional [Union [MemoryManagerConfig   , int ]] = None
	session_mgr   : Optional [Union [SessionManagerConfig  , int ]] = None
	knowledge_mgr : Optional [Union [KnowledgeManagerConfig, int ]] = None
	tools         : Optional [List  [Union[ToolConfig      , int]]] = None


class TeamOptionsConfig(ConfigModel):
	tag : int = 0


class TeamConfig(ConfigModel):
	agents  : List[AgentConfig, int]
	options : Optional[Union[TeamOptionsConfig, int]] = None


class WorkflowOptionsConfig(ConfigModel):
	tag : int = 0


class WorkflowConfig(ConfigModel):
	agents  : List[AgentConfig, int]
	teams   : List[TeamConfig, int]
	options : Optional[Union[TeamOptionsConfig, int]] = None


class AppOptionsConfig(ConfigModel):
	port   : int           = DEFAULT_APP_PORT
	reload : bool          = DEFAULT_APP_RELOAD
	seed   : Optional[int] = None


class AppConfig(ConfigModel):
	version          : Optional[str                         ] = None
	name             : Optional[str                         ] = None
	author           : Optional[str                         ] = None
	description      : Optional[str                         ] = None
	options          : Optional[AppOptionsConfig            ] = None
	backends         : Optional[List[BackendConfig         ]] = None
	models           : Optional[List[ModelConfig           ]] = None
	embeddings       : Optional[List[EmbeddingConfig       ]] = None
	prompts          : Optional[List[PromptConfig          ]] = None
	content_dbs      : Optional[List[ContentDBConfig       ]] = None
	index_dbs        : Optional[List[IndexDBConfig         ]] = None
	memory_mgrs      : Optional[List[MemoryManagerConfig   ]] = None
	session_mgrs     : Optional[List[SessionManagerConfig  ]] = None
	knowledge_bases  : Optional[List[KnowledgeBaseConfig   ]] = None
	knowledge_mgrs   : Optional[List[KnowledgeManagerConfig]] = None
	tools            : Optional[List[ToolConfig            ]] = None
	agent_options    : Optional[List[AgentOptionsConfig    ]] = None
	agents           : Optional[List[AgentConfig           ]] = None
	team_options     : Optional[List[TeamOptionsConfig     ]] = None
	teams            : Optional[List[TeamConfig            ]] = None
	workflow_options : Optional[List[WorkflowOptionsConfig ]] = None
	workflows        : Optional[List[WorkflowConfig        ]] = None


def unroll_config(config: AppConfig) -> AppConfig:
	config_copy = copy.deepcopy(config) if config is not None else AppConfig()

	if True:
		if not config_copy.options:
			raise ValueError("Invalid app options")

	if True:
		if not config_copy.backends         : config_copy.backends         = []
		if not config_copy.models           : config_copy.models           = []
		if not config_copy.embeddings       : config_copy.embeddings       = []
		if not config_copy.prompts          : config_copy.prompts          = []
		if not config_copy.content_dbs      : config_copy.content_dbs      = []
		if not config_copy.index_dbs        : config_copy.index_dbs        = []
		if not config_copy.memorie_mgrs     : config_copy.memorie_mgrs     = []
		if not config_copy.session_mgrs     : config_copy.session_mgrs     = []
		if not config_copy.knowledge_bases  : config_copy.knowledge_bases  = []
		if not config_copy.knowledge_mgrs   : config_copy.knowledge_mgrs   = []
		if not config_copy.tools            : config_copy.tools            = []
		if not config_copy.agent_options    : config_copy.agent_options    = []
		if not config_copy.agents           : config_copy.agents           = []
		if not config_copy.team_options     : config_copy.team_options     = []
		if not config_copy.teams            : config_copy.teams            = []
		if not config_copy.workflow_options : config_copy.workflow_options = []
		if not config_copy.workflows        : config_copy.workflows        = []

	if True:
		for agent in config_copy.agents:
			if True:
				if isinstance(agent.options, AgentOptionsConfig):
					config_copy.agent_options.append(agent.options)
					agent.options = len(config_copy.options) - 1
				if not isinstance(agent.options, int) or agent.options < 0 or agent.options >= len(config_copy.agent_options):
					raise ValueError("Invalid agent options")

			if True:
				if isinstance(agent.backend, BackendConfig):
					config_copy.backends.append(agent.backend)
					agent.backend = len(config_copy.backends) - 1
				if not isinstance(agent.backend, int) or agent.backend < 0 or agent.backend >= len(config_copy.backends):
					raise ValueError("Invalid agent backend")

			if True:
				if agent.prompt is None:
						raise ValueError("Invalid agent prompt")
				if isinstance(agent.prompt, PromptConfig):
					config_copy.prompts.append(agent.prompt)
					agent.prompt = len(config_copy.prompts) - 1
				if not isinstance(agent.prompt, int) or agent.prompt < 0 or agent.prompt >= len(config_copy.prompts):
					raise ValueError("Invalid agent prompt")

			if True:
				if agent.content_db is not None:
					if isinstance(agent.content_db, ContentDBConfig):
						config_copy.content_dbs.append(agent.content_db)
						agent.content_db = len(config_copy.content_dbs) - 1
					if not isinstance(agent.content_db, int) or agent.content_db < 0 or agent.content_db >= len(config_copy.content_dbs):
						raise ValueError("Invalid agent content db")

			if True:
				if agent.memory_mgr is not None:
					if isinstance(agent.memory_mgr, MemoryManagerConfig):
						config_copy.memory_mgrs.append(agent.memory_mgr)
						agent.memory_mgr = len(config_copy.memory_mgrs) - 1
					if not isinstance(agent.memory_mgr, int) or agent.memory_mgr < 0 or agent.memory_mgr >= len(config_copy.memory_mgrs):
						raise ValueError("Invalid agent memory")

			if True:
				if agent.session_mgr is not None:
					if isinstance(agent.session_mgr, SessionManagerConfig):
						config_copy.session_mgrs.append(agent.session_mgr)
						agent.session_mgr = len(config_copy.session_mgrs) - 1
					if not isinstance(agent.session_mgr, int) or agent.session_mgr < 0 or agent.session_mgr >= len(config_copy.session_mgrs):
						raise ValueError("Invalid agent session")

			if True:
				if agent.knowledge_mgr is not None:
					if isinstance(agent.knowledge_mgr, KnowledgeManagerConfig):
						config_copy.knowledge_mgrs.append(agent.knowledge_mgr)
						agent.knowledge_mgr = len(config_copy.knowledge_mgrs) - 1
					if not isinstance(agent.knowledge_mgr, int) or agent.knowledge_mgr < 0 or agent.knowledge_mgr >= len(config_copy.knowledge_mgrs):
						raise ValueError("Invalid agent knowledge")

			if True:
				if agent.tools is not None:
					for tool in agent.tools:
						if isinstance(tool, ToolConfig):
							config_copy.tools.append(tool)
							tool = len(config_copy.tools) - 1
						if not isinstance(tool, int) or tool < 0 or tool >= len(config_copy.tools):
							raise ValueError("Invalid agent tool")

	if True:
		for memory_mgr in config_copy.memory_mgrs:
			if memory_mgr.prompt is not None:
				if isinstance(memory_mgr.prompt, PromptConfig):
					config_copy.prompts.append(memory_mgr.prompt)
					memory_mgr.prompt = len(config_copy.prompts) - 1
				if not isinstance(memory_mgr.prompt, int) or memory_mgr.prompt < 0 or memory_mgr.prompt >= len(config_copy.prompts):
					raise ValueError("Invalid memory prompt")
				prompt = config_copy.prompt[memory_mgr.prompt]

				if True:
					if prompt.model is None:
						raise ValueError("Invalid memory prompt model")
					if isinstance(prompt.model, ModelConfig):
						config_copy.models.append(prompt.model)
						prompt.model = len(config_copy.models) - 1
					if not isinstance(prompt.model, int) or prompt.model < 0 or prompt.model >= len(config_copy.models):
						raise ValueError("Invalid memory prompt model")

				if True:
					if prompt.embedding is None:
						raise ValueError("Invalid memory prompt embedding")
					if isinstance(prompt.embedding, EmbeddingConfig):
						config_copy.embeddings.append(prompt.embedding)
						prompt.embedding = len(config_copy.embeddings) - 1
					if not isinstance(prompt.embedding, int) or prompt.embedding < 0 or prompt.embedding >= len(config_copy.embeddings):
						raise ValueError("Invalid memory prompt embedding")

	if True:
		for session_mgr in config_copy.session_mgrs:
			if session_mgr.prompt is not None:
				if isinstance(session_mgr.prompt, PromptConfig):
					config_copy.prompts.append(session_mgr.prompt)
					session_mgr.prompt = len(config_copy.prompts) - 1
				if not isinstance(session_mgr.prompt, int) or session_mgr.prompt < 0 or session_mgr.prompt >= len(config_copy.prompts):
					raise ValueError("Invalid session prompt")
				prompt = config_copy.prompt[session_mgr.prompt]

				if True:
					if prompt.model is None:
						raise ValueError("Invalid session prompt model")
					if isinstance(prompt.model, ModelConfig):
						config_copy.models.append(prompt.model)
						prompt.model = len(config_copy.models) - 1
					if not isinstance(prompt.model, int) or prompt.model < 0 or prompt.model >= len(config_copy.models):
						raise ValueError("Invalid session prompt model")

				if True:
					if prompt.embedding is None:
						raise ValueError("Invalid session prompt embedding")
					if isinstance(prompt.embedding, EmbeddingConfig):
						config_copy.embeddings.append(prompt.embedding)
						prompt.embedding = len(config_copy.embeddings) - 1
					if not isinstance(prompt.embedding, int) or prompt.embedding < 0 or prompt.embedding >= len(config_copy.embeddings):
						raise ValueError("Invalid session prompt embedding")

	if True:
		for knowledge_mgr in config_copy.knowledge_mgrs:
			if True:
				if knowledge_mgr.prompt is not None:
					if isinstance(knowledge_mgr.prompt, PromptConfig):
						config_copy.prompts.append(knowledge_mgr.prompt)
						knowledge_mgr.prompt = len(config_copy.prompts) - 1
					if not isinstance(knowledge_mgr.prompt, int) or knowledge_mgr.prompt < 0 or knowledge_mgr.prompt >= len(config_copy.prompts):
						raise ValueError("Invalid knowledge prompt")

			if True:
				if knowledge_mgr.bases is not None:
					if not isinstance(knowledge_mgr.bases, list):
						raise ValueError("Invalid knowledge bases")

					for i, knowledge_base in enumerate(knowledge_mgr.bases):
						if isinstance(knowledge_base, KnowledgeBaseConfig):
							config_copy.knowledge_bases.append(knowledge_base)
							knowledge_base = len(config_copy.knowledge_bases) - 1
						if not isinstance(knowledge_base, int) or knowledge_base < 0 or knowledge_base >= len(config_copy.knowledge_bases):
							raise ValueError("Invalid knowledge base")
						knowledge_mgr.bases[i] = knowledge_base

	if True:
		for knowledge_base in config_copy.knowledge_bases:
			if True:
				if knowledge_base.content_db is not None:
					if isinstance(knowledge_base.content_db, ContentDBConfig):
						config_copy.content_dbs.append(knowledge_base.content_db)
						knowledge_base.content_db = len(config_copy.content_dbs) - 1
					if not isinstance(knowledge_base.content_db, int) or knowledge_base.content_db < 0 or knowledge_base.content_db >= len(config_copy.content_dbs):
						raise ValueError("Invalid knowledge base content db")

			if True:
				if knowledge_base.index_db is not None:
					if isinstance(knowledge_base.index_db, IndexDBConfig):
						config_copy.index_dbs.append(knowledge_base.index_db)
						knowledge_base.index_db = len(config_copy.index_dbs) - 1
					if not isinstance(knowledge_base.index_db, int) or knowledge_base.index_db < 0 or knowledge_base.index_db >= len(config_copy.index_dbs):
						raise ValueError("Invalid knowledge base index db")

	if True:
		for prompt in config_copy.prompts:
			if True:
				if prompt.model is None:
					raise ValueError("Invalid prompt model")
				if isinstance(prompt.model, ModelConfig):
					config_copy.models.append(prompt.model)
					prompt.model = len(config_copy.models) - 1
				if not isinstance(prompt.model, int) or prompt.model < 0 or prompt.model >= len(config_copy.models):
					raise ValueError("Invalid prompt model")

			if True:
				if prompt.embedding is None:
					raise ValueError("Invalid prompt embedding")
				if isinstance(prompt.embedding, EmbeddingConfig):
					config_copy.embeddings.append(prompt.embedding)
					prompt.embedding = len(config_copy.embeddings) - 1
				if not isinstance(prompt.embedding, int) or prompt.embedding < 0 or prompt.embedding >= len(config_copy.embeddings):
					raise ValueError("Invalid prompt embedding")

	return config_copy


def validate_config(config: AppConfig) -> bool:
	if config is None:
		return False

	if True:
		# TODO: check base fields
		pass

	if True:
		# TODO: check options
		pass

	if True:
		for backend in config.backends:
			# TODO: check backend
			pass

	if True:
		for model in config.models:
			# TODO: check model
			pass

	if True:
		for embedding in config.embeddings:
			# TODO: check embedding
			pass

	if True:
		for prompt in config.prompts:
			# TODO: check prompt
			pass

	if True:
		for content_db in config.content_dbs:
			# TODO: check content_db
			pass

	if True:
		for index_db in config.index_dbs:
			# TODO: check index_db
			pass

	if True:
		for memory_mgr in config.memory_mgrs:
			# TODO: check memory_mgr
			pass

	if True:
		for session_mgr in config.session_mgrs:
			# TODO: check session_mgr
			pass

	if True:
		for knowledge_base in config.knowledge_bases:
			# TODO: check knowledge_base
			pass

	if True:
		for knowledge_mgr in config.knowledge_mgrs:
			# TODO: check knowledge_mgr
			pass

	if True:
		for tool in config.tools:
			# TODO: check tool
			pass

	if True:
		for agent_option in config.agent_options:
			# TODO: check agent_option
			pass

	if True:
		for agent in config.agents:
			# TODO: check agent
			pass

	if True:
		for team_option in config.team_options:
			# TODO: check team_option
			pass

	if True:
		for team in config.teams:
			# TODO: check team
			pass

	if True:
		for workflow_option in config.workflow_options:
			# TODO: check workflow_option
			pass

	if True:
		for workflow in config.workflows:
			# TODO: check workflow
			pass

	return True


def load_config(file_path: str) -> AppConfig:
	try:
		with open(file_path, "r") as f:
			data = json.load(f)
		config = AppConfig(**data)
		return config
	except Exception as e:
		print(f"Error loading config: {e}")
		return None


class AgentApp:

	def __init__(self, config: AppConfig, active_agent_indices: List[bool]):
		if len(active_agent_indices) != len(config.agents):
			raise ValueError("Invalid active_agent_indices length")

		self.config = copy.deepcopy(config)


	def generate_app(self, agent_index: int) -> FastAPI:
		raise NotImplementedError("Subclasses must implement the generate_app method.")


	def close(self) -> bool:
		return True


_backends: Dict[Tuple[str, str], Callable] = dict()


def register_backend(backend: BackendConfig, ctor: Callable) -> bool:
	global _backends
	key = (backend.type, backend.version)
	_backends[key] = ctor
	return True


def get_backend(backend: BackendConfig) -> Callable:
	global _backends
	key = (backend.type, backend.version)
	return _backends.get(key, None)


def instantiate(backend: BackendConfig, config: AppConfig) -> AgentApp:
	global _backends
	key = (backend.type, backend.version)
	if key not in _backends:
		raise ValueError(f"Unsupported backend: {backend.type} {backend.version}")
	agent = App._backends[key](config, agent_index)
	return agent


class App:

	_backends: Dict[Tuple[str, str], Callable] = dict()


	@staticmethod
	def register(backend: BackendConfig, ctor: Callable) -> bool:
		key = (backend.type, backend.version)
		App._backends[key] = ctor
		return True


	@staticmethod
	def instantiate(backend: BackendConfig, config: AppConfig, agent_index: int) -> AgentApp:
		key = (backend.type, backend.version)
		if key not in App._backends:
			raise ValueError(f"Unsupported backend: {backend.type} {backend.version}")
		agent = App._backends[key](config, agent_index)
		return agent


	def __init__(self, config: AppConfig):
		try:
			config_copy = unroll_config(config)
			if not validate_config(config_copy):
				raise ValueError("Invalid app configuration")
		except Exception as e:
			raise ValueError(f"Error in config: {e}")

		apps = dict()
		for i, agent in enumerate(config_copy.agents):
			backend = config_copy.backends[agent.backend]
			if backend not in apps:
				apps[backend] = []
			apps[backend].append(i)

		agents = []
		for i, agent in enumerate(config_copy.agents):
			backend = config_copy.backends[agent.backend]
			try:
				agent = App.instantiate[(backend.type, backend.version)](config_copy, i)
			except Exception as e:
				log_print(f"Error creating agent {i}: {e}")
			agents.append(agent)

		self.config = config_copy
		self.agents = agents
