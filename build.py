from agent_base import AgentBase
from agent_agno import AgentAgno
from config     import AgentConfig, validate_config


def build_agent(config: AgentConfig) -> AgentBase:
	if not validate_config(config):
		raise ValueError("Invalid agent configuration")

	agent: AgentBase = None

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
