from build  import build_playground
from config import load_playground_config
from utils  import module_prop_str, seed_everything


seed_everything()

config     = load_playground_config("config.json")
playground = build_playground(config)
app        = playground.generate_app()
# print(f"app routes: {[route.path for route in app.routes]}")


if __name__ == "__main__":
	app_str = module_prop_str(__file__, "app")
	playground.serve(app=app_str, port=config.port, reload=True)
