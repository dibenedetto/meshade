from base_types import AgentConfig


class BaseAgent:

	def __init__(self, config: AgentConfig):
		self.config = config


	def is_valid(self):
		return True
