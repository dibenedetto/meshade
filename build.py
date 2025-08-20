from agent      import Agent
from config     import AgentConfig, PlaygroundConfig
from impl_agno  import AgnoAgent, AgnoPlayground
from playground import Playground


def build_agent(config: AgentConfig) -> Agent:
	agent: Agent = None
	try:
		if config.backend.type == "agno":
			agent = AgnoAgent(config)
		else:
			raise ValueError(f"Unsupported agent backend type: {config.backend.type}")

	except:
		raise

	if not agent or not agent.is_valid():
		raise ValueError("Invalid agent setup")

	return agent


def build_playground(config: PlaygroundConfig) -> Agent:
	playground: Playground = None
	try:
		if config.backend.type == "agno":
			playground = AgnoPlayground(config)
		else:
			raise ValueError(f"Unsupported playground backend type: {config.backend.type}")

	except:
		raise

	if not playground or not playground.is_valid():
		raise ValueError("Invalid playground setup")

	return playground
