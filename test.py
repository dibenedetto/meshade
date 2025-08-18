from agent  import Agent
from build  import build
from config import AgentConfig, load_config


def test():
	config : AgentConfig = load_config("config.json")
	agent  : Agent       = build(config)

	agent.query("Research the latest developments in brain-computer interfaces")


if __name__ == "__main__":
	test()
