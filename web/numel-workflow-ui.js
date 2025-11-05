/* ========================================================================
   NUMEL WORKFLOW UI - With Context Menu Node Creation
   ======================================================================== */

// Global workflow state
let workflowClient = null;
let workflowVisualizer = null;
let workflowSchemaCode = null;
let currentWorkflow = null;
let currentExecutionId = null;
let executionStartTime = null;
let executionTimer = null;

// DOM elements
let chatModeBtn, workflowModeBtn;
let chatMode, workflowMode;
let workflowSelect, downloadWorkflowBtn, uploadWorkflowBtn, newWorkflowBtn;
let startWorkflowBtn, pauseWorkflowBtn, stopWorkflowBtn;
let workflowStatus, executionInfo, executionId, executionProgress;
let currentNode, executionTime;
let eventLog, clearEventsBtn;
let executionsList, refreshExecutionsBtn;
let userInputModal, userInputPrompt, userInputField;
let submitInputBtn, cancelInputBtn, closeModalBtn;
let workflowFileInput, modeDisplay;

// ========================================================================
// INITIALIZATION
// ========================================================================

function initWorkflowUI() {
	chatModeBtn = document.getElementById('chatModeBtn');
	workflowModeBtn = document.getElementById('workflowModeBtn');
	chatMode = document.getElementById('chatMode');
	workflowMode = document.getElementById('workflowMode');

	workflowSelect = document.getElementById('workflowSelect');
	downloadWorkflowBtn = document.getElementById('downloadWorkflowBtn');
	uploadWorkflowBtn = document.getElementById('uploadWorkflowBtn');
	newWorkflowBtn = document.getElementById('newWorkflowBtn');

	startWorkflowBtn = document.getElementById('startWorkflowBtn');
	pauseWorkflowBtn = document.getElementById('pauseWorkflowBtn');
	stopWorkflowBtn = document.getElementById('stopWorkflowBtn');
	
	workflowStatus = document.getElementById('workflowStatus');
	executionInfo = document.querySelector('.numel-execution-info');
	executionId = document.getElementById('executionId');
	executionProgress = document.getElementById('executionProgress');
	currentNode = document.getElementById('currentNode');
	executionTime = document.getElementById('executionTime');
	
	eventLog = document.getElementById('eventLog');
	clearEventsBtn = document.getElementById('clearEventsBtn');
	
	executionsList = document.getElementById('executionsList');
	refreshExecutionsBtn = document.getElementById('refreshExecutionsBtn');
	
	userInputModal = document.getElementById('userInputModal');
	userInputPrompt = document.getElementById('userInputPrompt');
	userInputField = document.getElementById('userInputField');
	submitInputBtn = document.getElementById('submitInputBtn');
	cancelInputBtn = document.getElementById('cancelInputBtn');
	closeModalBtn = document.getElementById('closeModalBtn');
	
	workflowFileInput = document.getElementById('workflowFileInput');
	modeDisplay = document.getElementById('sg-modeDisplay');
	
	setupWorkflowUIListeners();
	setupContextMenuIntegration();
	loadSampleWorkflows();
}

function setupWorkflowUIListeners() {
	chatModeBtn.addEventListener('click', () => switchMode('chat'));
	workflowModeBtn.addEventListener('click', () => switchMode('workflow'));
	
	workflowSelect.addEventListener('change', onWorkflowSelected);
	downloadWorkflowBtn.addEventListener('click', downloadWorkflowToFile);
	uploadWorkflowBtn.addEventListener('click', uploadWorkflowFromFile);
	newWorkflowBtn.addEventListener('click', createNewWorkflow);
	
	startWorkflowBtn.addEventListener('click', startWorkflow);
	pauseWorkflowBtn.addEventListener('click', pauseWorkflow);
	stopWorkflowBtn.addEventListener('click', stopWorkflow);
	
	clearEventsBtn.addEventListener('click', clearEventLog);
	refreshExecutionsBtn.addEventListener('click', refreshExecutionsList);
	
	submitInputBtn.addEventListener('click', submitUserInput);
	cancelInputBtn.addEventListener('click', closeUserInputModal);
	closeModalBtn.addEventListener('click', closeUserInputModal);
	
	workflowFileInput.addEventListener('change', handleWorkflowFileUpload);
}

// ========================================================================
// CONTEXT MENU INTEGRATION
// ========================================================================

let lastContextMenuPos = { canvasX: 0, canvasY: 0 };
let workflowContextMenuHandler = null;

function setupContextMenuIntegration() {
	const canvas = document.getElementById('sg-main-canvas');
	
	// Create the handler function
	workflowContextMenuHandler = (e) => {
		// Only handle in workflow mode
		if (!workflowModeBtn.classList.contains('active')) {
			return; // Let event propagate normally in chat mode
		}
		
		// Check if click is on a node - if so, don't show custom menu
		const rect = canvas.getBoundingClientRect();
		const canvasX = e.clientX - rect.left;
		const canvasY = e.clientY - rect.top;
		
		// Check if we clicked on a node using SchemaGraph's nodeAtPoint method
		let clickedNode = null;
		if (gGraph && gGraph.canvas && gGraph.canvas.nodeAtPoint) {
			clickedNode = gGraph.canvas.nodeAtPoint(canvasX, canvasY);
		} else if (workflowVisualizer && workflowVisualizer.schemaGraph && 
		           workflowVisualizer.schemaGraph.canvas && 
		           workflowVisualizer.schemaGraph.canvas.nodeAtPoint) {
			clickedNode = workflowVisualizer.schemaGraph.canvas.nodeAtPoint(canvasX, canvasY);
		}
		
		if (clickedNode) {
			// Clicked on a node - let SchemaGraph handle it (show its context menu)
			console.log('Clicked on node, showing SchemaGraph context menu');
			return;
		}
		
		// Clicked on empty space - show our custom menu
		console.log('Clicked on empty space, showing workflow node menu');
		e.preventDefault();
		e.stopPropagation();
		
		lastContextMenuPos.canvasX = canvasX;
		lastContextMenuPos.canvasY = canvasY;
		
		showWorkflowContextMenu(e.clientX, e.clientY);
	};
	
	// Add listener in capture phase
	canvas.addEventListener('contextmenu', workflowContextMenuHandler, true);
	
	// Close context menu on any click outside of it
	document.addEventListener('click', (e) => {
		const contextMenu = document.getElementById('sg-contextMenu');
		if (contextMenu && contextMenu.style.display === 'block') {
			const rect = contextMenu.getBoundingClientRect();
			const isInside = (
				e.clientX >= rect.left &&
				e.clientX <= rect.right &&
				e.clientY >= rect.top &&
				e.clientY <= rect.bottom
			);
			
			if (!isInside) {
				contextMenu.style.display = 'none';
			}
		}
	});
	
	// Close on Escape key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			const contextMenu = document.getElementById('sg-contextMenu');
			if (contextMenu) {
				contextMenu.style.display = 'none';
			}
		}
	});
}

function showWorkflowContextMenu(screenX, screenY) {
	const contextMenu = document.getElementById('sg-contextMenu');
	if (!contextMenu) return;
	
	const nodeTypes = [
		{ value: 'start', label: '🎬 Start Node', desc: 'Entry point' },
		{ value: 'end', label: '🏁 End Node', desc: 'Exit point' },
		{ value: 'agent', label: '🤖 Agent Node', desc: 'AI agent execution' },
		{ value: 'prompt', label: '💭 Prompt Node', desc: 'Template prompt' },
		{ value: 'tool', label: '🔧 Tool Node', desc: 'External tool call' },
		{ value: 'transform', label: '🔄 Transform Node', desc: 'Data transformation' },
		{ value: 'decision', label: '🔀 Decision Node', desc: 'Conditional branching' },
		{ value: 'merge', label: '🔗 Merge Node', desc: 'Combine branches' },
		{ value: 'parallel', label: '⚡ Parallel Node', desc: 'Parallel execution' },
		{ value: 'loop', label: '🔁 Loop Node', desc: 'Iteration loop' },
		{ value: 'user_input', label: '👤 User Input Node', desc: 'Request user input' }
	];
	
	let menuHTML = '<div class="sg-context-menu-title">Add Workflow Node</div>';
	
	nodeTypes.forEach(nodeType => {
		menuHTML += `
			<div class="sg-context-menu-item" data-node-type="${nodeType.value}">
				<span class="sg-context-menu-label">${nodeType.label}</span>
				<span class="sg-context-menu-desc">${nodeType.desc}</span>
			</div>
		`;
	});
	
	contextMenu.innerHTML = menuHTML;
	
	// Position the menu
	contextMenu.style.display = 'block';
	contextMenu.style.left = `${screenX}px`;
	contextMenu.style.top = `${screenY}px`;
	
	// Make sure menu stays on screen
	setTimeout(() => {
		const rect = contextMenu.getBoundingClientRect();
		if (rect.right > window.innerWidth) {
			contextMenu.style.left = `${screenX - rect.width}px`;
		}
		if (rect.bottom > window.innerHeight) {
			contextMenu.style.top = `${screenY - rect.height}px`;
		}
	}, 0);
	
	// Add click handlers to menu items (must be after innerHTML is set)
	const menuItems = contextMenu.querySelectorAll('.sg-context-menu-item');
	menuItems.forEach(item => {
		item.addEventListener('click', (e) => {
			e.stopPropagation();
			const nodeType = item.getAttribute('data-node-type');
			console.log('Context menu clicked:', nodeType);
			addWorkflowNodeAtPosition(nodeType);
			contextMenu.style.display = 'none';
		});
	});
}

function addWorkflowNodeAtPosition(nodeType) {
	if (!currentWorkflow || !workflowVisualizer) {
		alert('Please load a workflow first');
		return;
	}
	
	console.log('Adding node at canvas position:', lastContextMenuPos);
	
	// Use canvas coordinates directly
	const graphPos = {
		x: lastContextMenuPos.canvasX,
		y: lastContextMenuPos.canvasY
	};
	
	console.log('Using position:', graphPos);
	
	const nodeId = `${nodeType}_${Date.now()}`;
	const node = {
		id: nodeId,
		type: nodeType,
		label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace('_', ' '),
		position: { x: graphPos.x, y: graphPos.y }
	};
	
	// Add node configuration based on type
	switch(nodeType) {
		case 'agent':
			node.agent_index = 0;
			break;
		case 'prompt':
			node.template = 'Enter your prompt template here';
			break;
		case 'tool':
			node.tool_index = 0;
			break;
		case 'transform':
			node.operation = 'pass_through';
			break;
		case 'decision':
			node.conditions = [];
			break;
		case 'loop':
			node.max_iterations = 10;
			break;
		case 'user_input':
			node.prompt = 'Please provide input:';
			break;
	}
	
	// Add to workflow
	const nodeIndex = currentWorkflow.nodes.length;
	currentWorkflow.nodes.push(node);
	
	console.log('Node added to workflow:', node);
	console.log('Total nodes:', currentWorkflow.nodes.length);
	
	// Add node directly to the visualizer without reloading entire workflow
	if (workflowVisualizer && workflowVisualizer.addNode) {
		// If visualizer has an addNode method, use it
		workflowVisualizer.addNode(node, nodeIndex);
	} else if (workflowVisualizer) {
		// Otherwise, just update the current workflow and redraw without layout
		// First, export current positions to preserve them
		const exported = workflowVisualizer.exportWorkflow();
		if (exported && exported.nodes) {
			// Update positions in currentWorkflow
			currentWorkflow.nodes.forEach((n, idx) => {
				if (exported.nodes[idx]) {
					n.position = exported.nodes[idx].position;
				}
			});
		}
		// Now reload with the new node
		workflowVisualizer.loadWorkflow(currentWorkflow, false);
	}
	
	addEventLogItem('system', `➕ Added ${nodeType} node at (${Math.round(graphPos.x)}, ${Math.round(graphPos.y)})`);
}

// ========================================================================
// MODE SWITCHING
// ========================================================================

function switchMode(mode) {
	// Clear any open context menu when switching modes
	const contextMenu = document.getElementById('sg-contextMenu');
	if (contextMenu) {
		contextMenu.style.display = 'none';
		// Don't clear innerHTML - SchemaGraph might need it in chat mode
	}
	
	if (mode === 'chat') {
		chatModeBtn.classList.add('active');
		workflowModeBtn.classList.remove('active');
		chatMode.style.display = 'flex';
		workflowMode.style.display = 'none';
		modeDisplay.textContent = 'Chat';
		
		if (workflowVisualizer && workflowVisualizer.isInWorkflowMode()) {
			if (currentWorkflow) {
				currentWorkflow = workflowVisualizer.exportWorkflow() || currentWorkflow;
			}
			workflowVisualizer.exitWorkflowMode();
		}
		
		// Force a small delay to allow SchemaGraph to reinitialize its context menu
		setTimeout(() => {
			if (gGraph && gGraph.canvas) {
				gGraph.canvas.draw();
			}
		}, 100);
		
	} else {
		chatModeBtn.classList.remove('active');
		workflowModeBtn.classList.add('active');
		chatMode.style.display = 'none';
		workflowMode.style.display = 'flex';
		modeDisplay.textContent = 'Workflow';
		
		if (!workflowClient && gApp) {
			initWorkflowClient();
		}

		if (workflowVisualizer) {
			if (!workflowVisualizer.isInWorkflowMode()) {
				workflowVisualizer.enterWorkflowMode();
			}
			
			if (currentWorkflow) {
				workflowVisualizer.loadWorkflow(currentWorkflow, false);
			}
		}
	}
}

// ========================================================================
// WORKFLOW CLIENT INITIALIZATION
// ========================================================================

async function initWorkflowClient() {
	const serverUrl = document.getElementById('serverUrl').value.trim();
	
	workflowClient = new WorkflowClient(serverUrl);
	workflowVisualizer = new WorkflowVisualizer(gGraph);
	
	try {
		await loadWorkflowSchema();
	} catch (error) {
		console.error('Failed to load workflow schema:', error);
		addEventLogItem('workflow-failed', '⚠️ Warning: Workflow schema not loaded - using basic visualization');
	}
	
	workflowClient.connectWebSocket();
	setupWorkflowEventHandlers();
	addEventLogItem('system', 'Workflow client initialized');
}

async function loadWorkflowSchema() {
	const response = await fetch(`${workflowClient.baseUrl}/workflow/schema`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	});
	
	if (!response.ok) {
		throw new Error('Failed to load workflow schema');
	}
	
	const schemaData = await response.json();
	workflowSchemaCode = schemaData.schema;
	workflowVisualizer.registerWorkflowSchema(workflowSchemaCode);
	
	console.log('✅ Workflow schema loaded and registered');
}

function setupWorkflowEventHandlers() {
	workflowClient.on('connected', () => {
		addEventLogItem('system', '✅ WebSocket connected');
		updateWorkflowStatus('connected', 'Connected');
	});
	
	workflowClient.on('disconnected', () => {
		addEventLogItem('system', '❌ WebSocket disconnected');
		updateWorkflowStatus('disconnected', 'Disconnected');
	});
	
	workflowClient.on('workflow.started', (event) => {
		addEventLogItem('workflow-started', `🚀 Workflow started: ${event.execution_id}`);
		currentExecutionId = event.execution_id;
		executionStartTime = Date.now();
		startExecutionTimer();
		updateExecutionInfo(event);
		updateWorkflowControls('running');
		refreshExecutionsList();
	});
	
	workflowClient.on('workflow.completed', (event) => {
		addEventLogItem('workflow-completed', `✅ Workflow completed`);
		stopExecutionTimer();
		updateWorkflowControls('completed');
		refreshExecutionsList();
		workflowVisualizer.clearHighlights();
	});
	
	workflowClient.on('workflow.failed', (event) => {
		addEventLogItem('workflow-failed', `❌ Workflow failed: ${event.error || 'Unknown error'}`);
		stopExecutionTimer();
		updateWorkflowControls('failed');
		refreshExecutionsList();
	});
	
	workflowClient.on('workflow.cancelled', (event) => {
		addEventLogItem('workflow-failed', `⏹️ Workflow cancelled`);
		stopExecutionTimer();
		updateWorkflowControls('idle');
		refreshExecutionsList();
	});
	
	workflowClient.on('node.started', (event) => {
		const nodeIndex = parseInt(event.node_id);
		const nodeLabel = event.data?.node_label || `Node ${nodeIndex}`;
		addEventLogItem('node-started', `▶️ [${nodeIndex}] ${nodeLabel} started`);
		if (currentNode) currentNode.textContent = `[${nodeIndex}] ${nodeLabel}`;
		if (workflowVisualizer) {
			workflowVisualizer.updateNodeState(nodeIndex, { status: 'running' });
		}
	});
	
	workflowClient.on('node.completed', (event) => {
		const nodeIndex = parseInt(event.node_id);
		const nodeLabel = event.data?.node_label || `Node ${nodeIndex}`;
		addEventLogItem('node-completed', `✔ [${nodeIndex}] ${nodeLabel} completed`);
		if (workflowVisualizer) {
			workflowVisualizer.updateNodeState(nodeIndex, { 
				status: 'completed',
				output: event.data?.output 
			});
		}
		updateExecutionProgress(event);
	});
	
	workflowClient.on('node.failed', (event) => {
		const nodeIndex = parseInt(event.node_id);
		const nodeLabel = event.data?.node_label || `Node ${nodeIndex}`;
		addEventLogItem('node-failed', `✗ [${nodeIndex}] ${nodeLabel} failed: ${event.error || 'Unknown error'}`);
		if (workflowVisualizer) {
			workflowVisualizer.updateNodeState(nodeIndex, { 
				status: 'failed',
				error: event.error 
			});
		}
	});
	
	workflowClient.on('node.waiting', (event) => {
		const nodeIndex = parseInt(event.node_id);
		const nodeLabel = event.data?.node_label || `Node ${nodeIndex}`;
		addEventLogItem('node-started', `⏱️ [${nodeIndex}] ${nodeLabel} waiting`);
		if (workflowVisualizer) {
			workflowVisualizer.updateNodeState(nodeIndex, { status: 'waiting' });
		}
	});
	
	workflowClient.on('user_input.requested', (event) => {
		const nodeIndex = parseInt(event.node_id);
		addEventLogItem('user-input-requested', `👤 User input requested: [${nodeIndex}]`);
		showUserInputModal(event);
	});
	
	workflowClient.on('user_input.received', (event) => {
		addEventLogItem('user-input-requested', `✔ User input received`);
	});
}

// ========================================================================
// WORKFLOW MANAGEMENT
// ========================================================================

const workflowLibrary = new Map();

function loadSampleWorkflows() {
	const simpleWorkflow = {
		info: { name: 'Simple Test', version: '1.0.0' },
		nodes: [
			{ id: 'start', type: 'start', label: 'Start', position: {x: 100, y: 100} },
			{ id: 'end', type: 'end', label: 'End', position: {x: 100, y: 200} }
		],
		edges: [
			{ source: 0, target: 1 }
		]
	};
	
	workflowLibrary.set('simple', simpleWorkflow);
	updateWorkflowSelect();
}

function updateWorkflowSelect() {
	workflowSelect.innerHTML = '<option value="">Select workflow...</option>';
	
	for (const [key, workflow] of workflowLibrary.entries()) {
		const option = document.createElement('option');
		option.value = key;
		option.textContent = workflow.info?.name || key;
		workflowSelect.appendChild(option);
	}
}

function onWorkflowSelected() {
	const key = workflowSelect.value;
	if (!key) return;
	
	currentWorkflow = workflowLibrary.get(key);
	if (currentWorkflow && workflowVisualizer) {
		workflowVisualizer.loadWorkflow(currentWorkflow, true);
		startWorkflowBtn.disabled = false;
		downloadWorkflowBtn.disabled = false;
		updateWorkflowStatus('idle', 'Ready');
		addEventLogItem('system', `📂 Loaded workflow: ${currentWorkflow.info?.name || key}`);
		
		if (currentWorkflow.edges) {
			currentWorkflow.edges.forEach((edge, idx) => {
				if (edge.condition) {
					console.log(`Edge ${idx}: [${edge.source}] -> [${edge.target}]`, edge.condition);
				}
			});
		}
	}
}

function uploadWorkflowFromFile() {
	workflowFileInput.click();
}

function downloadWorkflowToFile() {
	if (!currentWorkflow) {
		alert('No workflow selected');
		return;
	}
	
	const exportedWorkflow = workflowVisualizer.exportWorkflow();
	const json = JSON.stringify(exportedWorkflow || currentWorkflow, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = `${currentWorkflow.info?.name || 'workflow'}.json`;
	a.click();
	
	URL.revokeObjectURL(url);
	addEventLogItem('system', `💾 Workflow downloaded`);
}

function handleWorkflowFileUpload(event) {
	const file = event.target.files[0];
	if (!file) return;
	
	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			const workflow = JSON.parse(e.target.result);
			const key = workflow.info?.name || `workflow_${Date.now()}`;
			workflowLibrary.set(key, workflow);
			updateWorkflowSelect();
			workflowSelect.value = key;
			
			currentWorkflow = workflow;
			if (workflowVisualizer) {
				workflowVisualizer.loadWorkflow(currentWorkflow, true);
			}
			
			addEventLogItem('system', `📂 Workflow uploaded: ${key}`);
		} catch (error) {
			addEventLogItem('workflow-failed', `❌ Failed to upload workflow: ${error.message}`);
		}
	};
	reader.readAsText(file);
	
	event.target.value = '';
}

function createNewWorkflow() {
	const name = prompt('Enter workflow name:');
	if (!name) return;
	
	const workflow = {
		info: { name, version: '1.0.0' },
		nodes: [],
		edges: [],
		variables: {}
	};
	
	const key = name.toLowerCase().replace(/\s+/g, '_');
	workflowLibrary.set(key, workflow);
	updateWorkflowSelect();
	workflowSelect.value = key;
	onWorkflowSelected();
	
	addEventLogItem('system', `📄 New workflow created: ${name}`);
}

// ========================================================================
// WORKFLOW EXECUTION
// ========================================================================

async function startWorkflow() {
	if (!currentWorkflow || !workflowClient) {
		alert('No workflow loaded or client not initialized');
		return;
	}
	
	try {
		startWorkflowBtn.disabled = true;
		updateWorkflowStatus('running', 'Starting...');
		
		const result = await workflowClient.startWorkflow(currentWorkflow, {});
		
		currentExecutionId = result.execution_id;
		updateWorkflowStatus('running', 'Running');
		
	} catch (error) {
		addEventLogItem('workflow-failed', `❌ Failed to start workflow: ${error.message}`);
		updateWorkflowStatus('failed', 'Failed to start');
		startWorkflowBtn.disabled = false;
	}
}

async function pauseWorkflow() {
	addEventLogItem('system', '⏸️ Pause not yet implemented');
}

async function stopWorkflow() {
	if (!currentExecutionId || !workflowClient) return;
	
	try {
		stopWorkflowBtn.disabled = true;
		await workflowClient.cancelWorkflow(currentExecutionId);
		addEventLogItem('system', '⏹️ Workflow stopped');
	} catch (error) {
		addEventLogItem('workflow-failed', `❌ Failed to stop workflow: ${error.message}`);
	} finally {
		stopWorkflowBtn.disabled = false;
	}
}

function updateWorkflowControls(state) {
	if (state === 'running') {
		startWorkflowBtn.disabled = true;
		pauseWorkflowBtn.disabled = false;
		stopWorkflowBtn.disabled = false;
		downloadWorkflowBtn.disabled = true;
		uploadWorkflowBtn.disabled = true;
		newWorkflowBtn.disabled = true;
		executionInfo.style.display = 'block';
	} else {
		startWorkflowBtn.disabled = !currentWorkflow;
		pauseWorkflowBtn.disabled = true;
		stopWorkflowBtn.disabled = true;
		downloadWorkflowBtn.disabled = !currentWorkflow;
		uploadWorkflowBtn.disabled = false;
		newWorkflowBtn.disabled = false;
		if (state !== 'running') {
			setTimeout(() => {
				if (startWorkflowBtn.disabled === false) {
					executionInfo.style.display = 'none';
				}
			}, 5000);
		}
	}
}

// ========================================================================
// EXECUTION MONITORING
// ========================================================================

function updateExecutionInfo(event) {
	if (executionId) {
		executionId.textContent = event.execution_id.substring(0, 8) + '...';
	}
	if (executionProgress) {
		executionProgress.style.width = '0%';
	}
}

function updateExecutionProgress(event) {
	if (!currentWorkflow || !event.data) return;
	
	const totalNodes = currentWorkflow.nodes.length;
	const progress = Math.min(100, (parseFloat(executionProgress.style.width) || 0) + (100 / totalNodes));
	executionProgress.style.width = `${progress}%`;
}

function startExecutionTimer() {
	stopExecutionTimer();
	executionTimer = setInterval(() => {
		if (!executionStartTime) return;
		const elapsed = Math.floor((Date.now() - executionStartTime) / 1000);
		if (executionTime) {
			executionTime.textContent = formatTime(elapsed);
		}
	}, 1000);
}

function stopExecutionTimer() {
	if (executionTimer) {
		clearInterval(executionTimer);
		executionTimer = null;
	}
}

function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ========================================================================
// EVENT LOG
// ========================================================================

function addEventLogItem(type, message) {
	const item = document.createElement('div');
	item.className = `numel-event-item ${type}`;
	
	const time = new Date().toLocaleTimeString();
	const typeLabel = type.replace(/-/g, '.').replace(/^(.)/g, c => c.toUpperCase());
	
	item.innerHTML = `
		<span class="numel-event-time">${time}</span>
		<span class="numel-event-type">${typeLabel}</span>
		<span class="numel-event-message">${message}</span>
	`;
	
	eventLog.appendChild(item);
	eventLog.scrollTop = eventLog.scrollHeight;
	
	while (eventLog.children.length > 100) {
		eventLog.removeChild(eventLog.firstChild);
	}
}

function clearEventLog() {
	eventLog.innerHTML = '';
	addEventLogItem('system', 'Event log cleared');
}

// ========================================================================
// EXECUTIONS LIST & USER INPUT
// ========================================================================

async function refreshExecutionsList() {
	if (!workflowClient) return;
	
	try {
		const executions = await workflowClient.listWorkflows();
		renderExecutionsList(executions);
	} catch (error) {
		console.error('Failed to refresh executions:', error);
	}
}

function renderExecutionsList(executions) {
	executionsList.innerHTML = '';
	
	if (executions.length === 0) return;
	
	executions.slice(0, 10).forEach(execution => {
		const item = document.createElement('div');
		item.className = 'numel-execution-item';
		if (execution.execution_id === currentExecutionId) {
			item.classList.add('active');
		}
		
		const statusClass = execution.status.toLowerCase();
		const time = execution.start_time ? new Date(execution.start_time).toLocaleTimeString() : '-';
		
		item.innerHTML = `
			<div class="numel-execution-header">
				<span class="numel-execution-name">${execution.workflow_id}</span>
				<span class="numel-execution-status ${statusClass}">${execution.status}</span>
			</div>
			<div class="numel-execution-meta">
				<span>🕐 ${time}</span>
				<span>🆔 ${execution.execution_id.substring(0, 8)}...</span>
			</div>
		`;
		
		item.addEventListener('click', () => selectExecution(execution));
		executionsList.appendChild(item);
	});
}

async function selectExecution(execution) {
	currentExecutionId = execution.execution_id;
	
	try {
		const state = await workflowClient.getWorkflowStatus(execution.execution_id);
		console.log('Execution state:', state);
	} catch (error) {
		console.error('Failed to get execution state:', error);
	}
	
	refreshExecutionsList();
}

let pendingInputEvent = null;

function showUserInputModal(event) {
	pendingInputEvent = event;
	userInputPrompt.textContent = event.data?.prompt || 'Please provide input:';
	userInputField.value = '';
	userInputModal.style.display = 'flex';
	userInputField.focus();
}

function closeUserInputModal() {
	userInputModal.style.display = 'none';
	pendingInputEvent = null;
	userInputField.value = '';
}

async function submitUserInput() {
	if (!pendingInputEvent || !workflowClient) return;
	
	const input = userInputField.value.trim();
	if (!input) {
		alert('Please enter a value');
		return;
	}
	
	try {
		await workflowClient.provideUserInput(
			pendingInputEvent.execution_id,
			pendingInputEvent.node_id,
			input
		);
		closeUserInputModal();
	} catch (error) {
		alert(`Failed to submit input: ${error.message}`);
	}
}

function updateWorkflowStatus(type, message) {
	workflowStatus.className = `numel-status numel-status-${type}`;
	workflowStatus.textContent = message;
}

// ========================================================================
// INTEGRATION WITH MAIN APP
// ========================================================================

const originalConnect = window.connect;
window.connect = async function() {
	await originalConnect?.();
	
	setTimeout(() => {
		if (workflowModeBtn.classList.contains('active')) {
			initWorkflowClient();
		}
	}, 500);
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initWorkflowUI);
} else {
	initWorkflowUI();
}
