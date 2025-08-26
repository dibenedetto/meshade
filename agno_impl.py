from typing                    import Any


from agno.agent                import Agent
from agno.app.agui.app         import AGUIApp
from agno.knowledge.combined   import CombinedKnowledgeBase
from agno.knowledge.pdf_url    import PDFUrlKnowledgeBase
from agno.memory.v2.db.sqlite  import SqliteMemoryDb
from agno.memory.v2.memory     import Memory
from agno.memory.v2.summarizer import SessionSummarizer
from agno.models.openai        import OpenAIChat
from agno.storage.sqlite       import SqliteStorage
from agno.tools.duckduckgo     import DuckDuckGoTools
from agno.tools.reasoning      import ReasoningTools
from agno.vectordb.lancedb     import LanceDb
from agno.vectordb.search      import SearchType


from numel import (
	App,
	AppConfig,
	AppImpl,
	ModelConfig,
	OptionsConfig,
	DEFAULT_KNOWLEDGE_DB_TYPE,
	DEFAULT_KNOWLEDGE_TYPE,
	DEFAULT_MEMORY_DB_TYPE,
	DEFAULT_MEMORY_TYPE,
	DEFAULT_STORAGE_DB_TYPE,
	DEFAULT_STORAGE_TYPE,
	DEFAULT_OPTIONS_MAX_WEB_SEARCH_RESULTS,
	compatible_backends,
	module_prop_str,
)


def agno_validate_config(config: AppConfig) -> bool:
	# TODO: Implement validation logic for the Agno app configuration
	return config is not None


class AgnoAppImpl(AppImpl):

	def __init__(self, config: AppConfig):
		super().__init__(config)

		if not agno_validate_config(self.config):
			raise ValueError("Invalid Agno app configuration")

		agent_config = None
		for agent in self.config.agents:
			if agent_config is None and compatible_backends(config.backends[config.backend], config.backends[agent.backend]):
				agent_config = agent
				break

		if not agent_config:
			raise ValueError("Agno agent configuration not found")

		def get_model(model_config: ModelConfig, do_raise: bool) -> Any:
			if model_config:
				if model_config.type == "openai":
					return OpenAIChat(id=model_config.id)
			if do_raise:
				raise ValueError(f"Unsupported Agno model")
			return None

		def get_options(options_config: OptionsConfig, do_raise: bool) -> Any:
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
			elif value == "keyword":
				return SearchType.keyword
			elif value == "vector":
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
		options       = [0] * len(self.config.options)
		tools         = []

		models     [agent_config.model    ] += 1
		embeddings [agent_config.embedding] += 1
		options    [agent_config.options  ] += 1

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

		for i, (enabled, item_config) in enumerate(zip(options, self.config.options)):
			if not enabled:
				continue
			item = get_options(item_config, True)
			options[i] = item

		for i, (enabled, item_config) in enumerate(zip(knowledge_dbs, self.config.knowledge_dbs)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_KNOWLEDGE_DB_TYPE:
				item = LanceDb(
					table_name  = item_config.table_name,
					uri         = item_config.db_url,
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

		for i, (enabled, item_config) in enumerate(zip(memory_dbs, self.config.memory_dbs)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_MEMORY_DB_TYPE:
				item = SqliteMemoryDb(
					table_name = item_config.table_name,
					db_file    = item_config.db_url,
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

		for i, (enabled, item_config) in enumerate(zip(storage_dbs, self.config.storage_dbs)):
			if not enabled:
				continue
			if item_config.type == DEFAULT_STORAGE_DB_TYPE:
				item = SqliteStorage(
					table_name = item_config.table_name,
					db_file    = item_config.db_url,
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
			if tool is not None:
				tools.append(tool)
		if not tools:
			tools = None


		model = models  [agent_config.model  ]
		opts  = options [agent_config.options]

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
		)

		self.d = agent


	def is_valid(self) -> bool:
		return self.d is not None


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


	def launch(self, app: str) -> None:
		self.agui_app.serve(app=app, port=self.config.port, reload=self.config.reload)


App.register("agno", "", AgnoAppImpl)
