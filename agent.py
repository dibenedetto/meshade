from .config import AgentConfig


class BaseAgent:

	def __init__(self, config: AgentConfig):
		self.config = config
		self.d      = None


	def is_valid(self):
		return self.d is not None
