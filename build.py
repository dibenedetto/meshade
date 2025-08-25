from agent      import Agent
from config     import AgentConfig, PlaygroundConfig
from impl_agno  import AgnoAgent, AgnoPlayground
from playground import Playground


def build_agent(config: AgentConfig) -> Agent:
	obj: Agent = None
	try:
		if config.backend.type == "agno":
			obj = AgnoAgent(config)
		else:
			raise ValueError(f"Unsupported agent backend type: {config.backend.type}")

	except:
		raise

	if not obj or not obj.is_valid():
		raise ValueError("Invalid agent setup")

	return obj


def build_playground(config: PlaygroundConfig) -> Playground:
	obj: Playground = None
	try:
		if config.backend.type == "agno":
			obj = AgnoPlayground(config)
		else:
			raise ValueError(f"Unsupported playground backend type: {config.backend.type}")

	except:
		raise

	if not obj or not obj.is_valid():
		raise ValueError("Invalid playground setup")

	return obj
