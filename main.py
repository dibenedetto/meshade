from .build  import build_agent
from .config import load_config


def main():
	config = load_config("config.json")
	agent  = build_agent(config)


if __name__ == "__main__":
	main()
