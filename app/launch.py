# launch

import argparse
import asyncio
import os
import uvicorn


from   dotenv                  import load_dotenv
from   fastapi                 import FastAPI
from   fastapi.middleware.cors import CORSMiddleware


from   utils                   import get_time_str, log_print, seed_everything
from   numel                   import (
	DEFAULT_APP_PORT,
	AppConfig,
	compact_config,
	extract_config,
	get_backends,
	load_config,
	unroll_config,
	validate_config,
)


load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))


def add_middleware(app: FastAPI) -> None:
	app.add_middleware(
		CORSMiddleware,
		allow_credentials = False,
		allow_headers     = ["*"],
		allow_methods     = ["*"],
		allow_origins     = ["*"],
	)


def adjust_config(config: AppConfig) -> AppConfig:
	config = unroll_config(config)
	if not validate_config(config):
		return None
	config = compact_config(config)
	return config


if True:
	parser = argparse.ArgumentParser(description="App configuration")
	parser .add_argument("--port", type=int, default=DEFAULT_APP_PORT, help="Listening port for control server")
	parser .add_argument("--config_path", type=str, default="config.json", help="Path to configuration file")
	args   = parser.parse_args()


if True:
	schema = None
	try:
		schema_path = os.path.join(current_dir, "schema.py")
		with open(schema_path, "r", encoding="utf-8") as f:
			schema_text = f.read()
		schema = {
			"schema" : schema_text,
		}
	except Exception as e:
		log_print(f"Error reading schema definition: {e}")
		raise e


if True:
	config = load_config(args.config_path) or AppConfig()
	config.port = args.port
	config = adjust_config(config)
	if config is None:
		raise ValueError("Invalid app configuration")
	if config.options.seed is not None:
		seed_everything(config.options.seed)


if True:
	impl_modules = [os.path.splitext(f)[0] for f in os.listdir(current_dir) if f.endswith("_impl.py")]
	for module_name in impl_modules:
		try:
			impl_module = __import__(module_name)
			impl_module.register()
		except Exception as e:
			log_print(f"Error importing module '{module_name}': {e}")


if True:
	ctrl_server = None
	ctrl_status = {
		"config" : None,
		"status" : "waiting",
	}

	apps = None
	running_servers = []

	ctrl_app = FastAPI(title="Status")
	add_middleware(ctrl_app)


@ctrl_app.post("/ping")
async def ping():
	timestamp = get_time_str()
	result = {
		"message"   : "pong",
		"timestamp" : timestamp,
	}
	return result


@ctrl_app.post("/schema")
async def export_schema():
	global schema
	return schema


@ctrl_app.post("/import")
async def import_config(cfg: dict):
	global apps, config, ctrl_status
	if apps is not None:
		return {"error": "App is running"}
	new_config = AppConfig(**cfg)
	new_config = adjust_config(new_config)
	if new_config is None:
		return {"error": "Invalid app configuration"}
	ctrl_status["status"] = "ready"
	return config


@ctrl_app.post("/export")
async def export_config():
	global config
	return config


@ctrl_app.post("/start")
async def start_app():
	global apps, config, ctrl_status, running_servers
	if apps is not None:
		return {"error": "App is already running"}
	try:
		host       = "0.0.0.0"
		agent_port = config.port + 1

		if config.options.seed is not None:
			seed_everything(config.options.seed)

		active_agents = [True] * len(config.agents)
		backends      = get_backends()
		apps          = []

		agent_index = 0
		for backend, ctor in backends.values():
			bkd_cfg = extract_config(config, backend, active_agents)
			if not bkd_cfg.agents:
				continue

			app = ctor(bkd_cfg)
			apps.append(app)

			for i in range(len(app.config.agents)):
				agent_app = app.generate_app(i)
				add_middleware(agent_app)

				agent_config = uvicorn.Config(agent_app, host=host, port=agent_port)
				agent_server = uvicorn.Server(agent_config)
				agent_task   = asyncio.create_task(agent_server.serve())
				item         = {
					"server" : agent_server,
					"task"   : agent_task,
				}
				running_servers.append(item)

				config.agents[agent_index].port = agent_port
				agent_index += 1
				agent_port  += 1

		ctrl_status["config"] = config
		ctrl_status["status"] = "running"
	except Exception as e:
		return {"error": str(e)}
	return ctrl_status


@ctrl_app.post("/stop")
async def stop_app():
	global apps, config, ctrl_status, running_servers
	if apps is None:
		return {"error": "App is not running"}
	try:
		for item in running_servers:
			server = item["server"]
			task   = item["task"  ]
			if server and server.should_exit is False:
				server.should_exit = True
			if task:
				await task
		for app in apps:
			app.close()
		for agent in config.agents:
			agent.port = 0
		apps                  = None
		running_servers       = []
		ctrl_status["config"] = None
		ctrl_status["status"] = "stopped"
	except Exception as e:
		return {"error": str(e)}
	return ctrl_status


@ctrl_app.post("/restart")
async def restart_app():
	global ctrl_status
	await stop_app()
	await asyncio.sleep(1)
	await start_app()
	return ctrl_status


@ctrl_app.post("/status")
async def server_status():
	global ctrl_status
	return ctrl_status


@ctrl_app.post("/shutdown")
async def shutdown_server():
	global apps, ctrl_app, ctrl_server, ctrl_status
	if apps is not None:
		return {"error": "App is running"}
	if ctrl_server and ctrl_server.should_exit is False:
		ctrl_server.should_exit = True
	ctrl_app    = None
	ctrl_server = None
	ctrl_status = None
	return {"message": "Server shut down"}


async def run_server():
	global config, ctrl_app, ctrl_server

	host        = "0.0.0.0"
	ctrl_config = uvicorn.Config(ctrl_app, host=host, port=config.port)
	ctrl_server = uvicorn.Server(ctrl_config)

	await ctrl_server.serve()


if __name__ == "__main__":
	log_print("Server starting...")
	asyncio.run(run_server())
	log_print("Server shut down")
