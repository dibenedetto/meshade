# app_context

import copy


from   collections.abc import Callable
from   typing          import List


from   numel           import AppConfig


class AppContext:
	"""Context providing access to app resources for node executors"""
	
	def __init__(self, config: AppConfig, agents: List[Callable], tools: List[Callable]):
		self.config = copy.deepcopy(config)
		self.agents = copy.deepcopy(agents)
		self.tools  = copy.deepcopy(tools )


	def get_agent(self, ref: int) -> Callable:
		"""Get agent by reference"""
		return self.agents[ref]


	def get_tool(self, ref: int) -> Callable:
		"""Get tool by reference"""
		return self.tools[ref]
