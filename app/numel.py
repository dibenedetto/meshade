import copy
import json
import os


from   collections.abc import Callable
from   datetime        import datetime
from   pydantic        import BaseModel
from   typing          import Any, Dict, List, Optional, Tuple, Union


BACKEND_TYPES             = ["agno"]
MODEL_TYPES               = ["ollama", "openai"]
EMBEDDING_TYPES           = ["ollama", "openai"]
CONTENT_DB_ENGINES        = ["sqlite"]
KNOWLEDGE_DB_ENGINES      = ["lancedb"]
KNOWLEDGE_DB_SEARCH_TYPES = ["hybrid"]


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

DEFAULT_MEMORY_CONTENT_DB_TABLE_NAME              : str  = "memory_content_table"
DEFAULT_SESSION_CONTENT_DB_TABLE_NAME             : str  = "session_content_table"
DEFAULT_KNOWLEDGE_CONTENT_DB_TABLE_NAME           : str  = "knowledge_content_table"
DEFAULT_KNOWLEDGE_INDEX_DB_TABLE_NAME             : str  = "knowledge_index_table"

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
	type : str = DEFAULT_MODEL_TYPE  # model provider name
	id   : str = DEFAULT_MODEL_ID    # model name (relative to embedder)


class ContentDBConfig(ConfigModel):
	engine               : str = DEFAULT_CONTENT_DB_ENGINE                # db engine name (eg. sqlite)
	url                  : str = DEFAULT_CONTENT_DB_URL                   # db url (eg. sqlite file path)
	memory_table_name    : str = DEFAULT_MEMORY_CONTENT_DB_TABLE_NAME     # name of the table to store memory content
	session_table_name   : str = DEFAULT_SESSION_CONTENT_DB_TABLE_NAME    # name of the table to store session content
	knowledge_table_name : str = DEFAULT_KNOWLEDGE_CONTENT_DB_TABLE_NAME  # name of the table to store knowledge content


class IndexDBConfig(ConfigModel):
	engine      : str = DEFAULT_INDEX_DB_ENGINE       # db engine name (eg. lancedb)
	url         : str = DEFAULT_INDEX_DB_URL          # db url (eg. lancedb folder path)
	search_type : str = DEFAULT_INDEX_DB_SEARCH_TYPE  # search type (eg. hybrid)


class PromptConfig(ConfigModel):
	model  : Union[ModelConfig, int] = None  # model to use for agentic knowledge processing
	prompt : str                     = None  # prompt for agentic knowledge processing


class KnowledgeConfig(ConfigModel):
	prompt     : Optional [Union [PromptConfig   , int]] = None  # prompt for knowledge processing
	content_db : Optional [Union [ContentDBConfig, int]] = None  # where to store knowledge content
	index_db   : Union    [IndexDBConfig, int          ] = None  # where to store knowledge index
	urls       : Optional [List  [str                 ]] = None  # urls to fetch knowledge from


class MemoryConfig(ConfigModel):
	prompt : Optional[Union[PromptConfig, int]] = None  # prompt for memory processing
	store  : bool = False
	use    : bool = False


class SessionConfig(ConfigModel):
	prompt : Optional[Union[PromptConfig, int]] = None  # prompt for session processing
	store  : bool = False
	use    : bool = False
	# session_history_size             : int  = 10
	# session_summary                   = session_summary_manager,
	# enable_session_summaries=True
	# read_chat_history=True
	# add_session_summary_to_context = True


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
	port                      : Optional[int] = None

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
	name         : Optional [str                             ] = None
	description  : Optional [str                             ] = None
	instructions : Optional [List  [str                     ]] = None
	options      : Optional [Union [AgentOptionsConfig , int]] = None
	backend      : Optional [Union [BackendConfig      , int]] = None
	model        : Optional [Union [ModelConfig        , int]] = None
	embedding    : Optional [Union [EmbeddingConfig    , int]] = None
	content_db   : Optional [Union [ContentDBConfig    , int]] = None
	memory       : Optional [Union [MemoryConfig       , int]] = None
	session      : Optional [Union [SessionConfig      , int]] = None
	tools        : Optional [List  [ToolConfig              ]] = None

	knowledge    : Optional [Union [
		Union [KnowledgeConfig, int       ],
		List  [Union[KnowledgeConfig, int]]
	]] = None


class TeamOptionsConfig(ConfigModel):
	tag : int = 0


class TeamConfig(ConfigModel):
	agents  : List[AgentConfig, int]
	options : Optional[Union[TeamOptionsConfig, int]] = None


class WorkflowOptionsConfig(ConfigModel):
	tag : int = 0


class WorkflowConfig(ConfigModel):
	tag     : int = 0
	options : Optional[Union[WorkflowOptionsConfig, int]] = None


class AppOptionsConfig(ConfigModel):
	port   : int           = DEFAULT_APP_PORT
	reload : bool          = DEFAULT_APP_RELOAD
	seed   : Optional[int] = None


class AppConfig(ConfigModel):
	version          : Optional[str                        ] = None
	name             : Optional[str                        ] = None
	author           : Optional[str                        ] = None
	description      : Optional[str                        ] = None
	options          : Optional[AppOptionsConfig           ] = None
	backends         : Optional[List[BackendConfig        ]] = None
	models           : Optional[List[ModelConfig          ]] = None
	embeddings       : Optional[List[EmbeddingConfig      ]] = None
	content_dbs      : Optional[List[ContentDBConfig      ]] = None
	index_dbs        : Optional[List[IndexDBConfig        ]] = None
	knowledges       : Optional[List[KnowledgeConfig      ]] = None
	memories         : Optional[List[MemoryConfig         ]] = None
	sessions         : Optional[List[SessionConfig        ]] = None
	tools            : Optional[List[ToolConfig           ]] = None
	agent_options    : Optional[List[AgentOptionsConfig   ]] = None
	agents           : Optional[List[AgentConfig          ]] = None
	team_options     : Optional[List[TeamOptionsConfig    ]] = None
	teams            : Optional[List[TeamConfig           ]] = None
	workflow_options : Optional[List[WorkflowOptionsConfig]] = None
	workflows        : Optional[List[WorkflowConfig       ]] = None


def validate_config(config: AppConfig) -> bool:
	# TODO: Implement validation logic
	if config is None:
		return False
	return True


# def unroll_config_uthe(config: AppConfig) -> AppConfig:
# 	config_copy = copy.deepcopy(config) if config is not None else AppConfig()

# 	if not config_copy.backends         : config_copy.backends         = []
# 	if not config_copy.models           : config_copy.models           = []
# 	if not config_copy.embeddings       : config_copy.embeddings       = []
# 	if not config_copy.content_dbs      : config_copy.content_dbs      = []
# 	if not config_copy.index_dbs        : config_copy.index_dbs        = []
# 	if not config_copy.knowledges       : config_copy.knowledges       = []
# 	if not config_copy.agent_options    : config_copy.agent_options    = []
# 	if not config_copy.agents           : config_copy.agents           = []
# 	if not config_copy.team_options     : config_copy.team_options     = []
# 	if not config_copy.teams            : config_copy.teams            = []
# 	if not config_copy.workflow_options : config_copy.workflow_options = []
# 	if not config_copy.workflows        : config_copy.workflows        = []

# 	if not config_copy.options:
# 		config_copy.options = AppOptionsConfig()

# 	shared_agent_options = None
# 	shared_backend       = None
# 	shared_model         = None
# 	shared_embedding     = None
# 	shared_content_db    = None
# 	shared_index_db      = None

# 	if not config_copy.agents:
# 		item = AgentConfig()
# 		config_copy.agents.append(item)

# 	for agent in config_copy.agents:
# 		if agent.options is None:
# 			if shared_agent_options is None:
# 				item = AgentOptionsConfig()
# 				config_copy.agent_options.append(item)
# 				shared_agent_options = len(config_copy.agent_options) - 1
# 			agent.options = shared_agent_options
# 		elif isinstance(agent.options, AgentOptionsConfig):
# 			config_copy.backends.append(agent.backend)
# 			agent.options = len(config_copy.backends) - 1
# 		if not isinstance(agent.options, int) or agent.options < 0 or agent.options >= len(config_copy.agent_options):
# 			raise ValueError("Invalid agent options")

# 		if agent.backend is None:
# 			if shared_backend is None:
# 				item = BackendConfig()
# 				config_copy.backends.append(item)
# 				shared_backend = len(config_copy.backends) - 1
# 			agent.backend = shared_backend
# 		elif isinstance(agent.backend, BackendConfig):
# 			config_copy.backends.append(agent.backend)
# 			agent.backend = len(config_copy.backends) - 1
# 		if not isinstance(agent.backend, int) or agent.backend < 0 or agent.backend >= len(config_copy.backends):
# 			raise ValueError("Invalid agent backend")

# 		if agent.model is None:
# 			if shared_model is None:
# 				item = ModelConfig()
# 				config_copy.models.append(item)
# 				shared_model = len(config_copy.models) - 1
# 			agent.model = shared_model
# 		elif isinstance(agent.model, ModelConfig):
# 			config_copy.models.append(agent.model)
# 			agent.model = len(config_copy.models) - 1
# 		if not isinstance(agent.model, int) or agent.model < 0 or agent.model >= len(config_copy.models):
# 			raise ValueError("Invalid agent model")

# 		if agent.embedding is None:
# 			if shared_embedding is None:
# 				item = EmbeddingConfig()
# 				config_copy.embeddings.append(item)
# 				shared_embedding = len(config_copy.embeddings) - 1
# 			agent.embedding = shared_embedding
# 		elif isinstance(agent.embedding, EmbeddingConfig):
# 			config_copy.embeddings.append(agent.embedding)
# 			agent.embedding = len(config_copy.embeddings) - 1
# 		if not isinstance(agent.embedding, int) or agent.embedding < 0 or agent.embedding >= len(config_copy.embeddings):
# 			raise ValueError("Invalid agent embedding")

# 			if shared_content_db is None:
# 				item = ContentDBConfig()
# 				config_copy.content_dbs.append(item)
# 				shared_content_db = len(config_copy.embeddings) - 1
# 			agent.content_db = shared_content_db

# 		if agent.content_db is not None:
# 			if isinstance(agent.content_db, ContentDBConfig):
# 				config_copy.content_dbs.append(agent.content_db)
# 				agent.content_db = len(config_copy.content_dbs) - 1
# 			if not isinstance(agent.content_db, int) or agent.content_db < 0 or agent.content_db >= len(config_copy.content_dbs):
# 				raise ValueError("Invalid agent content db")

# 		if agent.knowledge is not None:
# 			if not isinstance(agent.knowledge, list):
# 				raise ValueError("Invalid agent knowledge")
# 			knowledges = []
# 			for knowledge in agent.knowledge:
# 				if knowledge is None:
# 					continue
# 				if isinstance(knowledge, KnowledgeConfig):
# 					config_copy.knowledges.append(knowledge)
# 					knowledge = len(config_copy.knowledges) - 1
# 				if not isinstance(knowledge, int) or knowledge < 0 or knowledge >= len(config_copy.knowledges):
# 					raise ValueError("Invalid agent knowledge")
# 				knowledge = config_copy.knowledges[knowledge]
# 				if knowledge.content_db is None:
# 					db_url = f"{knowledge_db_url_base}{knowledge_db_index}"
# 					knowledge_db_index += 1
# 					item.db = KnowledgeDBConfig(db_url=db_url)
# 				if isinstance(item.db, KnowledgeDBConfig):
# 					config_copy.knowledge_dbs.append(item.db)
# 					item.db = len(config_copy.knowledge_dbs) - 1
# 				if not isinstance(item.db, int) or item.db >= len(config_copy.knowledge_dbs):
# 					raise ValueError("Invalid agent knowledge db")
# 				if item.model is not None:
# 					if isinstance(item.model, ModelConfig):
# 						config_copy.models.append(item.model)
# 						item.model = len(config_copy.models) - 1
# 					if not isinstance(item.model, int) or item.model >= len(config_copy.models):
# 						raise ValueError("Invalid agent knowledge model")
# 				agent_knowledge.append(knowledge)

# 			agent.knowledge = agent_knowledge if agent.knowledge else None



# 		agent_knowledge = []
# 		for knowledge in agent.knowledge:
# 			if knowledge is None:
# 				continue
# 			if isinstance(knowledge, KnowledgeConfig):
# 				config_copy.knowledges.append(knowledge)
# 				knowledge = len(config_copy.knowledges) - 1
# 			if not isinstance(knowledge, int) or knowledge >= len(config_copy.knowledges):
# 				raise ValueError("Invalid agent knowledge")
# 			item = config_copy.knowledges[knowledge]
# 			if item.db is None:
# 				db_url = f"{knowledge_db_url_base}{knowledge_db_index}"
# 				knowledge_db_index += 1
# 				item.db = KnowledgeDBConfig(db_url=db_url)
# 			if isinstance(item.db, KnowledgeDBConfig):
# 				config_copy.knowledge_dbs.append(item.db)
# 				item.db = len(config_copy.knowledge_dbs) - 1
# 			if not isinstance(item.db, int) or item.db >= len(config_copy.knowledge_dbs):
# 				raise ValueError("Invalid agent knowledge db")
# 			if item.model is not None:
# 				if isinstance(item.model, ModelConfig):
# 					config_copy.models.append(item.model)
# 					item.model = len(config_copy.models) - 1
# 				if not isinstance(item.model, int) or item.model >= len(config_copy.models):
# 					raise ValueError("Invalid agent knowledge model")
# 			agent_knowledge.append(knowledge)
# 		agent.knowledge = agent_knowledge
# 		if not agent.knowledge:
# 			agent.knowledge = None

# 		if agent.memory is not None:
# 			if isinstance(agent.memory, MemoryConfig):
# 				config_copy.memories.append(agent.memory)
# 				agent.memory = len(config_copy.memories) - 1
# 			if not isinstance(agent.memory, int) or agent.memory >= len(config_copy.memories):
# 				raise ValueError("Invalid agent memory")
# 			item = config_copy.memories[agent.memory]
# 			if item.db is None:
# 				db_url = f"{memory_db_url_base}{memory_db_index}"
# 				memory_db_index += 1
# 				item.db = MemoryDBConfig(db_url=db_url)
# 			if isinstance(item.db, MemoryDBConfig):
# 				config_copy.memory_dbs.append(item.db)
# 				item.db = len(config_copy.memory_dbs) - 1
# 			if not isinstance(item.db, int) or item.db >= len(config_copy.memory_dbs):
# 				raise ValueError("Invalid agent memory db")
# 			if item.model is not None:
# 				if isinstance(item.model, ModelConfig):
# 					config_copy.models.append(item.model)
# 					item.model = len(config_copy.models) - 1
# 				if not isinstance(item.model, int) or item.model >= len(config_copy.models):
# 					raise ValueError("Invalid agent memory model")
# 			if item.summarizer is not None:
# 				if isinstance(item.summarizer, ModelConfig):
# 					config_copy.models.append(item.summarizer)
# 					item.summarizer = len(config_copy.models) - 1
# 				if not isinstance(item.summarizer, int) or item.summarizer >= len(config_copy.models):
# 					raise ValueError("Invalid agent memory summarizer")

# 		if agent.storage is not None:
# 			if isinstance(agent.storage, StorageConfig):
# 				config_copy.storages.append(agent.storage)
# 				agent.storage = len(config_copy.storages) - 1
# 			if not isinstance(agent.storage, int) or agent.storage >= len(config_copy.storages):
# 				raise ValueError("Invalid agent storage")
# 			item = config_copy.storages[agent.storage]
# 			if item.db is None:
# 				db_url = f"{storage_db_url_base}{storage_db_index}"
# 				storage_db_index += 1
# 				item.db = StorageDBConfig(db_url=db_url)
# 			if isinstance(item.db, StorageDBConfig):
# 				config_copy.storage_dbs.append(item.db)
# 				item.db = len(config_copy.storage_dbs) - 1
# 			if not isinstance(item.db, int) or item.db >= len(config_copy.storage_dbs):
# 				raise ValueError("Invalid agent storage db")

# 		if agent.options is None:
# 			agent.options = shared_agent_options
# 		if isinstance(agent.options, AgentOptionsConfig):
# 			config_copy.agent_options.append(agent.agent_options)
# 			agent.options = len(config_copy.agent_options) - 1
# 		if not isinstance(agent.options, int) or agent.options >= len(config_copy.agent_options):
# 			raise ValueError("Invalid agent options")

# 		if not agent.tools:
# 			agent.tools = None

# 	return config_copy


def unroll_config(config: AppConfig) -> AppConfig:
	config_copy = copy.deepcopy(config) if config is not None else AppConfig()

	if not config_copy.backends         : config_copy.backends         = []
	if not config_copy.models           : config_copy.models           = []
	if not config_copy.embeddings       : config_copy.embeddings       = []
	if not config_copy.content_dbs      : config_copy.content_dbs      = []
	if not config_copy.index_dbs        : config_copy.index_dbs        = []
	if not config_copy.knowledges       : config_copy.knowledges       = []
	if not config_copy.memories         : config_copy.memories         = []
	if not config_copy.sessions         : config_copy.sessions         = []
	if not config_copy.tools            : config_copy.tools            = []
	if not config_copy.agent_options    : config_copy.agent_options    = []
	if not config_copy.agents           : config_copy.agents           = []
	if not config_copy.team_options     : config_copy.team_options     = []
	if not config_copy.teams            : config_copy.teams            = []
	if not config_copy.workflow_options : config_copy.workflow_options = []
	if not config_copy.workflows        : config_copy.workflows        = []

	if not config_copy.options:
		config_copy.options = AppOptionsConfig()

	shared_agent_options = None
	shared_backend       = None
	shared_model         = None
	shared_embedding     = None
	shared_content_db    = None
	shared_index_db      = None

	for agent in config_copy.agents:
		if agent.options is None:
			if shared_agent_options is None:
				item = AgentOptionsConfig()
				config_copy.agent_options.append(item)
				shared_agent_options = len(config_copy.agent_options) - 1
			agent.options = shared_agent_options
		elif isinstance(agent.options, AgentOptionsConfig):
			config_copy.backends.append(agent.backend)
			agent.options = len(config_copy.backends) - 1
		if not isinstance(agent.options, int) or agent.options < 0 or agent.options >= len(config_copy.agent_options):
			raise ValueError("Invalid agent options")

		if agent.backend is None:
			if shared_backend is None:
				item = BackendConfig()
				config_copy.backends.append(item)
				shared_backend = len(config_copy.backends) - 1
			agent.backend = shared_backend
		elif isinstance(agent.backend, BackendConfig):
			config_copy.backends.append(agent.backend)
			agent.backend = len(config_copy.backends) - 1
		if not isinstance(agent.backend, int) or agent.backend < 0 or agent.backend >= len(config_copy.backends):
			raise ValueError("Invalid agent backend")

		if agent.model is None:
			if shared_model is None:
				item = ModelConfig()
				config_copy.models.append(item)
				shared_model = len(config_copy.models) - 1
			agent.model = shared_model
		elif isinstance(agent.model, ModelConfig):
			config_copy.models.append(agent.model)
			agent.model = len(config_copy.models) - 1
		if not isinstance(agent.model, int) or agent.model < 0 or agent.model >= len(config_copy.models):
			raise ValueError("Invalid agent model")

		if agent.embedding is None:
			if shared_embedding is None:
				item = EmbeddingConfig()
				config_copy.embeddings.append(item)
				shared_embedding = len(config_copy.embeddings) - 1
			agent.embedding = shared_embedding
		elif isinstance(agent.embedding, EmbeddingConfig):
			config_copy.embeddings.append(agent.embedding)
			agent.embedding = len(config_copy.embeddings) - 1
		if not isinstance(agent.embedding, int) or agent.embedding < 0 or agent.embedding >= len(config_copy.embeddings):
			raise ValueError("Invalid agent embedding")

		if agent.content_db is not None:
			if isinstance(agent.content_db, ContentDBConfig):
				config_copy.content_dbs.append(agent.content_db)
				agent.content_db = len(config_copy.content_dbs) - 1
			if not isinstance(agent.content_db, int) or agent.content_db < 0 or agent.content_db >= len(config_copy.content_dbs):
				raise ValueError("Invalid agent content db")

		if agent.knowledge is not None:
			if not isinstance(agent.knowledge, list):
				agent.knowledge = [agent.knowledge]
			agent_knowledge = []
			for knowledge in agent.knowledge:
				if knowledge is None:
					continue
				if isinstance(knowledge, KnowledgeConfig):
					config_copy.knowledges.append(knowledge)
					knowledge = len(config_copy.knowledges) - 1
				if not isinstance(knowledge, int) or knowledge < 0 or knowledge >= len(config_copy.knowledges):
					raise ValueError("Invalid agent knowledge")
				item = config_copy.knowledges[knowledge]
				if item.content_db is not None:
					if isinstance(item.content_db, ContentDBConfig):
						config_copy.knowledges.append(knowledge)
						item.content_db = len(config_copy.content_dbs) - 1
					if not isinstance(item.content_db, int) or item.content_db < 0 or item.content_db >= len(config_copy.content_dbs):
						raise ValueError("Invalid agent knowledge content db")
				if item.index_db is None:
					item.index_db = 
					if isinstance(item.content_db, ContentDBConfig):
						config_copy.knowledges.append(knowledge)
						item.content_db = len(config_copy.content_dbs) - 1
					if not isinstance(item.content_db, int) or item.content_db < 0 or item.content_db >= len(config_copy.content_dbs):
						raise ValueError("Invalid agent knowledge content db")

					db_url = f"{knowledge_db_url_base}{knowledge_db_index}"
					knowledge_db_index += 1
					item.db = KnowledgeDBConfig(db_url=db_url)
				if isinstance(item.db, KnowledgeDBConfig):
					config_copy.knowledge_dbs.append(item.db)
					item.db = len(config_copy.knowledge_dbs) - 1
				if not isinstance(item.db, int) or item.db >= len(config_copy.knowledge_dbs):
					raise ValueError("Invalid agent knowledge db")
				if item.model is not None:
					if isinstance(item.model, ModelConfig):
						config_copy.models.append(item.model)
						item.model = len(config_copy.models) - 1
					if not isinstance(item.model, int) or item.model >= len(config_copy.models):
						raise ValueError("Invalid agent knowledge model")
				agent_knowledge.append(knowledge)
			agent.knowledge = agent_knowledge
			if not agent.knowledge:
				agent.knowledge = None




	memory       : Optional [Union [MemoryConfig       , int]] = None
	session      : Optional [Union [SessionConfig      , int]] = None
	tools        : Optional [List  [ToolConfig              ]] = None

	knowledge    : Optional [Union [






		if agent.memory is not None:
			if isinstance(agent.memory, MemoryConfig):
				config_copy.memories.append(agent.memory)
				agent.memory = len(config_copy.memories) - 1
			if not isinstance(agent.memory, int) or agent.memory >= len(config_copy.memories):
				raise ValueError("Invalid agent memory")
			item = config_copy.memories[agent.memory]
			if item.db is None:
				db_url = f"{memory_db_url_base}{memory_db_index}"
				memory_db_index += 1
				item.db = MemoryDBConfig(db_url=db_url)
			if isinstance(item.db, MemoryDBConfig):
				config_copy.memory_dbs.append(item.db)
				item.db = len(config_copy.memory_dbs) - 1
			if not isinstance(item.db, int) or item.db >= len(config_copy.memory_dbs):
				raise ValueError("Invalid agent memory db")
			if item.model is not None:
				if isinstance(item.model, ModelConfig):
					config_copy.models.append(item.model)
					item.model = len(config_copy.models) - 1
				if not isinstance(item.model, int) or item.model >= len(config_copy.models):
					raise ValueError("Invalid agent memory model")
			if item.summarizer is not None:
				if isinstance(item.summarizer, ModelConfig):
					config_copy.models.append(item.summarizer)
					item.summarizer = len(config_copy.models) - 1
				if not isinstance(item.summarizer, int) or item.summarizer >= len(config_copy.models):
					raise ValueError("Invalid agent memory summarizer")

		if agent.storage is not None:
			if isinstance(agent.storage, StorageConfig):
				config_copy.storages.append(agent.storage)
				agent.storage = len(config_copy.storages) - 1
			if not isinstance(agent.storage, int) or agent.storage >= len(config_copy.storages):
				raise ValueError("Invalid agent storage")
			item = config_copy.storages[agent.storage]
			if item.db is None:
				db_url = f"{storage_db_url_base}{storage_db_index}"
				storage_db_index += 1
				item.db = StorageDBConfig(db_url=db_url)
			if isinstance(item.db, StorageDBConfig):
				config_copy.storage_dbs.append(item.db)
				item.db = len(config_copy.storage_dbs) - 1
			if not isinstance(item.db, int) or item.db >= len(config_copy.storage_dbs):
				raise ValueError("Invalid agent storage db")

		if agent.options is None:
			agent.options = shared_agent_options
		if isinstance(agent.options, AgentOptionsConfig):
			config_copy.agent_options.append(agent.agent_options)
			agent.options = len(config_copy.agent_options) - 1
		if not isinstance(agent.options, int) or agent.options >= len(config_copy.agent_options):
			raise ValueError("Invalid agent options")

		if not agent.tools:
			agent.tools = None

	return config_copy


def load_config(file_path: str) -> AppConfig:
	try:
		with open(file_path, "r") as f:
			data = json.load(f)
		config = AppConfig(**data)
		return config
	except Exception as e:
		print(f"Error loading config: {e}")
		return None


def compatible_backends(bk1: BackendConfig, bk2: BackendConfig):
	# TODO
	return bk1.type == bk2.type and bk1.version == bk2.version


def seed_everything(seed: int = DEFAULT_SEED):
	if seed is None:
		seed = DEFAULT_SEED
	elif seed < 0:
		seed = int(datetime.now()) % (2**32)

	os.environ['PYTHONHASHSEED'] = str(seed)

	try:
		import numpy
		numpy.random.seed(seed)
	except:
		pass

	try:
		import torch
		torch .manual_seed(seed)
		torch .cuda.manual_seed(seed)
		torch .cuda.manual_seed_all(seed)
		torch .backends.cudnn.deterministic = True
	except:
		pass


def get_time_str() -> str:
	now = datetime.now()
	res = now.strftime("%Y-%m-%d %H:%M:%S")
	return res


def module_prop_str(file_path: str, property_name: str) -> str:
	module_name = os.path.splitext(os.path.basename(file_path))[0]
	res         = f"{module_name}:{property_name}"
	return res


class AgentApp:

	def __init__(self, config: AppConfig, agent_index: int, port_offset: int):
		if agent_index < 0 or agent_index >= len(config.agents) or port_offset <= 0:
			raise ValueError("Invalid Agno app configuration")

		self.config      = copy.deepcopy(config)
		self.agent_index = agent_index
		self.port_offset = port_offset


	def is_valid(self) -> bool:
		raise NotImplementedError("Subclasses must implement the is_valid method.")


	def generate_app(self) -> Any:
		raise NotImplementedError("Subclasses must implement the generate_app method.")


	def launch(self, app: str) -> None:
		raise NotImplementedError("Subclasses must implement the launch method.")


class App:

	_backends: Dict[Tuple[str, str], Callable] = dict()


	@staticmethod
	def register(name: str, version: str, backend: Callable) -> bool:
		App._backends[(name, version)] = backend
		return True


	def __init__(self, config: AppConfig):
		if not validate_config(config):
			raise ValueError("Invalid app configuration")

		try:
			config_copy = unroll_config(config)
		except Exception as e:
			raise ValueError(f"Error unrolling config: {e}")

		agents = []
		for i, agent in enumerate(config_copy.agents):
			backend = config_copy.backends[agent.backend]
			agent   = App._backends[(backend.type, backend.version)](config_copy, i, i + 1)
			if agent.is_valid():
				agents.append(agent)

		self.agents = agents
		self.config = config_copy


	def is_valid(self) -> bool:
		return len(self.agents) != 0
