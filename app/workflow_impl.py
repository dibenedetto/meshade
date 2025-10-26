# workflow_impl

from   asyncio            import Event, sleep
from   fastapi            import FastAPI, WebSocket


from   app_context        import AppContext
from   numel              import (
	AppConfig,
	AgentApp,
	BackendConfig,
	register_backend
)
from   workflow_executor  import WorkflowExecutor


class WorkflowBackend(AgentApp):
	
	def __init__(self, config: AppConfig):
		super().__init__(config)

		# Create app context for executors
		self.app_context = AppContext(config)

		# Create workflow executor
		self.executor = WorkflowExecutor(self.app_context)


	def generate_app(self, workflow_index: int) -> FastAPI:
		"""Generate FastAPI app for workflow execution"""
		workflow = self.config.workflows[workflow_index]

		app = FastAPI(title=f"Workflow: {workflow.name}")

		@app.post("/execute")
		async def execute_workflow(input_data: dict):
			"""Execute the workflow"""
			execution = await self.executor.execute_workflow(
				workflow, 
				input_data
			)
			return {
				"execution_id": execution.execution_id,
				"status": execution.status.value,
				"outputs": execution.state.outputs
			}

		@app.get("/status/{execution_id}")
		async def get_execution_status(execution_id: str):
			"""Get workflow execution status"""
			execution = self.executor.executions.get(execution_id)
			if not execution:
				return {"error": "Execution not found"}
			return {
				"execution_id": execution.execution_id,
				"status": execution.status.value,
				"current_nodes": execution.current_node_ids,
				"completed_nodes": execution.completed_node_ids
			}

		@app.websocket("/events/{execution_id}")
		async def workflow_events(websocket: WebSocket, execution_id: str):
			"""Stream workflow events via WebSocket"""
			await websocket.accept()

			async def event_handler(event: Event):
				if event.execution_id == execution_id:
					await websocket.send_json({
						"type": event.type.value,
						"data": event.data,
						"timestamp": event.timestamp
					})

			self.executor.subscribe_to_events("*", event_handler)

			try:
				while True:
					await sleep(1)
			except:
				pass

		return app


def register() -> bool:
	backend = BackendConfig(
		type    = "workflow",
		version = "1.0.0",
	)
	return register_backend(backend, WorkflowBackend)
