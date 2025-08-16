from typing import Any


from agno.agent               import Agent
from agno.knowledge.pdf_url   import PDFUrlKnowledgeBase
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.memory.v2.memory    import Memory
from agno.models.openai       import OpenAIChat
from agno.storage.sqlite      import SqliteStorage
from agno.tools.duckduckgo    import DuckDuckGoTools
from agno.tools.reasoning     import ReasoningTools
from agno.vectordb.lancedb    import LanceDb
from agno.vectordb.search     import SearchType


from agent  import BaseAgent
from config import AgentConfig, ModelConfig, OptionsConfig


def agno_validate_config(config: AgentConfig) -> bool:
	# TODO: Implement validation logic for the Agno agent configuration
	return config is not None


class AgnoAgent(BaseAgent):

	def __init__(self, config: AgentConfig):
		super().__init__(config)

		if not agno_validate_config(config):
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
			if config.knowledge.vector_db.type == "lancedb":
				knowledge_db   = LanceDb(
					table_name  = config.knowledge.vector_db.table_name,
					uri         = config.knowledge.vector_db.db_url,
					search_type = get_search_type(config.knowledge.vector_db.search_type, True),
				)
			else:
				raise ValueError("Invalid Agno knowledge db type")

			if config.knowledge.type == "document":
				knowledge = PDFUrlKnowledgeBase(
					urls      = [],
					vector_db = knowledge_db,
				)
			else:
				raise ValueError("Invalid Agno knowledge db type")

		memory = None
		if config.memory is not None:
			memory_model = get_model(config.memory.model, False)

			if config.memory.db.type == "sqlite":
				memory_db = SqliteMemoryDb(
					table_name = config.memory.db.table_name,
					db_file    = config.memory.db.db_url,
				)
			else:
				raise ValueError("Invalid Agno memory db type")

			memory = Memory(
				model = memory_model,
				db    = memory_db,
			)

		storage = None
		if config.storage is not None:
			if config.storage.type == "sqlite":
				storage = SqliteStorage(
					table_name = config.memory.db.table_name,
					db_file    = config.memory.db.db_url,
				)
			else:
				raise ValueError("Invalid Agno memory db type")

		tools = None
		if config.tools is not None:
			tools = []
			tool  = None
			for tool_config in config.tools:
				if tool_config.type == "web_search":
					tool = DuckDuckGoTools()
				elif tool_config.type == "reasoning":
					tool = ReasoningTools()
				if tool is not None:
					tools.append(tool)
			if not tools:
				tools = None

		agent = Agent(
			model     = model,
			knowledge = knowledge,
			memory    = memory,
			storage   = storage,
			tools     = tools,
			**options,
		)

		self.d = agent
