# launch

import argparse
import asyncio
import os
import uvicorn


from   dotenv                  import load_dotenv
from   fastapi                 import FastAPI
from   fastapi.middleware.cors import CORSMiddleware


from   numel                   import DEFAULT_APP_PORT, App, AppConfig, get_time_str, load_config, seed_everything
from   utils                   import log_print


load_dotenv()


if True:
	parser = argparse.ArgumentParser(description="App configuration")
	parser .add_argument("--port", type=int, default=DEFAULT_APP_PORT, help="Listening port for control server")
	parser .add_argument("--config_path", type=str, default="app/config.json", help="Path to configuration file")
	args   = parser.parse_args()


if True:
	config = load_config(args.config_path) or AppConfig()
	config.options.port = args.port
	if config.options.seed is not None:
		seed_everything(config.options.seed)


if True:
	curr_dir     = os.path.dirname(os.path.abspath(__file__))
	impl_modules = [os.path.splitext(f)[0] for f in os.listdir(curr_dir) if f.endswith("_impl.py")]
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

	app = None
	running_servers = []

	ctrl_app = FastAPI(title="Status")

	ctrl_app.add_middleware(
		CORSMiddleware,
		allow_credentials = False,
		allow_headers     = ["*"],
		allow_methods     = ["*"],
		allow_origins     = ["*"],
	)


@ctrl_app.post("/ping")
async def ping():
	timestamp = get_time_str()
	result = {
		"message"   : "pong",
		"timestamp" : timestamp,
	}
	return result


@ctrl_app.post("/import")
async def import_config(cfg: dict):
	global app, config, ctrl_status
	if app is not None:
		return {"error": "App is running"}
	config = AppConfig(**cfg)
	ctrl_status["status"] = "ready"
	return config


@ctrl_app.post("/export")
async def export_config():
	global config
	return config


@ctrl_app.post("/start")
async def start_app():
	global app, config, ctrl_status, running_servers
	if app is not None:
		return {"error": "App is already running"}
	try:
		if config.options.seed is not None:
			seed_everything(config.options.seed)
		host            = "0.0.0.0"
		app             = App(config)
		running_servers = []
		for i, agent in enumerate(app.agents):
			agent_app    = agent.generate_app()
			agent_port   = config.options.port + i + 1
			agent_config = uvicorn.Config(agent_app, host=host, port=agent_port)
			agent_server = uvicorn.Server(agent_config)
			agent_task   = asyncio.create_task(agent_server.serve())
			item         = {
				"server" : agent_server,
				"task"   : agent_task,
			}
			running_servers.append(item)
		ctrl_status["config"] = app.config
		ctrl_status["status"] = "running"
	except Exception as e:
		return {"error": str(e)}
	return ctrl_status


@ctrl_app.post("/stop")
async def stop_app():
	global app, config, ctrl_status, running_servers
	if app is None:
		return {"error": "App is not running"}
	try:
		for item in running_servers:
			server = item["server"]
			task   = item["task"  ]
			if server and server.should_exit is False:
				server.should_exit = True
			if task:
				await task
		running_servers       = []
		app                   = None
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
	global app, ctrl_app, ctrl_server, ctrl_status
	if app is not None:
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
	ctrl_config = uvicorn.Config(ctrl_app, host=host, port=config.options.port)
	ctrl_server = uvicorn.Server(ctrl_config)

	await ctrl_server.serve()


if __name__ == "__main__":
	log_print("Server starting...")
	asyncio.run(run_server())
	log_print("Server shut down")
