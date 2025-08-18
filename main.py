from agent_base import AgentBase
from build      import build_agent
from config     import AgentConfig, load_config


def main():
	config : AgentConfig = load_config("config.json")
	agent  : AgentBase   = build_agent(config)

	agent.query("Research the latest developments in brain-computer interfaces")


if __name__ == "__main__":
	main()
