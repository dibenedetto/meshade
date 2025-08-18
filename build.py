from agent  import Agent
from config import AgentConfig


from impl_agno import AgentAgno


def build(config: AgentConfig) -> Agent:
	agent: Agent = None
	try:
		if config.backend.type == "agno":
			agent = AgentAgno(config)
		else:
			raise ValueError(f"Unsupported agent backend type: {config.backend.type}")

	except:
		raise

	if not agent or not agent.is_valid():
		raise ValueError("Invalid agent setup")

	return agent
