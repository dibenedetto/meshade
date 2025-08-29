import argparse
import asyncio
import os
import uvicorn


from   fastapi                 import FastAPI
from   fastapi.middleware.cors import CORSMiddleware


from   numel                   import App, AppConfig, load_config, seed_everything, unroll_config


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

for i, agent in enumerate(config.agents):
	agent.port = config.port + i + 1

app = App(config)

app_status = {
	"config" : app.config,
}

status_app = FastAPI(title="Status")

status_app.add_middleware(
	CORSMiddleware,
	allow_credentials = False,
	allow_origins     = ["*"],
	allow_methods     = ["*"],
	allow_headers     = ["*"],
)


@status_app.get("/status")
async def get_status():
	return app_status


@status_app.get("/default")
async def get_default():
	def_value = {
		"config" : unroll_config(),
	}
	return def_value


async def run_servers():
	localhost = "0.0.0.0"

	status_config = uvicorn.Config(status_app, host=localhost, port=app.config.port)
	status_server = uvicorn.Server(status_config)
	servers       = [status_server]

	for agent in app.agents:
		agent_app    = agent.generate_app()
		agent_port   = app.config.agents[agent.agent_index].port
		agent_config = uvicorn.Config(agent_app, host=localhost, port=agent_port)
		agent_server = uvicorn.Server(agent_config)
		servers.append(agent_server)

	await asyncio.gather(*[server.serve() for server in servers])


if __name__ == "__main__":
	asyncio.run(run_servers())
