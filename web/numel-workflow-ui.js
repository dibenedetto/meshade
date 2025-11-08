/* ========================================================================
   NUMEL WORKFLOW UI - COMPLETE REWRITE WITH FIXES
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
// SYNCHRONIZATION HELPER
// ========================================================================

function syncPositionsToCurrentWorkflow() {
	if (!workflowVisualizer || !currentWorkflow) return 0;
	
	let syncedCount = 0;
	workflowVisualizer.workflowNodes.forEach((graphNode, index) => {
		if (graphNode && graphNode.pos && currentWorkflow.nodes[index]) {
			currentWorkflow.nodes[index].position = {
				x: Math.round(graphNode.pos[0]),
				y: Math.round(graphNode.pos[1])
			};
			syncedCount++;
		}
	});
	
	// Keep visualizer reference in sync
	workflowVisualizer.currentWorkflow = currentWorkflow;

	// CRITICAL: Update workflow library
	const selectedKey = workflowSelect.value;
	if (selectedKey) {
		workflowLibrary.set(selectedKey, currentWorkflow);
	}

	return syncedCount;
}

// ========================================================================
// CUSTOM CONTEXT MENU HANDLER
// ========================================================================

function addWorkflowNodeAtPosition(nodeType, wx, wy) {
	console.log('=== ADD NODE DEBUG START ===');
	console.log('currentWorkflow before add:', currentWorkflow);
	console.log('nodes.length before add:', currentWorkflow?.nodes.length);
	
	if (!currentWorkflow || !workflowVisualizer) {
		alert('Please load a workflow first');
		return;
	}
	
	const nodeId = `${nodeType}_${Date.now()}`;
	const node = {
		id: nodeId,
		type: nodeType,
		label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1).replace('_', ' '),
		position: { x: Math.round(wx), y: Math.round(wy) }
	};
	
	switch(nodeType) {
		case 'agent': node.agent_index = 0; break;
		case 'prompt': node.template = 'Enter your prompt template here'; break;
		case 'tool': node.tool_index = 0; break;
		case 'transform': node.operation = 'pass_through'; break;
		case 'decision': node.conditions = []; break;
		case 'loop': node.max_iterations = 10; break;
		case 'user_input': node.prompt = 'Please provide input:'; break;
	}
	
	syncPositionsToCurrentWorkflow();
	
	currentWorkflow.nodes.push(node);
	
	console.log('nodes.length after add:', currentWorkflow.nodes.length);
	console.log('workflowLibrary has key:', workflowSelect.value, '?', workflowLibrary.has(workflowSelect.value));
	console.log('library workflow nodes.length:', workflowLibrary.get(workflowSelect.value)?.nodes.length);
	
	workflowVisualizer.savedWorkflowViewState = null;
	workflowVisualizer.loadWorkflow(currentWorkflow, false, false);
	
	if (gGraph?.api?.util) gGraph.api.util.redraw();
	
	addEventLogItem('system', `➕ Added ${nodeType} node [${currentWorkflow.nodes.length - 1}]`);
	console.log('=== ADD NODE DEBUG END ===');
}

// ========================================================================
// MODE SWITCHING
// ========================================================================

async function switchMode(mode) {
	console.log('=== SWITCHING MODE TO:', mode, '===');
	console.log('Current workflow:', currentWorkflow ? `${currentWorkflow.nodes.length} nodes` : 'none');
	
	if (mode === 'chat') {
		chatModeBtn.classList.add('active');
		workflowModeBtn.classList.remove('active');
		chatMode.style.display = 'flex';
		workflowMode.style.display = 'none';
		modeDisplay.textContent = 'Chat';
		
		// Sync positions before exiting
		if (workflowVisualizer && workflowVisualizer.isInWorkflowMode() && currentWorkflow) {
			// CRITICAL: Sync positions
			workflowVisualizer.workflowNodes.forEach((graphNode, index) => {
				if (graphNode && graphNode.pos && currentWorkflow.nodes[index]) {
					currentWorkflow.nodes[index].position = {
						x: Math.round(graphNode.pos[0]),
						y: Math.round(graphNode.pos[1])
					};
				}
			});
			
			// CRITICAL: Keep both references pointing to same object
			workflowVisualizer.currentWorkflow = currentWorkflow;
			
			console.log(`💾 Synced ${currentWorkflow.nodes.length} nodes (${workflowVisualizer.workflowNodes.length} in visualizer)`);
		}

		// Disable workflow schema, enable chat schemas
		if (gGraph && gGraph.api && gGraph.api.schema) {
			const schemas = gGraph.api.schema.list();
			schemas.forEach(schemaName => {
				if (schemaName === WORKFLOW_SCHEMA_NAME) {
					gGraph.api.schema.disable(WORKFLOW_SCHEMA_NAME);
				} else {
					gGraph.api.schema.enable(schemaName);
				}
			});
		}
		
		// Exit workflow mode
		if (workflowVisualizer && workflowVisualizer.isInWorkflowMode()) {
			workflowVisualizer.exitWorkflowMode();
		}
		
		// Redraw canvas
		if (gGraph && gGraph.api && gGraph.api.util) {
			setTimeout(() => {
				gGraph.api.util.redraw();
			}, 100);
		}
	} else {
		console.log('=== SWITCH TO WORKFLOW DEBUG ===');
		console.log('currentWorkflow at start:', currentWorkflow);
		console.log('nodes.length at start:', currentWorkflow?.nodes.length);
		console.log('workflowSelect.value:', workflowSelect.value);
		console.log('library workflow nodes.length:', workflowLibrary.get(workflowSelect.value)?.nodes.length);
		
		chatModeBtn.classList.remove('active');
		workflowModeBtn.classList.add('active');
		chatMode.style.display = 'none';
		workflowMode.style.display = 'flex';
		modeDisplay.textContent = 'Workflow';
		
		if (!workflowClient && gGraph) {
			await initWorkflowClient();
		}
		
		if (gGraph && gGraph.api && gGraph.api.schema) {
			const schemas = gGraph.api.schema.list();
			schemas.forEach(schemaName => {
				if (schemaName === WORKFLOW_SCHEMA_NAME) {
					gGraph.api.schema.enable(WORKFLOW_SCHEMA_NAME);
				} else {
					gGraph.api.schema.disable(schemaName);
				}
			});
		}
		
		if (workflowVisualizer && !workflowVisualizer.isInWorkflowMode()) {
			workflowVisualizer.enterWorkflowMode();
		}
		
		// CRITICAL FIX: Restore dropdown selection if currentWorkflow exists
		if (currentWorkflow && window.currentWorkflowKey) {
			workflowSelect.value = window.currentWorkflowKey;
			console.log('Restored dropdown to:', window.currentWorkflowKey);
		}
		
		if (currentWorkflow && workflowVisualizer) {
			console.log('📋 Reloading workflow with', currentWorkflow.nodes.length, 'nodes');
			workflowVisualizer.loadWorkflow(currentWorkflow, false, true);
			console.log('✅ Loaded', workflowVisualizer.workflowNodes.length, 'nodes into visualizer');
		}
	}

	console.log('=== MODE SWITCH COMPLETE ===');
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
		addEventLogItem('workflow-failed', '⚠️ Warning: Workflow schema not loaded');
	}
	
	workflowClient.connectWebSocket();
	setupWorkflowEventHandlers();
	
	// CRITICAL: Track if we're loading workflow to avoid duplicate interception
	let isLoadingWorkflow = false;
	
	// Override loadWorkflow to set flag
	const originalLoadWorkflow = workflowVisualizer.loadWorkflow.bind(workflowVisualizer);
	workflowVisualizer.loadWorkflow = function(workflow, applyLayout, restoreView) {
		isLoadingWorkflow = true;
		const result = originalLoadWorkflow(workflow, applyLayout, restoreView);
		isLoadingWorkflow = false;
		return result;
	};
	
	// CRITICAL: Intercept at LiteGraph level for node creation
	const originalGraphAdd = gGraph.graph.add;
	gGraph.graph.add = function(node, skipComputeOrder) {
		const result = originalGraphAdd.call(this, node, skipComputeOrder);
		
		// If manually added in workflow mode (not during loadWorkflow)
		if (node && !isLoadingWorkflow && workflowVisualizer?.isInWorkflowMode() && currentWorkflow) {
			const nodeTitle = node.title;
			
			if (nodeTitle && nodeTitle.startsWith('workflow.')) {
				console.log('🔧 Manual workflow node added:', nodeTitle);
				
				const workflowType = nodeTitle.split('.')[1]?.replace('NodeConfig', '').toLowerCase();
				
				const workflowNode = {
					id: `${workflowType}_${Date.now()}`,
					type: workflowType,
					label: workflowType.charAt(0).toUpperCase() + workflowType.slice(1),
					position: { x: Math.round(node.pos[0]), y: Math.round(node.pos[1]) }
				};
				
				currentWorkflow.nodes.push(workflowNode);
				workflowVisualizer.currentWorkflow = currentWorkflow;
				
				node.workflowData = {
					index: currentWorkflow.nodes.length - 1,
					id: workflowNode.id,
					type: workflowNode.type,
					label: workflowNode.label,
					status: 'pending',
					nodeConfig: workflowNode
				};
				
				node.color = workflowVisualizer.getNodeColor(workflowType);
				workflowVisualizer.workflowNodes[currentWorkflow.nodes.length - 1] = node;
				
				console.log('✅ Added to currentWorkflow, total:', currentWorkflow.nodes.length);
			}
		}
		
		return result;
	};

	// CRITICAL: Intercept node removal at SchemaGraphApp level (FIXED)
	const originalRemoveNode = gGraph.removeNode.bind(gGraph);
	gGraph.removeNode = function(node) {
		// If removing in workflow mode (not during loadWorkflow)
		if (node && !isLoadingWorkflow && workflowVisualizer?.isInWorkflowMode() && currentWorkflow) {
			const nodeIndex = workflowVisualizer.workflowNodes.indexOf(node);
			
			if (nodeIndex >= 0) {
				console.log('🗑️ Removing workflow node at index:', nodeIndex);
				
				// Remove from currentWorkflow.nodes
				currentWorkflow.nodes.splice(nodeIndex, 1);
				
				// Remove from workflowVisualizer.workflowNodes
				workflowVisualizer.workflowNodes.splice(nodeIndex, 1);
				
				// Update indices in remaining nodes
				for (let i = nodeIndex; i < workflowVisualizer.workflowNodes.length; i++) {
					const graphNode = workflowVisualizer.workflowNodes[i];
					if (graphNode && graphNode.workflowData) {
						graphNode.workflowData.index = i;
					}
				}
				
				// Update edges - shift indices
				currentWorkflow.edges = currentWorkflow.edges
					.filter(e => e.source !== nodeIndex && e.target !== nodeIndex)
					.map(e => ({
						...e,
						source: e.source > nodeIndex ? e.source - 1 : e.source,
						target: e.target > nodeIndex ? e.target - 1 : e.target
					}));
				
				workflowVisualizer.currentWorkflow = currentWorkflow;
				console.log('✅ Removed from workflow, remaining:', currentWorkflow.nodes.length);
			}
		}
		
		return originalRemoveNode(node);
	};

	// CRITICAL: Intercept link creation
	const originalConnect = gGraph.graph.connect;
	gGraph.graph.connect = function(node1, slot1, node2, slot2, type) {
		const linkId = originalConnect.call(this, node1, slot1, node2, slot2, type);
		
		if (linkId && !isLoadingWorkflow && workflowVisualizer?.isInWorkflowMode() && currentWorkflow) {
			const sourceIndex = workflowVisualizer.workflowNodes.indexOf(node1);
			const targetIndex = workflowVisualizer.workflowNodes.indexOf(node2);
			
			if (sourceIndex >= 0 && targetIndex >= 0) {
				const edge = { source: sourceIndex, target: targetIndex };
				currentWorkflow.edges.push(edge);
				workflowVisualizer.currentWorkflow = currentWorkflow;
				console.log('✅ Added edge to workflow:', edge);
			}
		}
		
		return linkId;
	};

	// CRITICAL: Intercept link removal - BOTH methods
	const originalRemoveLink = gGraph.removeLink.bind(gGraph);
	gGraph.removeLink = function(linkId, targetNode, targetSlot) {
		if (!isLoadingWorkflow && workflowVisualizer?.isInWorkflowMode() && currentWorkflow) {
			const link = gGraph.graph.links[linkId];
			
			if (link) {
				const sourceNode = gGraph.graph.getNodeById(link.origin_id);
				const targetNode = gGraph.graph.getNodeById(link.target_id);
				
				const sourceIndex = workflowVisualizer.workflowNodes.indexOf(sourceNode);
				const targetIndex = workflowVisualizer.workflowNodes.indexOf(targetNode);
				
				if (sourceIndex >= 0 && targetIndex >= 0) {
					// Remove from currentWorkflow.edges
					currentWorkflow.edges = currentWorkflow.edges.filter(e => 
						!(e.source === sourceIndex && e.target === targetIndex)
					);
					workflowVisualizer.currentWorkflow = currentWorkflow;
					console.log('✅ Removed edge from workflow (removeLink):', sourceIndex, '->', targetIndex);
				}
			}
		}
		
		return originalRemoveLink(linkId, targetNode, targetSlot);
	};

	const originalDisconnectLink = gGraph.disconnectLink.bind(gGraph);
	gGraph.disconnectLink = function(linkId) {
		if (!isLoadingWorkflow && workflowVisualizer?.isInWorkflowMode() && currentWorkflow) {
			const link = gGraph.graph.links[linkId];
			
			if (link) {
				const sourceNode = gGraph.graph.getNodeById(link.origin_id);
				const targetNode = gGraph.graph.getNodeById(link.target_id);
				
				const sourceIndex = workflowVisualizer.workflowNodes.indexOf(sourceNode);
				const targetIndex = workflowVisualizer.workflowNodes.indexOf(targetNode);
				
				if (sourceIndex >= 0 && targetIndex >= 0) {
					// Remove from currentWorkflow.edges
					currentWorkflow.edges = currentWorkflow.edges.filter(e => 
						!(e.source === sourceIndex && e.target === targetIndex)
					);
					workflowVisualizer.currentWorkflow = currentWorkflow;
					console.log('✅ Removed edge from workflow (disconnectLink):', sourceIndex, '->', targetIndex);
				}
			}
		}
		
		return originalDisconnectLink(linkId);
	};

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
	
	// Disable workflow schema by default
	if (gGraph && gGraph.api && gGraph.api.schema) {
		gGraph.api.schema.disable(WORKFLOW_SCHEMA_NAME);
	}
	
	console.log('✅ Workflow schema loaded');
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
		addEventLogItem('workflow-failed', `ℹ️ Workflow cancelled`);
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
		console.log('📂 Loading selected workflow:', key);
		console.log('Workflow has', currentWorkflow.nodes.length, 'nodes');
		
		// CRITICAL: Store the selected key globally
		window.currentWorkflowKey = key;
		
		workflowVisualizer.savedWorkflowViewState = null;
		workflowVisualizer.loadWorkflow(currentWorkflow, true, false);
		
		startWorkflowBtn.disabled = false;
		downloadWorkflowBtn.disabled = false;
		updateWorkflowStatus('idle', 'Ready');
		addEventLogItem('system', `📂 Loaded workflow: ${currentWorkflow.info?.name || key}`);
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
	
	// Sync positions from graph before download
	syncPositionsToCurrentWorkflow();
	
	const json = JSON.stringify(currentWorkflow, null, 2);
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
				workflowVisualizer.savedWorkflowViewState = null;
				workflowVisualizer.loadWorkflow(currentWorkflow, true, false);
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
		addEventLogItem('system', 'ℹ️ Workflow stopped');
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

// Make function globally accessible for SchemaGraph context menu
window.addWorkflowNodeAtPosition = addWorkflowNodeAtPosition;

// Register with SchemaGraph if it exists
if (typeof gGraph !== 'undefined' && gGraph) {
	gGraph.onAddWorkflowNode = addWorkflowNodeAtPosition;
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initWorkflowUI);
} else {
	initWorkflowUI();
}
