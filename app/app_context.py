# app_context

import copy


from   typing import Any, Union


from   numel  import AppConfig


class AppContext:
	"""Context providing access to app resources for node executors"""
	
	def __init__(self, config: AppConfig):
		self.config  = copy.deepcopy(config)
		self._agents = dict()
		self._tools  = dict()
	

	def get_agent(self, ref: Union[int, str]) -> Any:
		"""Get agent by reference"""
		# TODO: implement agent retrieval
		if isinstance(ref, int):
			if ref not in self._agents:
				# Initialize agent from config
				agent_config = self.config.agents[ref]
				# ... create agent using existing backend ...
				self._agents[ref] = agent_config
			return self._agents[ref]
		return None


	def get_tool(self, ref: Union[int, str]) -> Any:
		"""Get tool by reference"""
		# TODO: implement tool retrieval
		if isinstance(ref, int):
			if ref not in self._tools:
				tool_config = self.config.tools[ref]
				# ... create tool ...
				self._tools[ref] = tool_config
			return self._tools[ref]
		return None
