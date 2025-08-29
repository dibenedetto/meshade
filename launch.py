import argparse
import asyncio
import os
import uvicorn


from   fastapi                 import FastAPI
from   fastapi.middleware.cors import CORSMiddleware

from   numel                   import App, AppConfig, load_config, seed_everything


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

agents_registry = []
for i, agent in enumerate(app.agents):
	agent_config = app.config.agents[agent.agent_index]
	reg = {
		"name" : agent_config.name,
		"port" : app.config.port + agent.port_offset,
	}
	agents_registry.append(reg)

app_status = {
	"agents" : agents_registry,
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


async def run_servers():
	status_config = uvicorn.Config(status_app, host="0.0.0.0", port=app.config.port)
	status_server = uvicorn.Server(status_config)
	servers       = [status_server]

	for agent, reg in zip(app.agents, app_status["agents"]):
		agent_app  = agent.generate_app()
		app_config = uvicorn.Config(agent_app, host="0.0.0.0", port=reg["port"])
		app_server = uvicorn.Server(app_config)
		servers.append(app_server)

	await asyncio.gather(*[server.serve() for server in servers])


if __name__ == "__main__":
	asyncio.run(run_servers())
