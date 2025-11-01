# launch

import argparse
import asyncio
import os
import uvicorn


from   dotenv                  import load_dotenv
from   fastapi                 import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from   fastapi.middleware.cors import CORSMiddleware
from   pydantic                import BaseModel
from   typing                  import Any, Dict, List, Optional


from   event_bus               import (
	EventType,
	get_event_bus,
)
from   numel                   import (
	compact_config,
	extract_config,
	get_backends,
	load_config,
	unroll_config,
	validate_config,
)
from   schema                  import (
	DEFAULT_APP_PORT,
	AppConfig,
)
from   utils                   import (
	get_time_str,
	log_print,
	seed_everything,
)
from   workflow_api            import (
	setup_workflow_api,
)
from   workflow_engine         import (
	WorkflowEngine,
	WorkflowExecutionState,
)
from   workflow_manager        import (
	WorkflowManager,
)
from   workflow_schema         import (
	WorkflowConfig,
)


load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))


class WorkflowStartRequest(BaseModel):
	workflow: WorkflowConfig
	initial_data: Optional[Dict[str, Any]] = None


class WorkflowStartResponse(BaseModel):
	execution_id: str
	status: str


class UserInputRequest(BaseModel):
	node_id: str
	input_data: Any


class EventFilterRequest(BaseModel):
	workflow_id: Optional[str] = None
	execution_id: Optional[str] = None
	event_type: Optional[EventType] = None
	limit: int = 100


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
	workflow_manager = WorkflowManager(config, storage_dir="workflows")
	workflow_manager.load_all_from_directory()


if True:
	impl_modules = [os.path.splitext(f)[0] for f in os.listdir(current_dir) if f.endswith("_impl.py")]
	for module_name in impl_modules:
		try:
			impl_module = __import__(module_name)
			impl_module.register()
		except Exception as e:
			log_print(f"Error importing module '{module_name}': {e}")


if True:
	ctrl_server     = None
	ctrl_status     = {
		"config" : None,
		"status" : "waiting",
	}

	apps            = None
	running_servers = []

	event_bus       = get_event_bus()
	workflow_eng    = None

	ctrl_app        = FastAPI(title="Control")
	add_middleware(ctrl_app)


# ========================================================================
# Workflow API Endpoints
# ========================================================================

@ctrl_app.post("/workflow/start")
async def start_workflow(request: WorkflowStartRequest) -> WorkflowStartResponse:
	"""Start a new workflow execution"""
	global workflow_eng
	
	if workflow_eng is None:
		raise HTTPException(status_code=503, detail="Workflow engine not initialized")
	
	try:
		execution_id = await workflow_eng.start_workflow(
			workflow=request.workflow,
			initial_data=request.initial_data
		)
		return WorkflowStartResponse(
			execution_id=execution_id,
			status="started"
		)
	except Exception as e:
		log_print(f"Error starting workflow: {e}")
		raise HTTPException(status_code=500, detail=str(e))


@ctrl_app.post("/workflow/{execution_id}/cancel")
async def cancel_workflow(execution_id: str):
	"""Cancel a running workflow"""
	global workflow_eng
	
	if workflow_eng is None:
		raise HTTPException(status_code=503, detail="Workflow engine not initialized")
	
	try:
		await workflow_eng.cancel_execution(execution_id)
		return {"status": "cancelled", "execution_id": execution_id}
	except Exception as e:
		log_print(f"Error canceling workflow: {e}")
		raise HTTPException(status_code=500, detail=str(e))


@ctrl_app.get("/workflow/{execution_id}/status")
async def get_workflow_status(execution_id: str) -> WorkflowExecutionState:
	"""Get workflow execution status"""
	global workflow_eng
	
	if workflow_eng is None:
		raise HTTPException(status_code=503, detail="Workflow engine not initialized")
	
	state = workflow_eng.get_execution_state(execution_id)
	if not state:
		raise HTTPException(status_code=404, detail="Execution not found")
	return state


@ctrl_app.get("/workflow/list")
async def list_workflows() -> List[WorkflowExecutionState]:
	"""List all workflow executions"""
	global workflow_eng
	
	if workflow_eng is None:
		raise HTTPException(status_code=503, detail="Workflow engine not initialized")
	
	return workflow_eng.list_executions()


@ctrl_app.post("/workflow/{execution_id}/input")
async def provide_user_input(execution_id: str, request: UserInputRequest):
	"""Provide user input for waiting workflow"""
	global workflow_eng
	
	if workflow_eng is None:
		raise HTTPException(status_code=503, detail="Workflow engine not initialized")
	
	try:
		await workflow_eng.provide_user_input(
			execution_id=execution_id,
			node_id=request.node_id,
			user_input=request.input_data
		)
		return {"status": "input_received"}
	except Exception as e:
		log_print(f"Error providing user input: {e}")
		raise HTTPException(status_code=500, detail=str(e))


@ctrl_app.post("/workflow/events/history")
async def get_event_history(request: EventFilterRequest):
	"""Get filtered event history"""
	global event_bus
	
	events = event_bus.get_event_history(
		workflow_id=request.workflow_id,
		execution_id=request.execution_id,
		event_type=request.event_type,
		limit=request.limit
	)
	return {"events": [e.dict() for e in events]}


@ctrl_app.delete("/workflow/events/history")
async def clear_event_history():
	"""Clear event history"""
	global event_bus
	event_bus.clear_history()
	return {"status": "cleared"}


@ctrl_app.websocket("/workflow/events")
async def workflow_events_websocket(websocket: WebSocket):
	"""WebSocket endpoint for real-time workflow events"""
	global event_bus
	
	await event_bus.add_websocket_client(websocket)
	try:
		while True:
			# Keep connection alive and handle client messages
			try:
				data = await websocket.receive_text()
				# Client can send commands here if needed
				log_print(f"Received WebSocket message: {data}")
			except Exception as e:
				log_print(f"WebSocket receive error: {e}")
				break
				
	except WebSocketDisconnect:
		log_print("WebSocket client disconnected")
		event_bus.remove_websocket_client(websocket)
	except Exception as e:
		log_print(f"WebSocket error: {e}")
		event_bus.remove_websocket_client(websocket)


# # API endpoints can now work with workflow manager
# @ctrl_app.get("/workflows/list")
# async def list_workflows():
# 	return {"workflows": workflow_manager.list_workflows()}

# @ctrl_app.get("/workflows/{name}")
# async def get_workflow(name: str):
# 	workflow = workflow_manager.get_workflow(name)
# 	if not workflow:
# 		raise HTTPException(status_code=404, detail="Workflow not found")
# 	return workflow

# @ctrl_app.post("/workflows")
# async def create_workflow(workflow: WorkflowConfig):
# 	# Validate against app config
# 	errors = workflow.validate_against_app_config(config)
# 	if errors:
# 		raise HTTPException(status_code=400, detail=errors)
	
# 	workflow_manager.workflows[workflow.info.name] = workflow
# 	workflow_manager.save_workflow(workflow)
# 	return {"status": "created", "name": workflow.info.name}

# ========================================================================
# Original API Endpoints (with workflow integration)
# ========================================================================

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
	global apps, config, ctrl_status, running_servers, workflow_eng
	if apps is not None:
		return {"error": "App is already running"}
	try:
		host       = "0.0.0.0"
		agent_port = config.port + 1

		try_apply_seed(config)

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

		workflow_eng = WorkflowEngine(config, event_bus)
		workflow_eng.set_workflow_manager(workflow_manager)
		setup_workflow_api(ctrl_app, workflow_eng, event_bus)
		log_print("Workflow engine initialized")

		ctrl_status["config"] = config
		ctrl_status["status"] = "running"
	except Exception as e:
		log_print(f"Error starting app: {e}")
		return {"error": str(e)}
	return ctrl_status


@ctrl_app.post("/stop")
async def stop_app():
	global apps, config, ctrl_status, running_servers, workflow_eng
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
		
		# Clean up workflow engine
		workflow_eng = None
		log_print("Workflow engine stopped")
		
		apps                  = None
		running_servers       = []
		ctrl_status["config"] = None
		ctrl_status["status"] = "stopped"
	except Exception as e:
		log_print(f"Error stopping app: {e}")
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
	global ctrl_status, workflow_eng
	
	status = dict(ctrl_status)
	
	# Add workflow engine status
	if workflow_eng:
		status["workflow_eng"] = {
			"active_executions": len(workflow_eng.executions),
			"event_history_size": len(event_bus._event_history)
		}
	
	return status


@ctrl_app.post("/shutdown")
async def shutdown_server():
	global apps, ctrl_app, ctrl_server, ctrl_status, workflow_eng
	if apps is not None:
		return {"error": "App is running"}
	if ctrl_server and ctrl_server.should_exit is False:
		ctrl_server.should_exit = True
	
	# Clean up workflow engine
	workflow_eng = None
	
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
