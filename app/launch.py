# launch

import argparse
import asyncio
import os
import time
import uuid
import uvicorn


from   dotenv                  import load_dotenv
from   fastapi                 import FastAPI, WebSocket
from   fastapi.middleware.cors import CORSMiddleware
from   functools               import partial
from   typing                  import Any


from   numel                   import (
	AppContext,
	compact_config,
	extract_config,
	get_backends,
	load_config,
	unroll_config,
	validate_config,
)
from   schema                  import DEFAULT_APP_PORT, AppConfig, Event, EventType
from   utils                   import get_time_str, log_print, seed_everything
from   workflow                import ExecutionStatus, WorkflowExecutor


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


async def run_agent(app: Any, agent_index, *args, **kwargs) -> Any:
	result = await app.run(agent_index, *args, **kwargs)
	return result


def try_apply_seed(config: AppConfig) -> None:
	if config.options is not None:
		seed = config.app_options[config.options].seed
		if seed is not None:
			seed_everything(seed)


if True:
	parser = argparse.ArgumentParser(description="App configuration")
	parser .add_argument("--port", type=int, default=DEFAULT_APP_PORT, help="Listening port for control server")
	parser .add_argument("--config-path", type=str, default="config.json", help="Path to configuration file")
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
	try_apply_seed(config)


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

	apps            = None
	app_ctx         = None
	workflows       = None
	running_servers = []

	ctrl_app = FastAPI(title="Control")
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
	global apps, app_ctx, config, ctrl_status, running_servers, workflows
	if apps is not None:
		return {"error": "App is already running"}
	try:
		host       = "0.0.0.0"
		agent_port = config.port + 1

		try_apply_seed(config)

		active_agents = [True] * len(config.agents)
		backends      = get_backends()
		apps          = []
		app_agents    = []
		app_tools     = []

		agent_index = 0
		for backend, ctor in backends.values():
			bkd_cfg = extract_config(config, backend, active_agents)
			if not bkd_cfg.agents:
				apps       .append(None)
				app_agents .append(None)
				continue

			app       = ctor(bkd_cfg)
			app_agent = partial(run_agent, app, agent_index)

			apps       .append(app)
			app_agents .append(app_agent)

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

		app_ctx   = AppContext(config, app_agents, app_tools)
		workflows = dict()

		ctrl_status["config"] = config
		ctrl_status["status"] = "running"
	except Exception as e:
		return {"error": str(e)}
	return ctrl_status


@ctrl_app.post("/stop")
async def stop_app():
	global apps, app_ctx, config, ctrl_status, running_servers, workflows
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
			if app is not None:
				app.close()
		for agent in config.agents:
			agent.port = 0
		apps            = None
		app_ctx         = None
		workflows       = None
		running_servers = []
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


# launch.py - ADD/REPLACE these workflow endpoints

@ctrl_app.post("/workflow/start")
async def start_workflow(data: dict):
	global app_ctx, config, workflows
	if data is None:
		data = dict()
	index = data.get("index")
	if index is None or index < 0 or index >= len(config.workflows):
		return {"error": "invalid workflow index"}
	
	args      = data.get("args", dict())
	workflow  = config.workflows[index]
	executor  = WorkflowExecutor(app_ctx)
	
	# Execute workflow asynchronously
	execution = await executor.execute_workflow(workflow, args)
	
	# Store workflow execution info
	info = {
		"index"     : index,
		"executor"  : executor,
		"execution" : execution,
		"args"      : args,
		"workflow"  : workflow,
	}
	workflows[execution.execution_id] = info
	
	result = {
		"workflow_id"  : workflow.id,
		"execution_id" : execution.execution_id,
		"status"       : execution.status.value,
		"outputs"      : execution.state.outputs,
		"start_time"   : execution.start_time,
	}
	return result


@ctrl_app.post("/workflow/stop/{execution_id}")
async def stop_workflow(execution_id: str):
	global workflows
	
	info = workflows.get(execution_id)
	if not info:
		return {"error": "invalid workflow execution id"}
	
	executor = info.get("executor")
	execution = info.get("execution")
	
	if not executor or not execution:
		return {"error": "workflow execution not found"}
	
	# Check if already completed
	if execution.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED]:
		return {
			"execution_id" : execution_id,
			"status"       : execution.status.value,
			"message"      : "Workflow already finished"
		}
	
	# Cancel the workflow
	execution.status = ExecutionStatus.CANCELLED
	execution.end_time = time.time()
	
	# Emit cancellation event
	await executor.event_bus.emit(Event(
		id=str(uuid.uuid4()),
		type=EventType.WORKFLOW_ERROR,
		timestamp=time.time(),
		data={"message": "Workflow cancelled by user"},
		workflow_id=execution.workflow_id,
		execution_id=execution_id
	))
	
	return {
		"execution_id" : execution_id,
		"status"       : execution.status.value,
		"message"      : "Workflow cancelled successfully"
	}


@ctrl_app.post("/workflow/status/{execution_id}")
async def workflow_status(execution_id: str):
	global workflows
	
	info = workflows.get(execution_id)
	if not info:
		return {"error": "invalid workflow execution id"}
	
	execution = info.get("execution")
	if not execution:
		return {"error": "execution state not found"}
	
	# Calculate progress
	total_nodes = len(info.get("workflow").nodes) if info.get("workflow") else 0
	completed_nodes = len(execution.completed_node_ids)
	progress = (completed_nodes / total_nodes * 100) if total_nodes > 0 else 0
	
	# Get duration
	duration = None
	if execution.start_time:
		end = execution.end_time if execution.end_time else time.time()
		duration = end - execution.start_time
	
	result = {
		"execution_id"    : execution_id,
		"workflow_id"     : execution.workflow_id,
		"status"          : execution.status.value,
		"start_time"      : execution.start_time,
		"end_time"        : execution.end_time,
		"duration"        : duration,
		"progress"        : progress,
		"total_nodes"     : total_nodes,
		"completed_nodes" : completed_nodes,
		"current_nodes"   : execution.current_node_ids,
		"outputs"         : execution.state.outputs,
		"errors"          : execution.errors,
	}
	return result


@ctrl_app.websocket("/workflow/events/{execution_id}")
async def workflow_events(websocket: WebSocket, execution_id: str):
	"""Stream workflow events via WebSocket"""
	await websocket.accept()
	
	# Get workflow execution info
	info = workflows.get(execution_id)
	if not info:
		await websocket.send_json({
			"type": "error",
			"data": {"error": "invalid workflow execution id"}
		})
		await websocket.close()
		return
	
	executor = info.get("executor")
	if not executor:
		await websocket.send_json({
			"type": "error",
			"data": {"error": "executor not found"}
		})
		await websocket.close()
		return
	
	# Create event handler that forwards to WebSocket
	async def event_handler(event: Event):
		if event.execution_id == execution_id:
			try:
				await websocket.send_json({
					"type"      : event.type.value,
					"data"      : event.data,
					"timestamp" : event.timestamp,
					"node_id"   : event.source_node_id,
				})
			except Exception as e:
				print(f"Error sending WebSocket event: {e}")
	
	# Subscribe to all events for this execution
	executor.subscribe_to_events("*", event_handler)
	
	try:
		# Keep connection alive and listen for client messages
		while True:
			# Wait for messages from client (e.g., stop command)
			try:
				data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
				
				# Handle client commands
				if data.get("command") == "stop":
					await stop_workflow(execution_id)
				elif data.get("command") == "status":
					status = await workflow_status(execution_id)
					await websocket.send_json({
						"type": "status",
						"data": status
					})
			except asyncio.TimeoutError:
				# No message received, continue
				pass
			
			# Check if workflow is finished
			execution = info.get("execution")
			if execution and execution.status in [
				ExecutionStatus.COMPLETED,
				ExecutionStatus.FAILED,
				ExecutionStatus.CANCELLED
			]:
				# Send final status
				await websocket.send_json({
					"type": "workflow.complete",
					"data": {
						"status": execution.status.value,
						"outputs": execution.state.outputs,
					}
				})
				break
			
			await asyncio.sleep(0.1)
			
	except Exception as e:
		print(f"WebSocket error: {e}")
	finally:
		# Unsubscribe event handler
		try:
			executor.event_bus.unsubscribe("*", event_handler)
		except:
			pass
		
		# Close WebSocket
		try:
			await websocket.close()
		except:
			pass


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
