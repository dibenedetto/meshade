# gradlab.ai
# sandboxlab.ai


from typing import Any


app: Any = None


def serve() -> None:
	import os

	from build      import build_playground
	from config     import PlaygroundConfig, load_playground_config
	from playground import Playground
	from utils      import seed_everything

	global app

	seed_everything()

	config     : PlaygroundConfig = load_playground_config("config.json")
	playground : Playground       = build_playground(config)

	app           = playground.generate_app()
	module_name   = os.path.splitext(os.path.basename(__file__))[0]
	property_name = "app"
	app_str       = f"{module_name}:{property_name}"

	playground.serve(app=app_str, port=config.port, reload=True)


if __name__ == "__main__":
	serve()
