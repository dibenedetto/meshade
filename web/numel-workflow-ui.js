/* ========================================================================
   NUMEL WORKFLOW UI - Updated with Schema Registration
   ======================================================================== */

// Global workflow state
let workflowClient = null;
let workflowVisualizer = null;
let workflowSchemaCode = null;  // Store workflow schema
let currentWorkflow = null;
let currentExecutionId = null;
let executionStartTime = null;
let executionTimer = null;

// ... DOM elements (same as before) ...
let chatModeBtn, workflowModeBtn;
let chatMode, workflowMode;
let workflowSelect, loadWorkflowBtn, saveWorkflowBtn, newWorkflowBtn;
let startWorkflowBtn, pauseWorkflowBtn, stopWorkflowBtn;
let workflowStatus, executionInfo, executionId, executionProgress;
let currentNode, executionTime;
let eventLog, clearEventsBtn;
let executionsList, refreshExecutionsBtn;
let userInputModal, userInputPrompt, userInputField;
let submitInputBtn, cancelInputBtn, closeModalBtn;
let workflowFileInput, nodeTypeSelect, addNodeBtn;
let workflowTools, modeDisplay;

// ========================================================================
// INITIALIZATION
// ========================================================================

function initWorkflowUI() {
	// Get DOM elements (same as before)
	chatModeBtn = document.getElementById('chatModeBtn');
	workflowModeBtn = document.getElementById('workflowModeBtn');
	chatMode = document.getElementById('chatMode');
	workflowMode = document.getElementById('workflowMode');
	
	workflowSelect = document.getElementById('workflowSelect');
	loadWorkflowBtn = document.getElementById('loadWorkflowBtn');
	saveWorkflowBtn = document.getElementById('saveWorkflowBtn');
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
	nodeTypeSelect = document.getElementById('nodeTypeSelect');
	addNodeBtn = document.getElementById('addNodeBtn');
	workflowTools = document.getElementById('workflowTools');
	modeDisplay = document.getElementById('sg-modeDisplay');
	
	// Setup event listeners
	setupWorkflowUIListeners();
	
	// Load sample workflows
	loadSampleWorkflows();
}

function setupWorkflowUIListeners() {
	// Mode switching
	chatModeBtn.addEventListener('click', () => switchMode('chat'));
	workflowModeBtn.addEventListener('click', () => switchMode('workflow'));
	
	// Workflow selection
	workflowSelect.addEventListener('change', onWorkflowSelected);
	loadWorkflowBtn.addEventListener('click', loadWorkflowFromFile);
	saveWorkflowBtn.addEventListener('click', saveWorkflowToFile);
	newWorkflowBtn.addEventListener('click', createNewWorkflow);
	
	// Workflow controls
	startWorkflowBtn.addEventListener('click', startWorkflow);
	pauseWorkflowBtn.addEventListener('click', pauseWorkflow);
	stopWorkflowBtn.addEventListener('click', stopWorkflow);
	
	// Event log
	clearEventsBtn.addEventListener('click', clearEventLog);
	
	// Executions list
	refreshExecutionsBtn.addEventListener('click', refreshExecutionsList);
	
	// User input modal
	submitInputBtn.addEventListener('click', submitUserInput);
	cancelInputBtn.addEventListener('click', closeUserInputModal);
	closeModalBtn.addEventListener('click', closeUserInputModal);
	
	// File input
	workflowFileInput.addEventListener('change', handleWorkflowFileUpload);
	
	// Node creation
	addNodeBtn.addEventListener('click', addWorkflowNode);
}

// ========================================================================
// MODE SWITCHING
// ========================================================================

function switchMode(mode) {
	if (mode === 'chat') {
		chatModeBtn.classList.add('active');
		workflowModeBtn.classList.remove('active');
		chatMode.style.display = 'flex';
		workflowMode.style.display = 'none';
		workflowTools.style.display = 'none';
		modeDisplay.textContent = 'Chat';
		
		// Exit workflow mode (saves state)
		if (workflowVisualizer && workflowVisualizer.isInWorkflowMode()) {
			// 🔧 FIX: Update currentWorkflow with current graph state before exiting
			if (currentWorkflow) {
				currentWorkflow = workflowVisualizer.exportWorkflow() || currentWorkflow;
			}
			workflowVisualizer.exitWorkflowMode();
		}
	} else {
		chatModeBtn.classList.remove('active');
		workflowModeBtn.classList.add('active');
		chatMode.style.display = 'none';
		workflowMode.style.display = 'flex';
		workflowTools.style.display = 'flex';
		modeDisplay.textContent = 'Workflow';
		
		// Initialize workflow client if needed
		if (!workflowClient && gApp) {
			initWorkflowClient();
		}

		if (workflowVisualizer) {
			// Enter workflow mode
			if (!workflowVisualizer.isInWorkflowMode()) {
				workflowVisualizer.enterWorkflowMode();
			}
			
			// Always reload the workflow fresh (don't try to restore state)
			if (currentWorkflow) {
				workflowVisualizer.loadWorkflow(currentWorkflow, false); // false = don't re-layout
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
	
	// Get workflow schema from server
	try {
		await loadWorkflowSchema();
	} catch (error) {
		console.error('Failed to load workflow schema:', error);
		addEventLogItem('workflow-failed', '⚠️ Warning: Workflow schema not loaded - using basic visualization');
	}
	
	// Connect WebSocket
	workflowClient.connectWebSocket();
	
	// Setup event handlers
	setupWorkflowEventHandlers();
	
	addEventLogItem('system', 'Workflow client initialized');
}

/**
 * Load workflow schema from server
 */
async function loadWorkflowSchema() {
	// Get schema from server (similar to how app schema is loaded)
	const response = await fetch(`${workflowClient.baseUrl}/workflow/schema`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	});
	
	if (!response.ok) {
		throw new Error('Failed to load workflow schema');
	}
	
	const schemaData = await response.json();
	workflowSchemaCode = schemaData.schema;
	
	// Register schema with visualizer
	workflowVisualizer.registerWorkflowSchema(workflowSchemaCode);
	
	console.log('✅ Workflow schema loaded and registered');
}

function setupWorkflowEventHandlers() {
	// Connection events
	workflowClient.on('connected', () => {
		addEventLogItem('system', '✅ WebSocket connected');
		updateWorkflowStatus('connected', 'Connected');
	});
	
	workflowClient.on('disconnected', () => {
		addEventLogItem('system', '❌ WebSocket disconnected');
		updateWorkflowStatus('disconnected', 'Disconnected');
	});
	
	// Workflow events
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
	
	// Node events (now using integer indices)
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
		addEventLogItem('node-completed', `✓ [${nodeIndex}] ${nodeLabel} completed`);
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
	
	// User input events
	workflowClient.on('user_input.requested', (event) => {
		const nodeIndex = parseInt(event.node_id);
		addEventLogItem('user-input-requested', `👤 User input requested: [${nodeIndex}]`);
		showUserInputModal(event);
	});
	
	workflowClient.on('user_input.received', (event) => {
		addEventLogItem('user-input-requested', `✓ User input received`);
	});
}

// ========================================================================
// WORKFLOW MANAGEMENT
// ========================================================================

const workflowLibrary = new Map();

function loadSampleWorkflows() {
	// Add sample workflows to library
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
	
	// Update select
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
		// 🔧 FIX: Always apply layout when explicitly selecting a workflow
		workflowVisualizer.loadWorkflow(currentWorkflow, true);
		startWorkflowBtn.disabled = false;
		updateWorkflowStatus('idle', 'Ready');
		addEventLogItem('system', `📂 Loaded workflow: ${currentWorkflow.info?.name || key}`);
		
		// Log edge conditions for debugging
		if (currentWorkflow.edges) {
			currentWorkflow.edges.forEach((edge, idx) => {
				if (edge.condition) {
					console.log(`Edge ${idx}: [${edge.source}] -> [${edge.target}]`, edge.condition);
				}
			});
		}
	}
}

function loadWorkflowFromFile() {
	workflowFileInput.click();
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
			
			// 🔧 FIX: Apply layout when loading a new workflow file
			currentWorkflow = workflow;
			if (workflowVisualizer) {
				workflowVisualizer.loadWorkflow(currentWorkflow, true);
			}
			
			addEventLogItem('system', `📂 Imported workflow: ${key}`);
		} catch (error) {
			addEventLogItem('workflow-failed', `❌ Failed to load workflow: ${error.message}`);
		}
	};
	reader.readAsText(file);
	
	// Reset input
	event.target.value = '';
}

function saveWorkflowToFile() {
	if (!currentWorkflow) {
		alert('No workflow selected');
		return;
	}
	
	// Export with updated positions from graph
	const exportedWorkflow = workflowVisualizer.exportWorkflow();
	const json = JSON.stringify(exportedWorkflow || currentWorkflow, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = `${currentWorkflow.info?.name || 'workflow'}.json`;
	a.click();
	
	URL.revokeObjectURL(url);
	addEventLogItem('system', `💾 Saved workflow`);
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
		executionInfo.style.display = 'block';
	} else {
		startWorkflowBtn.disabled = !currentWorkflow;
		pauseWorkflowBtn.disabled = true;
		stopWorkflowBtn.disabled = true;
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
// EXECUTIONS LIST & USER INPUT (same as before)
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

function addWorkflowNode() {
	const nodeType = nodeTypeSelect.value;
	if (!nodeType || !currentWorkflow) {
		alert('Select a node type and load a workflow first');
		return;
	}
	
	const nodeId = `${nodeType}_${Date.now()}`;
	const node = {
		id: nodeId,
		type: nodeType,
		label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
		position: { x: 200, y: 200 }
	};
	
	currentWorkflow.nodes.push(node);
	
	if (workflowVisualizer) {
		workflowVisualizer.loadWorkflow(currentWorkflow);
	}
	
	addEventLogItem('system', `➕ Added ${nodeType} node: ${nodeId}`);
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
