# agno_impl

import os

from   typing                    import Any


from   agno.agent                import Agent
from   agno.app.agui.app         import AGUIApp
# from   agno.knowledge.combined   import CombinedKnowledgeBase
from   agno.knowledge.pdf_url    import PDFUrlKnowledgeBase
from   agno.memory.v2.db.sqlite  import SqliteMemoryDb
from   agno.memory.v2.memory     import Memory
from   agno.memory.v2.summarizer import SessionSummarizer
from   agno.models.ollama        import Ollama
from   agno.models.openai        import OpenAIChat
from   agno.storage.sqlite       import SqliteStorage
from   agno.tools.duckduckgo     import DuckDuckGoTools
from   agno.tools.reasoning      import ReasoningTools
from   agno.vectordb.lancedb     import LanceDb
from   agno.vectordb.search      import SearchType


from   numel                     import (
	DEFAULT_KNOWLEDGE_DB_TYPE,
	DEFAULT_KNOWLEDGE_TYPE,
	DEFAULT_MEMORY_DB_TYPE,
	DEFAULT_MEMORY_TYPE,
	DEFAULT_STORAGE_DB_TYPE,
	DEFAULT_STORAGE_TYPE,
	DEFAULT_OPTIONS_MAX_WEB_SEARCH_RESULTS,
	AppConfig,
	AgentApp,
	BackendConfig,
	ModelConfig,
	AgentOptionsConfig,
	register_backend
)


def _validate_config(config: AppConfig) -> bool:
	# TODO: Implement validation logic for the Agno app configuration
	return config is not None


class _AgnoAgentApp(AgentApp):

	def _build_model(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class ModelConfig(ConfigModel):
		# 	type : str = DEFAULT_MODEL_TYPE  # model provider name
		# 	id   : str = DEFAULT_MODEL_ID    # model name (relative to llm)
		return None


	def _build_embedding(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class ModelConfig(ConfigModel):
		#	type : str = DEFAULT_EMBEDDING_TYPE  # embedding provider name
		#	id   : str = DEFAULT_EMBEDDING_TYPE  # embedding name (relative to embedder)
		return None


	def _build_prompt(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class PromptConfig(ConfigModel):
		# 	model        : Optional[Union[ModelConfig    , int]] = None  # model to use for agentic knowledge processing
		# 	embedding    : Optional[Union[EmbeddingConfig, int]] = None  # embedding to use for agentic knowledge processing
		# 	description  : Optional[str]                         = None
		# 	instructions : Optional[List[str]]                   = None
		# 	override     : Optional[str]                         = None  # override prompt template
		return None


	def _build_content_db(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class ContentDBConfig(ConfigModel):
		# 	engine               : str = DEFAULT_CONTENT_DB_ENGINE                      # db engine name (eg. sqlite)
		# 	url                  : str = DEFAULT_CONTENT_DB_URL                         # db url (eg. sqlite file path)
		# 	memory_table_name    : str = DEFAULT_MEMORY_MANAGER_CONTENT_DB_TABLE_NAME   # name of the table to store memory content
		# 	session_table_name   : str = DEFAULT_SESSION_MANAGER_CONTENT_DB_TABLE_NAME  # name of the table to store session content
		# 	knowledge_table_name : str = DEFAULT_KNOWLEDGE_BASE_CONTENT_DB_TABLE_NAME   # name of the table to store knowledge base content
		return None


	def _build_index_db(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class IndexDBConfig(ConfigModel):
		# 	engine      : str = DEFAULT_CONTENT_DB_ENGINE                      # db engine name (eg. sqlite)
		# 	url         : str = DEFAULT_CONTENT_DB_URL                         # db url (eg. sqlite file path)
		# 	search_type : str = DEFAULT_INDEX_DB_SEARCH_TYPE  # search type (eg. hybrid)
		return None


	def _build_memory_manager(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class MemoryManagerConfig(ConfigModel):
		# 	prompt : Optional[Union[PromptConfig, int]] = None  # prompt for memory processing
		# 	store  : bool                               = False
		# 	use    : bool                               = False
		return None


	def _build_session_manager(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class SessionManagerConfig(ConfigModel):
		# 	prompt       : Optional[Union[PromptConfig, int]] = None  # prompt for session processing
		# 	store        : bool                               = False
		# 	use          : bool                               = False
		# 	history_size : int                                = 10
		# 	# summary      : session_summary_manager,
		# 	# read_chat_history=True
		# 	# add_session_summary_to_context = True
		# 	# enable_session_summaries=True
		return None


	def _build_knowledge_base(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class KnowledgeBaseConfig(ConfigModel):
		# 	content_db : Optional [Union [ContentDBConfig, int]] = None  # where to store knowledge content
		# 	index_db   : Union    [IndexDBConfig, int          ] = None  # where to store knowledge index
		# 	urls       : Optional [List  [str                 ]] = None  # urls to fetch knowledge from
		return None


	def _build_knowledge_manager(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class KnowledgeManagerConfig(ConfigModel):
		# 	prompt : Optional [Union[PromptConfig, int]]              = None  # prompt for knowledge processing
		# 	bases  : Optional [List[Union[KnowledgeBaseConfig, int]]] = None
		# 	use    : bool                                             = False
		return None


	def _build_tool(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class ToolConfig(ConfigModel):
		# 	type : str
		# 	args : Optional[Dict[str, Any]] = None
		# 	ref  : Optional[str           ] = None
		return None


	def _build_agent(self, config: AppConfig, agent_index: int, index: int) -> Any:
		# class AgentOptionsConfig(ConfigModel):
		# 	markdown                  : bool = DEFAULT_OPTIONS_MARKDOWN
		# 	show_tool_calls           : bool = DEFAULT_OPTIONS_SHOW_TOOL_CALLS
		# 	tool_call_limit           : int  = DEFAULT_OPTIONS_TOOL_CALL_LIMIT
		# 	reasoning                 : bool = DEFAULT_OPTIONS_REASONING
		# 	stream_intermediate_steps : bool = DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS

		# 	# search_knowledge                 : bool = DEFAULT_OPTIONS_SEARCH_KNOWLEDGE
		# 	# enable_agentic_memory            : bool = DEFAULT_OPTIONS_ENABLE_AGENTIC_MEMORY
		# 	# add_history_to_messages          : bool = DEFAULT_OPTIONS_ADD_HISTORY_TO_MESSAGES
		# 	# num_history_runs                 : int  = DEFAULT_OPTIONS_NUM_HISTORY_RUNS
		# 	# enable_session_summaries         : bool = DEFAULT_OPTIONS_ENABLE_SESSION_SUMMARIES
		# 	# search_previous_sessions_history : bool = DEFAULT_OPTIONS_SEARCH_PREVIOUS_SESSIONS_HISTORY
		# 	# num_history_sessions             : int  = DEFAULT_OPTIONS_NUM_HISTORY_SESSIONS
		# 	# show_tool_calls                  : bool = DEFAULT_OPTIONS_SHOW_TOOL_CALLS
		# 	# tool_call_limit                  : int  = DEFAULT_OPTIONS_TOOL_CALL_LIMIT
		# 	# reasoning                        : bool = DEFAULT_OPTIONS_REASONING
		# 	# stream_intermediate_steps        : bool = DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS

		# class AgentConfig(ConfigModel):
		# 	backend       : Optional [Union [BackendConfig         , int ]] = None
		# 	name          : Optional [str                                 ] = None
		# 	options       : Optional [Union [AgentOptionsConfig    , int ]] = None
		# 	prompt        : Optional [Union [PromptConfig          , int ]] = None
		# 	content_db    : Optional [Union [ContentDBConfig       , int ]] = None
		# 	memory_mgr    : Optional [Union [MemoryManagerConfig   , int ]] = None
		# 	session_mgr   : Optional [Union [SessionManagerConfig  , int ]] = None
		# 	knowledge_mgr : Optional [Union [KnowledgeManagerConfig, int ]] = None
		# 	tools         : Optional [List  [Union[ToolConfig      , int]]] = None
		return None


	def __init__(self, config: AppConfig, agent_index: int):
		super().__init__(config, agent_index)

		if not _validate_config(self.config):
			raise ValueError("Invalid Agno app configuration")

		agent_config = self.config.agents[self.agent_index]
		if not agent_config:
			raise ValueError("Agno agent configuration not found")

		def get_model(model_config: ModelConfig, do_raise: bool) -> Any:
			if model_config:
				if model_config.type == "openai":
					return OpenAIChat(id=model_config.id)
				if model_config.type == "ollama":
					return Ollama(id=model_config.id)
			if do_raise:
				raise ValueError(f"Unsupported Agno model")
			return None

		def get_options(options_config: AgentOptionsConfig, do_raise: bool) -> Any:
			if options_config:
				options = dict(options_config)
				del options["data"]
				return options
			if do_raise:
				raise ValueError(f"Unsupported Agno agent options")
			return None

		def get_search_type(value: str, do_raise: bool) -> SearchType:
			if value == "hybrid":
				return SearchType.hybrid
			if value == "keyword":
				return SearchType.keyword
			if value == "vector":
				return SearchType.vector
			if do_raise:
				raise ValueError(f"Invalid Agno db search type: {value}")
			return None

		models        = [0] * len(self.config.models)
		embeddings    = [0] * len(self.config.embeddings)
		knowledge_dbs = [0] * len(self.config.knowledge_dbs)
		knowledges    = [0] * len(self.config.knowledges)
		memory_dbs    = [0] * len(self.config.memory_dbs)
		memories      = [0] * len(self.config.memories)
		storage_dbs   = [0] * len(self.config.storage_dbs)
		storages      = [0] * len(self.config.storages)
		agent_options = [0] * len(self.config.agent_options)
		tools         = []

		models        [agent_config.model    ] += 1
		embeddings    [agent_config.embedding] += 1
		agent_options [agent_config.options  ] += 1

		if agent_config.knowledge is not None:
			for index in agent_config.knowledge:
				knowledges[index] += 1
				knowledge_config = self.config.knowledges[index]
				knowledge_dbs[knowledge_config.db] += 1
				if knowledge_config.model is not None:
					models[knowledge_config.model] += 1

		if agent_config.memory is not None:
			memories[agent_config.memory] += 1
			memory_config = self.config.memories[agent_config.memory]
			memory_dbs[memory_config.db] += 1
			if memory_config.model is not None:
				models[memory_config.model] += 1
			if memory_config.summarizer is not None:
				models[memory_config.summarizer] += 1

		if agent_config.storage is not None:
			storages[agent_config.storage] += 1
			storage_config = self.config.storages[agent_config.storage]
			storage_dbs[storage_config.db] += 1

		for i, (enabled, item_config) in enumerate(zip(models, self.config.models)):
			if not enabled:
				continue
			item = get_model(item_config, True)
			models[i] = item

		for i, (enabled, item_config) in enumerate(zip(embeddings, self.config.embeddings)):
			if not enabled:
				continue
			item = get_model(item_config, True)
			embeddings[i] = item

		for i, (enabled, item_config) in enumerate(zip(agent_options, self.config.agent_options)):
			if not enabled:
				continue
			item = get_options(item_config, True)
			agent_options[i] = item

		knowledge_base_path = config.options.knowledge_path or "."
		for i, (enabled, item_config) in enumerate(zip(knowledge_dbs, self.config.knowledge_dbs)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_KNOWLEDGE_DB_TYPE:
				db_url = os.path.join(knowledge_base_path, item_config.db_url) if not os.path.isabs(item_config.db_url) else item_config.db_url
				item = LanceDb(
					table_name  = item_config.table_name,
					uri         = db_url,
					search_type = get_search_type(item_config.search_type, True),
				)
			else:
				raise ValueError("Invalid Agno knowledge db type")
			knowledge_dbs[i] = item

		for i, (enabled, item_config) in enumerate(zip(knowledges, self.config.knowledges)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_KNOWLEDGE_TYPE:
				item = PDFUrlKnowledgeBase(
					db   = knowledge_dbs[item_config.db],
					urls = item_config.urls or [],
				)
			else:
				raise ValueError("Invalid Agno knowledge type")
			knowledges[i] = item

		memory_base_path = config.options.memory_path or "."
		for i, (enabled, item_config) in enumerate(zip(memory_dbs, self.config.memory_dbs)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_MEMORY_DB_TYPE:
				db_url = os.path.join(memory_base_path, item_config.db_url) if not os.path.isabs(item_config.db_url) else item_config.db_url
				item = SqliteMemoryDb(
					table_name = item_config.table_name,
					db_file    = db_url,
				)
			else:
				raise ValueError("Invalid Agno memory db type")
			memory_dbs[i] = item

		for i, (enabled, item_config) in enumerate(zip(memories, self.config.memories)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_MEMORY_TYPE:
				memory_model = models[item_config.model] if item_config.model is not None else None
				summarizer   = SessionSummarizer(model=models[item_config.summarizer]) if item_config.summarizer is not None else None
				item = Memory(
					db         = memory_dbs[item_config.db],
					model      = memory_model,
					summarizer = summarizer,
				)
			else:
				raise ValueError("Invalid Agno memory type")
			memories[i] = item

		session_base_path = config.options.session_path or "."
		for i, (enabled, item_config) in enumerate(zip(storage_dbs, self.config.storage_dbs)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_STORAGE_DB_TYPE:
				db_url = os.path.join(session_base_path, item_config.db_url) if not os.path.isabs(item_config.db_url) else item_config.db_url
				item = SqliteStorage(
					table_name = item_config.table_name,
					db_file    = db_url,
				)
			else:
				raise ValueError("Invalid Agno storage db type")
			storage_dbs[i] = item

		for i, (enabled, item_config) in enumerate(zip(storages, self.config.storages)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_STORAGE_TYPE:
				item = storage_dbs[item_config.db]
			else:
				raise ValueError("Invalid Agno storage type")
			storages[i] = item

		tools = None
		if agent_config.tools is not None:
			tools = []
			for tool_config in agent_config.tools:
				tool = None
				if tool_config.ref:
					# TODO: Implement tool reference handling
					# For now, we will just skip it
					pass
				else:
					if tool_config.type == "reasoning":
						tool = ReasoningTools()
					elif tool_config.type == "web_search":
						max_results = tool_config.args.get("max_results", DEFAULT_OPTIONS_MAX_WEB_SEARCH_RESULTS)
						tool = DuckDuckGoTools(fixed_max_results=max_results)
					# elif tool_config.type == "webcam":
					# 	tool = start_webcam_stream
					else:
						pass
				if tool is not None:
					tools.append(tool)
			if not tools:
				tools = None

		model = models        [agent_config.model  ]
		opts  = agent_options [agent_config.options]

		knowledge = None
		if agent_config.knowledge is not None:
			kgs = [knowledges[i] for i in agent_config.knowledge]
			if len(kgs) == 1:
				knowledge = kgs[0]
			else:
				# TODO
				# knowledge = CombinedKnowledgeBase(...)
				pass

		memory = None
		if agent_config.memory is not None:
			memory = memories[agent_config.memory]

		storage = None
		if agent_config.storage is not None:
			storage = storages[agent_config.storage]

		agent = Agent(
			model     = model,
			knowledge = knowledge,
			memory    = memory,
			storage   = storage,
			tools     = tools,
			**opts,
			stream=True,
		)

		self.d = agent


	def generate_app(self) -> Any:
		app_id   = "platform_agno_" + self.config.name.replace(" ", "_").lower()
		agui_app = AGUIApp(
			agent       = self.d,
			name        = self.config.name,
			app_id      = app_id,
			description = self.config.description,
		)
		app = agui_app.get_app()
		self.agui_app = agui_app
		return app


def register() -> bool:
	backend = BackendConfig(
		type    = "agno",
		version = "",
	)
	return register_backend(backend, _AgnoAgentApp)
