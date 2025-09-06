import copy
import json
import os


from   collections.abc import Callable
from   pydantic        import BaseModel
from   typing          import Any, Dict, List, Optional, Required, Tuple, Union


BACKEND_TYPES             = ["agno"]
MODEL_TYPES               = ["ollama", "openai"]
EMBEDDING_TYPES           = ["ollama", "openai"]
KNOWLEDGE_DB_TYPES        = ["lancedb"]
KNOWLEDGE_DB_SEARCH_TYPES = ["hybrid"]
KNOWLEDGE_TYPES           = ["knowledge"]
MEMORY_DB_TYPES           = ["sqlite"]
MEMORY_TYPES              = ["memory"]
STORAGE_DB_TYPES          = ["sqlite"]
STORAGE_TYPES             = ["storage"]


DEFAULT_SEED                                      : int  = 42

DEFAULT_API_KEY                                   : str  = None

DEFAULT_BACKEND_TYPE                              : str  = "agno"
DEFAULT_BACKEND_VERSION                           : str  = ""

DEFAULT_MODEL_TYPE                                : str  = "ollama"
DEFAULT_MODEL_ID                                  : str  = "mistral"

DEFAULT_EMBEDDING_TYPE                            : str  = "ollama"
DEFAULT_EMBEDDING_ID                              : str  = "mistral"

DEFAULT_KNOWLEDGE_DB_TYPE                         : str  = "lancedb"
DEFAULT_KNOWLEDGE_DB_TABLE_NAME                   : str  = "knowledge"
DEFAULT_KNOWLEDGE_DB_URL                          : str  = "storage/knowledge"
DEFAULT_KNOWLEDGE_DB_SEARCH_TYPE                  : str  = "hybrid"

DEFAULT_KNOWLEDGE_TYPE                            : str  = "knowledge"

DEFAULT_MEMORY_DB_TYPE                            : str  = "sqlite"
DEFAULT_MEMORY_DB_TABLE_NAME                      : str  = "memory"
DEFAULT_MEMORY_DB_URL                             : str  = "storage/memory"

DEFAULT_MEMORY_TYPE                               : str  = "memory"

DEFAULT_STORAGE_DB_TYPE                           : str  = "sqlite"
DEFAULT_STORAGE_DB_TABLE_NAME                     : str  = "session"
DEFAULT_STORAGE_DB_URL                            : str  = "storage/session"

DEFAULT_STORAGE_TYPE                              : str  = "storage"

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


class BackendConfig(BaseModel):
	type    : str = DEFAULT_BACKEND_TYPE
	version : str = DEFAULT_BACKEND_VERSION


class ModelConfig(BaseModel):
	type    : str           = DEFAULT_MODEL_TYPE
	id      : str           = DEFAULT_MODEL_ID
	path    : Optional[str] = None
	wrapper : Optional[str] = None
	version : Optional[str] = None
	name    : Optional[str] = None
	author  : Optional[str] = None
	source  : Optional[str] = None
	data    : Optional[Any] = None


class EmbeddingConfig(BaseModel):
	type    : str           = DEFAULT_EMBEDDING_TYPE
	id      : str           = DEFAULT_EMBEDDING_ID
	path    : Optional[str] = None
	wrapper : Optional[str] = None
	version : Optional[str] = None
	name    : Optional[str] = None
	author  : Optional[str] = None
	source  : Optional[str] = None
	data    : Optional[Any] = None


class KnowledgeDBConfig(BaseModel):
	type        : str           = DEFAULT_KNOWLEDGE_DB_TYPE
	table_name  : str           = DEFAULT_KNOWLEDGE_DB_TABLE_NAME
	db_url      : str           = DEFAULT_KNOWLEDGE_DB_URL
	search_type : str           = DEFAULT_KNOWLEDGE_DB_SEARCH_TYPE
	data        : Optional[Any] = None


class KnowledgeConfig(BaseModel):
	type  : str                                     = DEFAULT_KNOWLEDGE_TYPE
	db    : Optional[Union[KnowledgeDBConfig, int]] = None
	model : Optional[Union[ModelConfig, int]]       = None
	urls  : Optional[List[str]]                     = None
	data  : Optional[Any]                           = None


class MemoryDBConfig(BaseModel):
	type       : str           = DEFAULT_MEMORY_DB_TYPE
	table_name : str           = DEFAULT_MEMORY_DB_TABLE_NAME
	db_url     : str           = DEFAULT_MEMORY_DB_URL
	data       : Optional[Any] = None


class MemoryConfig(BaseModel):
	type       : str                                  = DEFAULT_MEMORY_TYPE
	db         : Optional[Union[MemoryDBConfig, int]] = None
	model      : Optional[Union[ModelConfig, int]]    = None
	summarizer : Optional[Union[ModelConfig, int]]    = None
	data       : Optional[Any]                        = None


class StorageDBConfig(BaseModel):
	type       : str           = DEFAULT_STORAGE_DB_TYPE
	table_name : str           = DEFAULT_STORAGE_DB_TABLE_NAME
	db_url     : str           = DEFAULT_STORAGE_DB_URL
	data       : Optional[Any] = None


class StorageConfig(BaseModel):
	type : str                                   = DEFAULT_STORAGE_TYPE
	db   : Optional[Union[StorageDBConfig, int]] = None
	data : Optional[Any]                         = None


class ToolConfig(BaseModel):
	type : str                      = Required
	args : Optional[Dict[str, Any]] = None
	ref  : Optional[str]            = None
	data : Optional[Any]            = None


class OptionsConfig(BaseModel):
	markdown                         : bool          = DEFAULT_OPTIONS_MARKDOWN
	search_knowledge                 : bool          = DEFAULT_OPTIONS_SEARCH_KNOWLEDGE
	enable_agentic_memory            : bool          = DEFAULT_OPTIONS_ENABLE_AGENTIC_MEMORY
	add_history_to_messages          : bool          = DEFAULT_OPTIONS_ADD_HISTORY_TO_MESSAGES
	num_history_runs                 : int           = DEFAULT_OPTIONS_NUM_HISTORY_RUNS
	enable_session_summaries         : bool          = DEFAULT_OPTIONS_ENABLE_SESSION_SUMMARIES
	search_previous_sessions_history : bool          = DEFAULT_OPTIONS_SEARCH_PREVIOUS_SESSIONS_HISTORY
	num_history_sessions             : int           = DEFAULT_OPTIONS_NUM_HISTORY_SESSIONS
	show_tool_calls                  : bool          = DEFAULT_OPTIONS_SHOW_TOOL_CALLS
	tool_call_limit                  : int           = DEFAULT_OPTIONS_TOOL_CALL_LIMIT
	reasoning                        : bool          = DEFAULT_OPTIONS_REASONING
	stream_intermediate_steps        : bool          = DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS
	data                             : Optional[Any] = None


class AgentConfig(BaseModel):
	backend      : Optional[Union[BackendConfig, int]]         = None
	model        : Optional[Union[ModelConfig, int]]           = None
	embedding    : Optional[Union[EmbeddingConfig, int]]       = None
	options      : Optional[Union[OptionsConfig, int]]         = None
	version      : Optional[str]                               = None
	name         : Optional[str]                               = None
	author       : Optional[str]                               = None
	port         : Optional[int]                               = None
	description  : Optional[str]                               = None
	instructions : Optional[List[str]]                         = None
	knowledge    : Optional[List[Union[KnowledgeConfig, int]]] = None
	memory       : Optional[Union[MemoryConfig, int]]          = None
	storage      : Optional[Union[StorageConfig, int]]         = None
	tools        : Optional[List[ToolConfig]]                  = None
	data         : Optional[Any]                               = None


class AppConfig(BaseModel):
	port          : int                                 = DEFAULT_APP_PORT
	reload        : bool                                = DEFAULT_APP_RELOAD
	backend       : Optional[Union[BackendConfig, int]] = None
	version       : Optional[str]                       = None
	name          : Optional[str]                       = None
	author        : Optional[str]                       = None
	description   : Optional[str]                       = None
	backends      : Optional[List[BackendConfig]]       = None
	models        : Optional[List[ModelConfig]]         = None
	embeddings    : Optional[List[EmbeddingConfig]]     = None
	knowledge_dbs : Optional[List[KnowledgeDBConfig]]   = None
	knowledges    : Optional[List[KnowledgeConfig]]     = None
	memory_dbs    : Optional[List[MemoryDBConfig]]      = None
	memories      : Optional[List[MemoryConfig]]        = None
	storage_dbs   : Optional[List[StorageDBConfig]]     = None
	storages      : Optional[List[StorageConfig]]       = None
	options       : Optional[List[OptionsConfig]]       = None
	agents        : Optional[List[AgentConfig]]         = None
	seed          : Optional[int]                       = None
	data          : Optional[Any]                       = None


def validate_config(config: AppConfig) -> bool:
	# TODO: Implement validation logic
	if config is None:
		return False
	return True


# def unroll_config_mod(config: AppConfig) -> AppConfig:
# 	config_copy = copy.deepcopy(config) if config is not None else AppConfig()

# 	if True:
# 		if not config_copy.backends      : config_copy.backends      = []
# 		if not config_copy.models        : config_copy.models        = []
# 		if not config_copy.embeddings    : config_copy.embeddings    = []
# 		if not config_copy.knowledge_dbs : config_copy.knowledge_dbs = []
# 		if not config_copy.knowledges    : config_copy.knowledges    = []
# 		if not config_copy.memory_dbs    : config_copy.memory_dbs    = []
# 		if not config_copy.memories      : config_copy.memories      = []
# 		if not config_copy.storage_dbs   : config_copy.storage_dbs   = []
# 		if not config_copy.storages      : config_copy.storages      = []
# 		if not config_copy.options       : config_copy.options       = []
# 		if not config_copy.agents        : config_copy.agents        = []


# 	if True:
# 		max_backends      = len(config_copy.backends)
# 		max_models        = len(config_copy.models)
# 		max_embeddings    = len(config_copy.embeddings)
# 		max_knowledge_dbs = len(config_copy.knowledge_dbs)
# 		max_knowledges    = len(config_copy.knowledges)
# 		max_memory_dbs    = len(config_copy.memory_dbs)
# 		max_memories      = len(config_copy.memories)
# 		max_storage_dbs   = len(config_copy.storage_dbs)
# 		max_storages      = len(config_copy.storages)
# 		max_options       = len(config_copy.options)
# 		max_agents        = len(config_copy.agents)


# 	if True:
# 		item = BackendConfig()
# 		config_copy.backends.append(item)
# 		shared_backend_index = len(config_copy.backends) - 1

# 		item = ModelConfig()
# 		config_copy.models.append(item)
# 		shared_model_index = len(config_copy.models) - 1

# 		item = EmbeddingConfig()
# 		config_copy.embeddings.append(item)
# 		shared_embedding_index = len(config_copy.embeddings) - 1

# 		item = OptionsConfig()
# 		config_copy.options.append(item)
# 		shared_options_index = len(config_copy.options) - 1


# 	if True:
# 		if config_copy.backend is None:
# 			config_copy.backend = shared_backend_index
# 		elif isinstance(config_copy.backend, BackendConfig):
# 			config_copy.backends.append(config_copy.backend)
# 			config_copy.backend = len(config_copy.backends) - 1
# 		elif isinstance(config_copy.backend, int):
# 			if config_copy.backend >= max_backends:
# 				raise ValueError("Invalid app backend")


# 	if True:
# 		# knowledge_dbs
# 		pass


def unroll_config(config: AppConfig) -> AppConfig:
	config_copy = copy.deepcopy(config) if config is not None else AppConfig()

	if not config_copy.backends      : config_copy.backends      = []
	if not config_copy.models        : config_copy.models        = []
	if not config_copy.embeddings    : config_copy.embeddings    = []
	if not config_copy.knowledge_dbs : config_copy.knowledge_dbs = []
	if not config_copy.knowledges    : config_copy.knowledges    = []
	if not config_copy.memory_dbs    : config_copy.memory_dbs    = []
	if not config_copy.memories      : config_copy.memories      = []
	if not config_copy.storage_dbs   : config_copy.storage_dbs   = []
	if not config_copy.storages      : config_copy.storages      = []
	if not config_copy.options       : config_copy.options       = []
	if not config_copy.agents        : config_copy.agents        = []

	max_backends      = len(config_copy.backends)
	max_models        = len(config_copy.models)
	max_embeddings    = len(config_copy.embeddings)
	max_knowledge_dbs = len(config_copy.knowledge_dbs)
	max_knowledges    = len(config_copy.knowledges)
	max_memory_dbs    = len(config_copy.memory_dbs)
	max_memories      = len(config_copy.memories)
	max_storage_dbs   = len(config_copy.storage_dbs)
	max_storages      = len(config_copy.storages)
	max_options       = len(config_copy.options)
	max_agents        = len(config_copy.agents)

	item = BackendConfig()
	config_copy.backends.append(item)
	shared_backend = len(config_copy.backends) - 1

	item = ModelConfig()
	config_copy.models.append(item)
	shared_model = len(config_copy.models) - 1

	item = EmbeddingConfig()
	config_copy.embeddings.append(item)
	shared_embedding = len(config_copy.embeddings) - 1

	item = OptionsConfig()
	config_copy.options.append(item)
	shared_options = len(config_copy.options) - 1

	if not config_copy.agents:
		config_copy.agents.append(AgentConfig())

	knowledge_db_url_base = None
	knowledge_db_index    = 0
	if True:
		db_url_len = 0
		for db in config_copy.knowledge_dbs:
			if getattr(db, "_counter", 0) != 0 and db.db_url:
				db_url_len = max(db_url_len, len(db.db_url))
		knowledge_db_url_base = "default_" + ("_" * db_url_len)

	memory_db_url_base = None
	memory_db_index    = 0
	if True:
		db_url_len = 0
		for db in config_copy.memory_dbs:
			if getattr(db, "_counter", 0) != 0 and db.db_url:
				db_url_len = max(db_url_len, len(db.db_url))
		memory_db_url_base = "default_" + ("_" * db_url_len)

	storage_db_url_base = None
	storage_db_index    = 0
	if True:
		db_url_len = 0
		for db in config_copy.storage_dbs:
			if getattr(db, "_counter", 0) != 0 and db.db_url:
				db_url_len = max(db_url_len, len(db.db_url))
		storage_db_url_base = "default_" + ("_" * db_url_len)

	if config_copy.backend is None:
		config_copy.backend = shared_backend
	elif isinstance(config_copy.backend, BackendConfig):
		config_copy.backends.append(config_copy.backend)
		config_copy.backend = len(config_copy.backends) - 1
	if not isinstance(config_copy.backend, int) or config_copy.backend >= len(config_copy.backends):
		raise ValueError("Invalid app backend")

	for agent in config_copy.agents:
		agent.port = None

		if agent.backend is None:
			agent.backend = shared_backend
		elif isinstance(agent.backend, BackendConfig):
			config_copy.backends.append(agent.backend)
			agent.backend = len(config_copy.backends) - 1
		if not isinstance(agent.backend, int) or agent.backend >= len(config_copy.backends):
			raise ValueError("Invalid agent backend")

		if agent.model is None:
			agent.model = shared_model
		elif isinstance(agent.model, ModelConfig):
			config_copy.models.append(agent.model)
			agent.model = len(config_copy.models) - 1
		if not isinstance(agent.model, int) or agent.model >= len(config_copy.models):
			raise ValueError("Invalid agent model")

		if agent.embedding is None:
			agent.embedding = shared_embedding
		elif isinstance(agent.embedding, EmbeddingConfig):
			config_copy.embeddings.append(agent.embedding)
			agent.embedding = len(config_copy.embeddings) - 1
		if not isinstance(agent.embedding, int) or agent.embedding >= len(config_copy.embeddings):
			raise ValueError("Invalid agent embedding")

		if not isinstance(agent.knowledge, list):
			agent.knowledge = [agent.knowledge]
		agent_knowledge = []
		for knowledge in agent.knowledge:
			if knowledge is None:
				continue
			if isinstance(knowledge, KnowledgeConfig):
				config_copy.knowledges.append(knowledge)
				knowledge = len(config_copy.knowledges) - 1
			if not isinstance(knowledge, int) or knowledge >= len(config_copy.knowledges):
				raise ValueError("Invalid agent knowledge")
			item = config_copy.knowledges[knowledge]
			if item.db is None:
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
			agent.options = shared_options
		if isinstance(agent.options, OptionsConfig):
			config_copy.options.append(agent.options)
			agent.options = len(config_copy.options) - 1
		if not isinstance(agent.options, int) or agent.options >= len(config_copy.options):
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
	from datetime import datetime
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

		config_copy = unroll_config(config)

		agents = []
		for i, agent in enumerate(config.agents):
			backend = config_copy.backends[agent.backend]
			agent   = App._backends[(backend.type, backend.version)](config_copy, i, i + 1)
			if agent.is_valid():
				agents.append(agent)

		self.agents = agents
		self.config = config


	def is_valid(self) -> bool:
		return len(self.agents) != 0


	# def generate_app(self) -> Any:
	# 	apps = [agent.generate_app() for agent in self.agents]
	# 	return apps


	# def launch(self, app: str) -> None:
	# 	self.d.launch(app)
