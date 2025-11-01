# workflow_api

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from schema import WorkflowConfig
from workflow_engine import WorkflowEngine, WorkflowExecutionState
from event_bus import EventBus, EventType


# Request/Response models
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


def setup_workflow_api(app: FastAPI, workflow_engine: WorkflowEngine, event_bus: EventBus):
	"""Setup workflow API endpoints"""
	
	@app.post("/workflow/start")
	async def start_workflow(request: WorkflowStartRequest) -> WorkflowStartResponse:
		"""Start a new workflow execution"""
		try:
			execution_id = await workflow_engine.start_workflow(
				workflow=request.workflow,
				initial_data=request.initial_data
			)
			return WorkflowStartResponse(
				execution_id=execution_id,
				status="started"
			)
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/workflow/{execution_id}/cancel")
	async def cancel_workflow(execution_id: str):
		"""Cancel a running workflow"""
		try:
			await workflow_engine.cancel_execution(execution_id)
			return {"status": "cancelled", "execution_id": execution_id}
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.get("/workflow/{execution_id}/status")
	async def get_workflow_status(execution_id: str) -> WorkflowExecutionState:
		"""Get workflow execution status"""
		state = workflow_engine.get_execution_state(execution_id)
		if not state:
			raise HTTPException(status_code=404, detail="Execution not found")
		return state
	
	@app.get("/workflow/list")
	async def list_workflows() -> List[WorkflowExecutionState]:
		"""List all workflow executions"""
		return workflow_engine.list_executions()
	
	@app.post("/workflow/{execution_id}/input")
	async def provide_user_input(execution_id: str, request: UserInputRequest):
		"""Provide user input for waiting workflow"""
		try:
			await workflow_engine.provide_user_input(
				execution_id=execution_id,
				node_id=request.node_id,
				user_input=request.input_data
			)
			return {"status": "input_received"}
		except Exception as e:
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/workflow/events/history")
	async def get_event_history(request: EventFilterRequest):
		"""Get filtered event history"""
		events = event_bus.get_event_history(
			workflow_id=request.workflow_id,
			execution_id=request.execution_id,
			event_type=request.event_type,
			limit=request.limit
		)
		return {"events": [e.dict() for e in events]}
	
	@app.delete("/workflow/events/history")
	async def clear_event_history():
		"""Clear event history"""
		event_bus.clear_history()
		return {"status": "cleared"}
	
	@app.websocket("/workflow/events")
	async def workflow_events_websocket(websocket: WebSocket):
		"""WebSocket endpoint for real-time workflow events"""
		await event_bus.add_websocket_client(websocket)
		try:
			while True:
				# Keep connection alive and handle client messages
				data = await websocket.receive_text()
				# Client can send commands here if needed
				
		except WebSocketDisconnect:
			event_bus.remove_websocket_client(websocket)
		except Exception as e:
			print(f"WebSocket error: {e}")
			event_bus.remove_websocket_client(websocket)


# ========================================================================
# Integration with launch.py
# ========================================================================

"""
To integrate into launch.py, add the following:

1. Import at the top:
from workflow_engine import WorkflowEngine
from workflow_api import setup_workflow_api
from event_bus import get_event_bus

2. After creating ctrl_app, add:
event_bus = get_event_bus()
workflow_engine = None

3. In start_app(), after creating apps:
global workflow_engine
workflow_engine = WorkflowEngine(config, event_bus)
setup_workflow_api(ctrl_app, workflow_engine, event_bus)

4. In stop_app(), add:
workflow_engine = None

5. Update the middleware setup for WebSocket support (already done in add_middleware)
"""


# Example of extended launch.py section:
"""
# Add after existing imports
from workflow_engine import WorkflowEngine
from workflow_api import setup_workflow_api
from event_bus import get_event_bus

# Add after ctrl_app creation
event_bus = get_event_bus()
workflow_engine = None

@ctrl_app.post("/start")
async def start_app():
	global apps, config, ctrl_status, running_servers, workflow_engine
	if apps is not None:
		return {"error": "App is already running"}
	try:
		# ... existing code ...
		
		# Add workflow engine
		workflow_engine = WorkflowEngine(config, event_bus)
		setup_workflow_api(ctrl_app, workflow_engine, event_bus)
		
		ctrl_status["config"] = config
		ctrl_status["status"] = "running"
	except Exception as e:
		return {"error": str(e)}
	return ctrl_status

@ctrl_app.post("/stop")
async def stop_app():
	global apps, config, ctrl_status, running_servers, workflow_engine
	if apps is None:
		return {"error": "App is not running"}
	try:
		# ... existing code ...
		
		# Clean up workflow engine
		workflow_engine = None
		
		apps = None
		running_servers = []
		ctrl_status["config"] = None
		ctrl_status["status"] = "stopped"
	except Exception as e:
		return {"error": str(e)}
	return ctrl_status
"""
