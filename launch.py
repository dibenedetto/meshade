import argparse
import os


from numel import App, AppConfig, load_config, seed_everything


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description="App configuration")
	parser .add_argument("--config_path", type=str, default="config.json", help="Path to configuration file")
	args   = parser.parse_args()

	config = load_config(args.config_path) or AppConfig()
	if config.seed is not None:
		seed_everything(config.seed)

	impl_modules = [os.path.splitext(f)[0] for f in os.listdir(".") if f.endswith("_impl.py")]
	for module_name in impl_modules:
		try:
			__import__(module_name)
		except Exception as e:
			print(f"Error importing module '{module_name}': {e}")

	app = App(config)
	app.launch()
