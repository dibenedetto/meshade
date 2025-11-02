# workflow_api

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from workflow_engine import WorkflowEngine, WorkflowExecutionState
from event_bus import EventBus, EventType
from utils import log_print


# Request/Response models
class WorkflowStartRequest(BaseModel):
	workflow: Dict[str, Any]  # Changed from WorkflowConfig to Dict to avoid circular import
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
	"""
	Setup workflow API endpoints on the provided FastAPI app.
	This should be called ONCE during app initialization.
	"""
	
	log_print("Setting up workflow API endpoints...")
	
	# Check if routes already exist to avoid duplicates
	existing_paths = [route.path for route in app.routes]
	
	if "/workflow/start" in existing_paths:
		log_print("Warning: Workflow routes already registered, skipping...")
		return
	
	@app.post("/workflow/start", response_model=WorkflowStartResponse)
	async def start_workflow(request: WorkflowStartRequest):
		"""Start a new workflow execution"""
		try:
			# Import here to avoid circular dependency
			from workflow_schema import WorkflowConfig
			
			# Convert dict to WorkflowConfig
			workflow_config = WorkflowConfig(**request.workflow)
			
			execution_id = await workflow_engine.start_workflow(
				workflow=workflow_config,
				initial_data=request.initial_data
			)
			return WorkflowStartResponse(
				execution_id=execution_id,
				status="started"
			)
		except Exception as e:
			log_print(f"Error starting workflow: {e}")
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/workflow/{execution_id}/cancel")
	async def cancel_workflow(execution_id: str):
		"""Cancel a running workflow"""
		try:
			await workflow_engine.cancel_execution(execution_id)
			return {"status": "cancelled", "execution_id": execution_id}
		except Exception as e:
			log_print(f"Error canceling workflow: {e}")
			raise HTTPException(status_code=500, detail=str(e))
	
	@app.post("/workflow/{execution_id}/status", response_model=WorkflowExecutionState)
	async def get_workflow_status(execution_id: str):
		"""Get workflow execution status"""
		state = workflow_engine.get_execution_state(execution_id)
		if not state:
			raise HTTPException(status_code=404, detail="Execution not found")
		return state
	
	@app.post("/workflow/list")
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
			log_print(f"Error providing user input: {e}")
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
	
	@app.post("/workflow/events/history/delete")
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
				try:
					data = await websocket.receive_text()
					log_print(f"Received WebSocket message: {data}")
					# Client can send commands here if needed
				except Exception as e:
					log_print(f"WebSocket receive error: {e}")
					break
					
		except WebSocketDisconnect:
			log_print("WebSocket client disconnected")
			event_bus.remove_websocket_client(websocket)
		except Exception as e:
			log_print(f"WebSocket error: {e}")
			event_bus.remove_websocket_client(websocket)
	
	log_print(f"? Workflow API endpoints registered on {app.title}")


# ========================================================================
# Workflow Manager Integration (Optional)
# ========================================================================

def setup_workflow_manager_api(app: FastAPI, workflow_manager):
	"""
	Optional: Setup workflow manager API endpoints for CRUD operations
	on workflow definitions (not executions).
	"""
	
	@app.post("/workflows/list")
	async def list_workflow_definitions():
		"""List all workflow definitions"""
		return {"workflows": workflow_manager.list_workflows()}
	
	@app.post("/workflows/{name}")
	async def get_workflow_definition(name: str):
		"""Get a workflow definition by name"""
		workflow = workflow_manager.get_workflow(name)
		if not workflow:
			raise HTTPException(status_code=404, detail="Workflow not found")
		return workflow
	
	@app.post("/workflows")
	async def create_workflow_definition(workflow: Dict[str, Any]):
		"""Create or update a workflow definition"""
		from workflow_schema import WorkflowConfig
		
		try:
			workflow_config = WorkflowConfig(**workflow)
			workflow_manager.workflows[workflow_config.info.name] = workflow_config
			workflow_manager.save_workflow(workflow_config)
			return {"status": "created", "name": workflow_config.info.name}
		except Exception as e:
			raise HTTPException(status_code=400, detail=str(e))
	
	@app.post("/workflows/{name}")
	async def delete_workflow_definition(name: str):
		"""Delete a workflow definition"""
		if name not in workflow_manager.workflows:
			raise HTTPException(status_code=404, detail="Workflow not found")
		workflow_manager.delete_workflow(name)
		return {"status": "deleted", "name": name}
	
	log_print("? Workflow manager API endpoints registered")
