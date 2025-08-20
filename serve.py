# gradlab.ai
# sandboxlab.ai


from typing     import Any


from build      import build_playground
from config     import PlaygroundConfig, load_config
from playground import Playground


config     : PlaygroundConfig = load_config("config.json")
playground : Playground       = build_playground(config)
app        : Any              = playground.generate_app()


if __name__ == "__main__":
	playground.serve(f"{__file__}:app", port=config.port)
