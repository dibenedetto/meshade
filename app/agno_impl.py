# agno_impl

import copy
import os


from   fastapi                         import FastAPI
from   typing                          import Any


from   agno.agent                      import Agent
from   agno.db.sqlite                  import SqliteDb
from   agno.knowledge.embedder.openai  import OpenAIEmbedder
from   agno.knowledge.embedder.ollama  import OllamaEmbedder
from   agno.knowledge.knowledge        import Knowledge
from   agno.memory.manager             import MemoryManager
from   agno.models.ollama              import Ollama
from   agno.models.openai              import OpenAIChat
from   agno.os                         import AgentOS
from   agno.os.interfaces.agui         import AGUI
from   agno.session.summary            import SessionSummaryManager
from   agno.tools.duckduckgo           import DuckDuckGoTools
from   agno.tools.reasoning            import ReasoningTools
from   agno.vectordb.lancedb           import LanceDb
from   agno.vectordb.search            import SearchType


from   numel                     import (
	DEFAULT_KNOWLEDGE_MANAGER_INDEX_DB_TABLE_NAME,
	DEFAULT_TOOL_MAX_WEB_SEARCH_RESULTS,
	AppConfig,
	AgentApp,
	BackendConfig,
	AgentOptionsConfig,
	register_backend
)


def _validate_config(config: AppConfig) -> bool:
	# TODO: Implement validation logic for the Agno app configuration
	return config is not None


class _AgnoAgentApp(AgentApp):

	def _get_search_type(self, value: str) -> SearchType:
		if value == "hybrid":
			return SearchType.hybrid
		if value == "keyword":
			return SearchType.keyword
		if value == "vector":
			return SearchType.vector
		raise ValueError(f"Invalid Agno db search type: {value}")


	def _build_model(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.models[index]
		if item_config:
			if item_config.type == "openai":
				item = OpenAIChat(id=item_config.id)
				return item
			if item_config.type == "ollama":
				item = Ollama(id=item_config.id)
				return item
		raise ValueError(f"Unsupported Agno model")


	def _build_embedding(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.embeddings[index]
		if item_config:
			if item_config.type == "openai":
				item = OpenAIEmbedder()
				return item
			if item_config.type == "ollama":
				item = OllamaEmbedder()
				return item
		raise ValueError(f"Unsupported Agno embdding")


	def _build_prompt(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.prompts[index]
		item        = copy.deepcopy(item_config)
		return item


	def _build_content_db(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.content_dbs[index]
		if item_config:
			if item_config.engine == "sqlite":
				db = SqliteDb(
					db_file         = item_config.url,
					memory_table    = item_config.memory_table_name,
					session_table   = item_config.session_table_name,
					knowledge_table = item_config.knowledge_table_name,

					# # Table to store all metrics aggregations
					# metrics_table="your_metrics_table_name",
					# # Table to store all your evaluation data
					# eval_table="your_evals_table_name",
					# # Table to store all your knowledge content
				)
				return db
		raise ValueError(f"Unsupported Agno content db")


	def _build_index_db(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.index_dbs[index]
		if item_config:
			if item_config.engine == "lancedb":
				search_type = self._get_search_type(item_config.search_type)
				item = LanceDb(
					embedder    = impl.embeddings[item_config.embedding],
					uri         = item_config.url,
					table_name  = DEFAULT_KNOWLEDGE_MANAGER_INDEX_DB_TABLE_NAME,
					search_type = search_type,
				)
				return item
		raise ValueError(f"Unsupported Agno index db")


	def _build_memory_manager(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.memory_mgrs[index]
		if item_config:
			model          = None
			system_message = None
			if item_config.prompt is not None:
				prompt         = impl.prompts [item_config.prompt]
				model          = impl.models  [prompt.model      ]
				system_message = prompt.override
			item = MemoryManager(
				model          = model,
				system_message = system_message,
			)
			return item
		raise ValueError(f"Unsupported Agno memory manager")


	def _build_session_manager(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.prompts[index]
		item        = copy.deepcopy(item_config)
		return item


	def _build_knowledge_manager(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.knowledge_mgrs[index]
		if item_config:
			description = item_config.description
			content_db  = None
			index_db    = None
			if item_config.content_db is not None:
				content_db = impl.content_dbs[item_config.content_db]
			if item_config.index_db is not None:
				index_db = impl.index_dbs[item_config.index_db]
			item = Knowledge(
				description = description,
				contents_db = content_db,
				vector_db   = index_db,
				max_results = item_config.max_results,
			)
			return item
		raise ValueError(f"Unsupported Agno memory manager")


	def _build_tool(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.tools[index]
		item        = None
		if item_config:
			args = item_config.args if item_config.args is not None else dict()
			if item_config.type == "reasoning":
				item = ReasoningTools()
			elif item_config.type == "web_search":
				max_results = args.get("max_results", DEFAULT_TOOL_MAX_WEB_SEARCH_RESULTS)
				item = DuckDuckGoTools(fixed_max_results=max_results)
		return item


	def _build_agent_options(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.agent_options[index]
		item        = copy.deepcopy(item_config)
		return item


	def _build_agent(self, config: AppConfig, impl: AppConfig, index: int) -> Any:
		item_config = config.agents[index]
		if item_config:

			if True:
				name         = f"Numel Agno Agent {index}"
				description  = None
				instructions = None
				if item_config.info:
					if item_config.info.name:
						name = item_config.info.name
					description  = item_config.info.description
					instructions = item_config.info.instructions

			if True:
				prompt = config.prompts[item_config.prompt]
				model  = impl.models[prompt.model]

			if True:
				options  = impl.agent_options[item_config.options] if item_config.options is not None else AgentOptionsConfig()
				markdown = options.markdown

			if True:
				content_db = None
				if item_config.content_db is not None:
					content_db = impl.content_dbs[item_config.content_db]

			if True:
				tools = [impl.tools[i] for i in item_config.tools if impl.tools[i] is not None]

			if True:
				enable_agentic_memory   = False
				enable_user_memories    = False
				add_memories_to_context = False
				memory_mgr              = None
				if item_config.memory_mgr is not None:
					memory_mgr_config       = config.memory_mgrs[item_config.memory_mgr]
					enable_agentic_memory   = memory_mgr_config.managed
					add_memories_to_context = memory_mgr_config.query
					enable_user_memories    = memory_mgr_config.update
					memory_mgr              = impl.memory_mgrs[item_config.memory_mgr]

			if True:
				search_session_history  = False
				num_history_sessions    = None
				session_summary_manager = None
				if item_config.session_mgr is not None:
					session_mgr_config     = config.session_mgrs[item_config.session_mgr]
					search_session_history = session_mgr_config.query
					num_history_sessions   = session_mgr_config.history_size
					if session_mgr_config.summarize:
						model                  = None
						session_summary_prompt = None
						if item_config.session_mgr.prompt is not None:
							prompt                 = config.prompts[item_config.session_mgr.prompt]
							model                  = impl.models[prompt.model] if prompt.model is not None else None
							session_summary_prompt = prompt.override
						session_summary_manager = SessionSummaryManager(
							model                  = model,
							session_summary_prompt = session_summary_prompt,
						)

			if True:
				item = Agent(
					name                    = name,
					model                   = model,
					description             = description,
					instructions            = instructions,

					markdown                = markdown,
					db                      = content_db,
					tools                   = tools,

					enable_agentic_memory   = enable_agentic_memory,
					enable_user_memories    = enable_user_memories,
					add_memories_to_context = add_memories_to_context,
					memory_manager          = memory_mgr,

					search_session_history  = search_session_history,
					num_history_sessions    = num_history_sessions,
					session_summary_manager = session_summary_manager,
				)
	
			return item
		raise ValueError(f"Unsupported Agno agent")


	def __init__(self, config: AppConfig):
		super().__init__(config)

		if not _validate_config(self.config):
			raise ValueError("Invalid Agno app configuration")

		config_impl = copy.deepcopy(self.config)

		config_impl.models         = [self._build_model             (self.config, config_impl, i) for i in range(len(self.config.models        ))]
		config_impl.embeddings     = [self._build_embedding         (self.config, config_impl, i) for i in range(len(self.config.embeddings    ))]
		config_impl.content_dbs    = [self._build_content_db        (self.config, config_impl, i) for i in range(len(self.config.content_dbs   ))]
		config_impl.index_dbs      = [self._build_index_db          (self.config, config_impl, i) for i in range(len(self.config.index_dbs     ))]
		config_impl.tools          = [self._build_tool              (self.config, config_impl, i) for i in range(len(self.config.tools         ))]
		config_impl.agent_options  = [self._build_agent_options     (self.config, config_impl, i) for i in range(len(self.config.agent_options ))]

		config_impl.prompts        = [self._build_prompt            (self.config, config_impl, i) for i in range(len(self.config.prompts       ))]
		config_impl.memory_mgrs    = [self._build_memory_manager    (self.config, config_impl, i) for i in range(len(self.config.memory_mgrs   ))]
		config_impl.session_mgrs   = [self._build_session_manager   (self.config, config_impl, i) for i in range(len(self.config.session_mgrs  ))]
		config_impl.knowledge_mgrs = [self._build_knowledge_manager (self.config, config_impl, i) for i in range(len(self.config.knowledge_mgrs))]

		config_impl.agents         = [self._build_agent             (self.config, config_impl, i) for i in range(len(self.config.agents        ))]

		self.config_impl = config_impl


	def generate_app(self, agent_index: int) -> FastAPI:
		agent    = self.config_impl.agents[agent_index]
		agent_os = AgentOS(
			agents     = [agent],
			interfaces = [AGUI(agent=agent)]
		)
		app = agent_os.get_app()
		agent.agent_os = agent_os
		return app


	def close(self) -> bool:
		self.config_impl = None
		return True


def register() -> bool:
	backend = BackendConfig(
		type    = "agno",
		version = "",
	)
	return register_backend(backend, _AgnoAgentApp)
