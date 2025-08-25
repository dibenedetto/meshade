from typing                    import Any


from agno.agent                import Agent as BackendAgent
from agno.app.agui.app         import AGUIApp
from agno.knowledge.pdf_url    import PDFUrlKnowledgeBase
from agno.memory.v2.db.sqlite  import SqliteMemoryDb
from agno.memory.v2.memory     import Memory
from agno.memory.v2.summarizer import SessionSummarizer
from agno.models.openai        import OpenAIChat
from agno.playground           import Playground as BackendPlayground
from agno.storage.sqlite       import SqliteStorage
from agno.tools.duckduckgo     import DuckDuckGoTools
from agno.tools.reasoning      import ReasoningTools
from agno.vectordb.lancedb     import LanceDb
from agno.vectordb.search      import SearchType


from agent                     import Agent
from config                    import AgentConfig, ModelConfig, OptionsConfig, PlaygroundConfig
from constants                 import DEFAULT_MAX_WEB_SEARCH_RESULTS, DEFAULT_PLAYGROUND_PORT
from playground                import Playground


def agno_validate_agent_config(config: AgentConfig) -> bool:
	# TODO: Implement validation logic for the Agno agent configuration
	return config is not None


class AgnoAgent(Agent):

	def __init__(self, config: AgentConfig):
		super().__init__(config)

		if not agno_validate_agent_config(config):
			raise ValueError("Invalid Agno agent configuration")

		def get_model(model_config: ModelConfig, do_raise: bool) -> Any:
			if model_config:
				if model_config.type == "openai":
					return OpenAIChat(id=model_config.id)
			if do_raise:
				raise ValueError(f"Unsupported Agno model")
			return None

		def get_options(options_config: OptionsConfig, do_raise: bool) -> Any:
			if options_config:
				return dict(options_config)
			if do_raise:
				raise ValueError(f"Unsupported Agno options")
			return None

		def get_search_type(value: str, do_raise: bool) -> SearchType:
			if value == "hybrid":
				return SearchType.hybrid
			elif value == "keyword":
				return SearchType.keyword
			elif value == "vector":
				return SearchType.vector
			if do_raise:
				raise ValueError(f"Invalid Agno knowledge search type: {value}")
			return None

		model   = get_model   (config.model  , True )
		options = get_options (config.options, False)

		knowledge = None
		if config.knowledge is not None:
			config_knowledges = config.knowledge
			if not isinstance(config_knowledges, list):
				config_knowledges = [config_knowledges]
			knowledges = []
			for knowledge_config in config_knowledges:
				if knowledge_config.db.type == "lancedb":
					knowledge_db   = LanceDb(
						table_name  = knowledge_config.db.table_name,
						uri         = knowledge_config.db.db_url,
						search_type = get_search_type(knowledge_config.db.search_type, True),
					)
				else:
					raise ValueError("Invalid Agno knowledge db type")
				if knowledge_config.type == "document":
					knowledge_item = PDFUrlKnowledgeBase(
						urls      = [],
						vector_db = knowledge_db,
					)
				else:
					raise ValueError("Invalid Agno knowledge db type")
				if knowledge_item:
					knowledges.append(knowledge_item)
			knowledges_len = len(knowledges)
			if knowledges_len == 1:
				knowledge = knowledges[0]
			elif knowledges_len > 1:
				raise ValueError("Invalid Agno knowledge db handlers: multiple knowledge handlers are not supported right now")

		memory = None
		if config.memory is not None:
			if config.memory.db.type == "sqlite":
				memory_db = SqliteMemoryDb(
					table_name = config.memory.db.table_name,
					db_file    = config.memory.db.db_url,
				)
			else:
				raise ValueError("Invalid Agno memory db type")

			memory_model     = get_model(config.memory.model     , False)
			summarizer_model = get_model(config.memory.summarizer, False)

			memory = Memory(
				model      = memory_model,
				db         = memory_db,
				summarizer = SessionSummarizer(model=summarizer_model)
			)

		storage = None
		if config.storage is not None:
			if config.storage.db.type == "sqlite":
				storage = SqliteStorage(
					table_name = config.storage.db.table_name,
					db_file    = config.storage.db.db_url,
				)
			else:
				raise ValueError("Invalid Agno storage db type")

		tools = None
		if config.tools is not None:
			tools = []
			for tool_config in config.tools:
				tool  = None
				if tool_config.ref:
					# TODO: Implement tool reference handling
					# For now, we will just skip it
					pass
				else:
					if tool_config.type == "reasoning":
						tool = ReasoningTools()
					elif tool_config.type == "web_search":
						tool = DuckDuckGoTools(fixed_max_results=tool_config.args.get("max_results", DEFAULT_MAX_WEB_SEARCH_RESULTS))
				if tool is not None:
					tools.append(tool)
			if not tools:
				tools = None

		agent = BackendAgent(
			model     = model,
			knowledge = knowledge,
			memory    = memory,
			storage   = storage,
			tools     = tools,
			**options,
		)

		self.d = agent


	def query(self, message: str, stream: bool = False) -> Any:
		return self.d.print_response(message, stream=stream)


def agno_validate_playground_config(config: PlaygroundConfig) -> bool:
	# TODO: Implement validation logic for the Agno playground configuration
	return config is not None


class AgnoPlayground(Playground):

	def __init__(self, config: PlaygroundConfig):
		super().__init__(config)

		if not agno_validate_playground_config(config):
			raise ValueError("Invalid Agno playground configuration")

		agno_configs = [cfg for cfg in config.agents if cfg.backend.type == "agno"]
		if not agno_configs:
			raise ValueError("No valid Agno agent configurations found in the playground configuration")

		app_id      = "playground_" + self.config.name.replace(" ", "_").lower()
		agno_agents = None
		playground  = None

		if config.agui_app:
			agno_agents = [AgnoAgent(agno_configs[0])]
			playground  = AGUIApp(
				app_id = app_id,
				name   = self.config.name,
				agent  = agno_agents[0].d,
			)
		else:
			agno_agents = [AgnoAgent(cfg) for cfg in agno_configs]
			agents      = [agt.d for agt in agno_agents if agt.is_valid()]
			playground  = BackendPlayground(
				app_id = app_id,
				name   = self.config.name,
				agents = agents,
			)

		self.agno_agents = agno_agents
		self.d           = playground


	def is_valid(self) -> bool:
		return self.d is not None


	def generate_app(self) -> Any:
		app = self.d.get_app()
		return app


	def serve(self, app: str, port: int = DEFAULT_PLAYGROUND_PORT, reload: bool = True) -> None:
		self.d.serve(app=app, port=port, reload=reload)
