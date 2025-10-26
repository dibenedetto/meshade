// numel-workflow.js

class NumelWorkflowApp {
	
	constructor() {
		this.editor = null;
		this.executor = null;
	}
	
	async initialize(canvasId) {
		// Initialize workflow editor
		this.editor = new WorkflowEditor(canvasId);
		
		// Setup event listeners
		this.setupEventListeners();
	}
	
	setupEventListeners() {
		// Node palette
		document.getElementById('nodePalette').addEventListener('click', (e) => {
			const nodeType = e.target.dataset.nodeType;
			if (nodeType) {
				this.editor.addNode(nodeType);
			}
		});
		
		// Execute workflow button
		document.getElementById('executeWorkflow').addEventListener('click', () => {
			this.executeWorkflow();
		});
		
		// Export/Import buttons
		document.getElementById('exportWorkflow').addEventListener('click', () => {
			this.exportWorkflow();
		});
		
		document.getElementById('importWorkflow').addEventListener('click', () => {
			this.importWorkflow();
		});
	}
	
	async executeWorkflow() {
		const workflow = this.editor.exportWorkflow();
		
		// Validate workflow
		const validation = this.editor.validateWorkflow();
		if (!validation.valid) {
			alert('Workflow validation failed:\n' + validation.errors.join('\n'));
			return;
		}
		
		// Send to backend for execution
		const response = await fetch('/workflow/execute', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				workflow: workflow,
				input: { message: 'Start workflow' }
			})
		});
		
		const result = await response.json();
		console.log('Workflow execution started:', result);
		
		// Connect to event stream
		this.connectToEventStream(result.execution_id);
	}
	
	connectToEventStream(executionId) {
		const ws = new WebSocket(`ws://localhost:8000/workflow/events/${executionId}`);
		
		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			console.log('Workflow event:', data);
			
			// Update UI with event
			this.handleWorkflowEvent(data);
		};
	}
	
	handleWorkflowEvent(event) {
		// Highlight current node
		if (event.type === 'node.start') {
			this.editor.highlightNode(event.data.node_id);
		}
		
		// Show completion
		if (event.type === 'workflow.end') {
			alert('Workflow completed!');
		}
	}
	
	exportWorkflow() {
		const workflow = this.editor.exportWorkflow();
		const json = JSON.stringify(workflow, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${workflow.name}.json`;
		a.click();
	}
	
	async importWorkflow() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		
		input.onchange = async (e) => {
			const file = e.target.files[0];
			const text = await file.text();
			const workflow = JSON.parse(text);
			this.editor.importWorkflow(workflow);
		};
		
		input.click();
	}
}
