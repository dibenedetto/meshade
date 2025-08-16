from build  import build_agent
from config import load_config


def main():
	config = load_config("config.json")
	agent  = build_agent(config)

	agent.query("Research the latest developments in brain-computer interfaces")


if __name__ == "__main__":
	main()
