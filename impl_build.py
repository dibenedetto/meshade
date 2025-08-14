from base_agent  import BaseAgent
from base_types  import AgentConfig
from base_config import validate_config

from detail_agno_agent import AgnoAgent


def build_agent(config: AgentConfig):
	if not validate_config(config):
		raise ValueError("Invalid agent configuration")

	agent : BaseAgent = None

	try:
		if config.backend.type == "agno":
			agent = AgnoAgent(config)
	except:
		raise ValueError(f"Invalid agent setup: {config.backend.type}")

	if not agent or not agent.is_valid():
		raise ValueError(f"Invalid agent type: {config.backend.type}")

	return agent
