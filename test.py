from agent      import Agent
from build      import build_agent, build_playground
from config     import AgentConfig, PlaygroundConfig, load_config
from playground import Playground


def test_agent():
	config : AgentConfig = load_config("config.json").agents[0]
	agent  : Agent       = build_agent(config)

	agent.query("Research the latest developments in brain-computer interfaces")


# def test_playground():
# 	config     : PlaygroundConfig = load_config("config.json")
# 	playground : Playground       = build_playground(config)

# 	agent.query("Research the latest developments in brain-computer interfaces")

config     : PlaygroundConfig = load_config("config.json")
playground : Playground       = build_playground(config)

app = playground.generate_app()

if __name__ == "__main__":
	# test_agent()
	playground.serve("test:app", port=config.port)
