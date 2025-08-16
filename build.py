from .agent  import Agent
from .config import AgentConfig, validate_config


from .agno   import AgnoAgent


def build_agent(config: AgentConfig) -> Agent:
	if not validate_config(config):
		raise ValueError("Invalid agent configuration")

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
