from typing import Any


from config    import AgentConfig, validate_config
from constants import DEFAULT_AGENT_PORT


class Agent:

	def __init__(self, config: AgentConfig):
		if not validate_config(config):
			raise ValueError("Invalid agent configuration")

		self.config = config
		self.d      = None


	def is_valid(self) -> bool:
		return self.d is not None


	def query(self, message: str, stream: bool = False) -> Any:
		raise NotImplementedError("Subclasses must implement the query method.")


	def serve(self, port: int = DEFAULT_AGENT_PORT):
		raise NotImplementedError("Subclasses must implement the serve method.")
