/* ========================================================================
   NUMEL APP - Application Logic
   ======================================================================== */

// Constants
const SCHEMA_NAME = "numel";
const START_MESSAGE = "🤖 Hi, I am Numel, an AI playground. Ask me anything you want 🙂";
const END_MESSAGE = "🤖 See you soon 👋";

// Application State
let gApp = null;
let gGraph = null;
let isConnected = false;
let agentPrevIndex = -1;
let agentCurrIndex = -1;
let messagePrevRole = null;
let messagePrevElement = null;

// DOM Elements
let chatContainer;
let messageInput;
let sendButton;
let connectButton;
let statusDiv;
let serverUrlInput;
let sessionIdInput;
let userIdInput;
let loadingDiv;
let systemMsgButton;
let appAgentSelect;
let clearChatButton;

// Workflow State
let currentWorkflowWS = null;
let currentExecutionId = null;
let workflowStartTime = null;

// ========================================================================
// INITIALIZATION
// ========================================================================

function initializeApp() {
	chatContainer = document.getElementById("chatContainer");
	messageInput = document.getElementById("messageInput");
	sendButton = document.getElementById("sendButton");
	connectButton = document.getElementById("connectButton");
	statusDiv = document.getElementById("status");
	serverUrlInput = document.getElementById("serverUrl");
	sessionIdInput = document.getElementById("sessionId");
	userIdInput = document.getElementById("userId");
	loadingDiv = document.getElementById("loading");
	systemMsgButton = document.getElementById("debugMessage");
	appAgentSelect = document.getElementById("appAgentSelect");
	clearChatButton = document.getElementById("clearChatButton");

	checkLibrariesLoaded();
	gGraph = new SchemaGraphApp("sg-main-canvas");

	if (typeof initWorkflowExtension === "function") {
		initWorkflowExtension(gGraph);
		gGraph.eventBus.on("workflow:execute", async (workflowData) => {
			const url = gApp.url + "/workflow/execute";
			const response = await fetch(url, {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					nodes: workflowData.nodes,
					edges: workflowData.edges,
					context: workflowData.context
				})
			});
			const result = await response.json();
			gApp.eventBus.emit("workflow:complete", result);
		});

		gGraph.eventBus.on("workflow:agent_call", async (data) => {
			const response = await gApp.send(data.message, data.agent_ref);
		});

		console.log("✅ Workflow extension initialized");
	}

	setupEventListeners();
	setupWorkflowControls();
	setupWorkflowPanelToggle();
}

function checkLibrariesLoaded() {
	if (typeof NumelApp !== "undefined") {
		loadingDiv.style.display = "none";
		addMessage("system", "✅ NumelApp loaded successfully");
	} else {
		loadingDiv.style.display = "block";
		loadingDiv.textContent = "❌ Failed to load NumelApp.";
		addMessage("system-error", "❌ Error: NumelApp not found.");
	}
}

function setupEventListeners() {
	serverUrlInput.addEventListener("change", () => {
		appAgentSelect.disabled = true;
		appAgentSelect.innerHTML = "<option value='-1'> - None - </option>";
	});

	appAgentSelect.addEventListener("change", (e) => {
		agentCurrIndex = parseInt(e.target.value);
	});

	systemMsgButton.addEventListener("change", changeSystemVisibility);

	messageInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	connectButton.addEventListener("click", toggleConnection);
	sendButton.addEventListener("click", sendMessage);
	clearChatButton.addEventListener("click", clearChat);
	
	let resizeTimeout;
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			if (gGraph) {
				gGraph.draw();
			}
		}, 250);
	});
}

// ========================================================================
// CONNECTION MANAGEMENT
// ========================================================================

async function connect() {
	const serverUrl = serverUrlInput.value.trim();
	if (!serverUrl) {
		addMessage("system", "⚠️ Please enter a valid server URL");
		return;
	}

	connectButton.disabled = true;
	addMessage("system", "⌛ Connecting...");

	const userId = userIdInput.value.trim();
	const sessionId = sessionIdInput.value.trim();

	enableAppInput(false);
	updateStatus("connecting", "Connecting...");

	try {
		gApp = await NumelApp.connect(serverUrl, {
			userId: userId,
			sessionId: sessionId,
			subscriber: {
				onEvent(params) {
					handleAGUIEvent(params.event);
				}
			}
		});

		if (!gApp) {
			throw new Error("NumelApp initialization failed");
		}

		const config = await gApp.getConfig();
		gGraph.api.schema.register(SCHEMA_NAME, gApp.schema, "Index", "AppConfig");
		
		if (typeof initWorkflowExtension === "function") {
			initWorkflowExtension(gGraph);
			console.log("✅ Workflow extension initialized");
		}

		gGraph.api.config.import(config, SCHEMA_NAME);
		setupWorkflowHandlers();
		createWorkflowLinks(config);
		
		gGraph.api.layout.apply("circular");
		gGraph.api.view.center();
		
		setTimeout(() => {
			gGraph.api.view.center();
			gGraph.draw();
		}, 100);

		agentPrevIndex = -1;
		agentCurrIndex = 0;
		isConnected = true;

		await setAppStatus();

		clearChat();
		updateStatus("connected", "Connected");
		enableInput(true);
		connectButton.textContent = "Disconnect";
		connectButton.classList.remove("numel-btn-accent");
		// connectButton.classList.add("numel-btn-secondary");
		connectButton.classList.add("numel-btn-accent-red");
		addMessage("system", `✅ Connected to ${serverUrl}`);
		addMessage("system", `📊 Loaded ${config.agents?.length || 0} agents, ${config.workflows?.length || 0} workflows`);
		addMessage("ui", START_MESSAGE);

		if (config.workflows && config.workflows.length > 0) {
			showWorkflowList();
			const workflowPanel = document.getElementById("workflowPanel");
			if (workflowPanel) {
				workflowPanel.style.display = "block";
			}
			showWorkflowList();
			addMessage("system", `📄 ${config.workflows.length} workflow(s) available`);
		} else {
			toggleWorkflowLayout(false);
		}

	} catch (error) {
		console.error("Failed to initialize connection:", error);
		addMessage("system-error", `❌ Connection failed: ${error.message}`);
		updateStatus("disconnected", "Connection failed");
		enableAppInput(true);
	} finally {
		connectButton.disabled = false;
	}
}

async function disconnect() {
	connectButton.disabled = true;
	gGraph.api.schema.remove(SCHEMA_NAME);

	if (gApp) {
		addMessage("system", "⌛ Disconnecting...");
		await gApp.disconnect();
		gApp = null;
	}

	if (currentWorkflowWS) {
		currentWorkflowWS.close();
		currentWorkflowWS = null;
	}

	toggleWorkflowLayout(false);
	currentExecutionId = null;
	workflowStartTime = null;
	updateWorkflowStatus("Idle", "No workflow running");
	updateWorkflowProgress(0);

	const workflowListEl = document.getElementById("workflowList");
	if (workflowListEl) {
		workflowListEl.innerHTML = '<div class="workflow-list-empty">Connect to see workflows</div>';
	}

	isConnected = false;
	agentCurrIndex = -1;
	appAgentSelect.innerHTML = "<option value='-1'> - None - </option>";
	messageInput.value = "";

	updateStatus("disconnected", "Disconnected");
	enableInput(false);
	connectButton.textContent = "Connect";
	// connectButton.classList.remove("numel-btn-secondary");
	connectButton.classList.remove("numel-btn-accent-red");
	connectButton.classList.add("numel-btn-accent");
	addMessage("system", "ℹ️ Disconnected");
	addMessage("ui", END_MESSAGE);
	enableAppInput(true);
	connectButton.disabled = false;
}

function toggleConnection() {
	if (isConnected) {
		disconnect();
	} else {
		connect();
	}
}

function isValidAgent(agent) {
	return (agent["port"] <= 0);
}

async function setAppStatus() {
	const status = await gApp.getStatus();
	const config = status["config"];
	const agents = config["agents"];
	
	let content = "";
	if (agents.length === 0) {
		agentCurrIndex = -1;
		content = "<option value='-1'> - None - </option>";
	} else {
		agentCurrIndex = 0;
		for (let i = 0; i < agents.length; i++) {
			if (!isValidAgent(agents[i])) {
				continue;
			}
			const selected = (i === agentCurrIndex) ? " selected" : "";
			const info = config["infos"][agents[i]["info"]];
			content += `<option value="${i}"${selected}>${info["name"]}</option>`;
		}
	}
	
	appAgentSelect.innerHTML = content;
	appAgentSelect.disabled = false;
	return status;
}

// ========================================================================
// MESSAGE HANDLING
// ========================================================================

async function sendMessage() {
	const message = messageInput.value.trim();
	if (!message || !isConnected || !gApp) return;

	addMessage("user", message);

	if (agentPrevIndex !== agentCurrIndex) {
		agentPrevIndex = agentCurrIndex;
		const agent = gApp.status["config"]["agents"][agentPrevIndex];
		const agentName = gApp.status["config"]["infos"][agent["info"]]["name"];
		addMessage("ui", `🤖 Talking to Agent "${agentName}"`);
	}

	messageInput.value = "";
	sendButton.textContent = "Messaging...";
	sendButton.disabled = true;
	connectButton.disabled = true;
	clearChatButton.disabled = true;

	try {
		await gApp.send(message, agentPrevIndex);
	} catch (error) {
		console.error("Failed to send message:", error);
		addMessage("system-error", `❌ Failed to send message: ${error.message}`);
	} finally {
		sendButton.textContent = "Send";
		sendButton.disabled = false;
		connectButton.disabled = false;
		clearChatButton.disabled = false;
	}
}

function addMessage(role, content) {
	if (messagePrevRole !== role) {
		const messageDiv = document.createElement("div");
		messageDiv.className = `message ${role}`;
		
		if (role === "system") {
			const display = systemMsgButton.checked ? "block" : "none";
			messageDiv.style.display = display;
		}
		
		messageDiv.innerHTML = "";
		chatContainer.appendChild(messageDiv);
		messagePrevRole = role;
		messagePrevElement = messageDiv;
	} else if (role === "system") {
		content = `<br/>${content}`;
	}
	
	messagePrevElement.innerHTML += content;
	chatContainer.scrollTop = chatContainer.scrollHeight;
}

function clearChat() {
	messagePrevRole = null;
	messagePrevElement = null;
	chatContainer.innerHTML = "";
}

// ========================================================================
// AG-UI EVENT HANDLING
// ========================================================================

function handleAGUIEvent(event) {
	console.log("AG-UI Event:", event);
	if (!event) return;

	switch (event.type) {
		case NumelApp.EventType.TEXT_MESSAGE_CONTENT:
		case NumelApp.EventType.TEXT_MESSAGE_CHUNK:
			addMessage("agent", event.delta || "No content");
			break;
		case NumelApp.EventType.TEXT_MESSAGE_START:
			addMessage("system", "🤖 Agent is responding...");
			break;
		case NumelApp.EventType.TEXT_MESSAGE_END:
			addMessage("system", "✅ Response complete");
			break;
		case NumelApp.EventType.RUN_STARTED:
			addMessage("system", "🚀 Agent run started");
			break;
		case NumelApp.EventType.RUN_FINISHED:
			addMessage("system", "🏁 Agent run finished");
			break;
		case NumelApp.EventType.RUN_ERROR:
			addMessage("system-error", `❌ Error: ${event.error || "Unknown error"}`);
			break;
		case NumelApp.EventType.TOOL_CALL_START:
			addMessage("system", `🔧 Tool call: ${event.tool_name || "unknown"}`);
			break;
		case NumelApp.EventType.TOOL_CALL_RESULT:
			addMessage("system", `✅ Tool result received`);
			break;
		default:
			addMessage("system", `ℹ️ Event: ${event.type}`);
			console.log("Unhandled event:", event);
	}
}

// ========================================================================
// UI HELPERS
// ========================================================================

function updateStatus(type, message) {
	statusDiv.className = `numel-status numel-status-${type}`;
	statusDiv.textContent = message;
}

function enableInput(enabled) {
	messageInput.disabled = !enabled;
	sendButton.disabled = !enabled;
}

function enableAppInput(enable) {
	serverUrlInput.disabled = !enable;
	sessionIdInput.disabled = !enable;
	userIdInput.disabled = !enable;
	appAgentSelect.disabled = enable;
}

function changeSystemVisibility() {
	const divs = document.getElementsByClassName("message system");
	const display = systemMsgButton.checked ? "block" : "none";
	for (let div of divs) {
		div.style.display = display;
	}
}

// ====================================================================
// WORKFLOW NODE LINKING
// ====================================================================

function createWorkflowLinks(config) {
	if (!config.workflows || config.workflows.length === 0) {
		return;
	}
	
	config.workflows.forEach(workflow => {
		const nodeMap = new Map();
		
		for (const node of gGraph.graph.nodes) {
			if (node.schema_type === 'NodeConfig') {
				const nodeId = node.properties?.id;
				if (nodeId) {
					nodeMap.set(nodeId, node);
				}
			}
		}
		
		if (workflow.edges) {
			workflow.edges.forEach(edge => {
				const sourceNode = nodeMap.get(edge.source_node_id);
				const targetNode = nodeMap.get(edge.target_node_id);
				
				if (sourceNode && targetNode) {
					let linkExists = false;
					if (sourceNode.outputs && sourceNode.outputs[0]) {
						const output = sourceNode.outputs[0];
						if (output.links) {
							for (const linkId of output.links) {
								const existingLink = gGraph.graph.links[linkId];
								if (existingLink && existingLink.target_id === targetNode.id) {
									linkExists = true;
									break;
								}
							}
						}
					}
					
					if (!linkExists) {
						try {
							gGraph.api.link.create(sourceNode, 0, targetNode, 0);
						} catch (e) {
							console.warn(`Could not create link between ${edge.source_node_id} and ${edge.target_node_id}:`, e);
						}
					}
				}
			});
		}
	});
	
	gGraph.draw();
}

// ====================================================================
// WORKFLOW EXECUTION HANDLERS
// ====================================================================

function setupWorkflowHandlers() {
	gGraph.eventBus.on("workflow:execute", async (data) => {
		executeWorkflow(data.workflow_index || 0, data.context || {});
	});
	
	gGraph.eventBus.on("workflow:agent_call", async (data) => {
		addMessage("system", `🤖 Workflow calling agent ${data.agent_ref}: "${data.message}"`);
		
		try {
			await gApp.send(data.message, data.agent_ref);
			addMessage("system", `✅ Agent ${data.agent_ref} responded`);
		} catch (error) {
			addMessage("system-error", `❌ Agent call failed: ${error.message}`);
		}
	});
}

async function executeWorkflow(workflowIndex, context = {}) {
	if (!gApp || !isConnected) {
		addMessage("system-error", "❌ Not connected to server");
		return;
	}
	
	const config = gApp.status?.config;
	if (!config || !config.workflows || workflowIndex >= config.workflows.length) {
		addMessage("system-error", `❌ Invalid workflow index: ${workflowIndex}`);
		return;
	}
	
	const workflow = config.workflows[workflowIndex];
	addMessage("system", `🚀 Starting workflow: ${workflow.name || workflow.id}`);
	
	const workflowPanel = document.getElementById("workflowPanel");
	if (workflowPanel) {
		workflowPanel.style.display = "block";
	}
	
	if (!context.user_query && !context.message) {
		context.user_query = "Hello, please help me with this workflow.";
	}
	
	try {
		const url = gApp.url + "/workflow/start";
		const response = await fetch(url, {
			method: "POST",
			headers: {"Content-Type": "application/json"},
			body: JSON.stringify({
				index: workflowIndex,
				args: context
			})
		});
		
		const result = await response.json();
		
		if (result.error) {
			addMessage("system-error", `❌ Workflow error: ${result.error}`);
			updateWorkflowStatus("Error", result.error);
			return;
		}
		
		currentExecutionId = result.execution_id;
		workflowStartTime = Date.now();
		
		addMessage("system", `✅ Workflow started (execution: ${result.execution_id})`);
		updateWorkflowStatus("Running", "Executing workflow...");
		
		connectWorkflowWebSocket(result.execution_id);
		
	} catch (error) {
		addMessage("system-error", `❌ Failed to start workflow: ${error.message}`);
		updateWorkflowStatus("Error", error.message);
	}
}

function connectWorkflowWebSocket(executionId) {
	if (currentWorkflowWS) {
		currentWorkflowWS.close();
		currentWorkflowWS = null;
	}
	
	const wsUrl = gApp.url.replace('http', 'ws') + `/workflow/events/${executionId}`;
	addMessage("system", `🔌 Connecting to workflow stream...`);
	
	const ws = new WebSocket(wsUrl);
	currentWorkflowWS = ws;
	
	ws.onopen = () => {
		addMessage("system", `✅ Connected to workflow stream`);
	};
	
	ws.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			handleWorkflowEvent(data);
		} catch (error) {
			console.error('Error parsing workflow event:', error);
		}
	};
	
	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
		addMessage("system-error", "❌ Workflow connection error");
		updateWorkflowStatus("Error", "Connection lost");
	};
	
	ws.onclose = () => {
		addMessage("system", "🔌 Workflow stream closed");
		currentWorkflowWS = null;
	};
}

function handleWorkflowEvent(event) {
	const type = event.type;
	const data = event.data || {};
	const nodeId = event.node_id;
	
	console.log('Workflow event:', type, data);
	
	switch (type) {
		case 'workflow.start':
			updateWorkflowStatus("Running", "Workflow started");
			updateWorkflowProgress(0);
			break;
		case 'node.start':
			const nodeType = data.node_type || 'unknown';
			addMessage("system", `⚡ Executing: ${nodeType} (${nodeId})`);
			highlightWorkflowNode(nodeId);
			break;
		case 'node.end':
			addMessage("system", `✓ Completed: ${nodeId}`);
			updateWorkflowProgress(data.progress);
			break;
		case 'agent.response':
			if (data.response) {
				addMessage("agent", data.response);
			}
			break;
		case 'agent.message':
			if (data.message) {
				addMessage("system", `🤖 Agent: ${data.message}`);
			}
			break;
		case 'node.error':
			addMessage("system-error", `❌ Node error (${nodeId}): ${data.error}`);
			break;
		case 'workflow.end':
			const status = data.status || 'completed';
			const duration = workflowStartTime ? 
				((Date.now() - workflowStartTime) / 1000).toFixed(2) : 
				'unknown';
			
			addMessage("system", `✅ Workflow ${status} in ${duration}s`);
			updateWorkflowStatus("Completed", `Finished in ${duration}s`);
			updateWorkflowProgress(100);
			
			if (currentWorkflowWS) {
				currentWorkflowWS.close();
				currentWorkflowWS = null;
			}
			break;
		case 'workflow.error':
			addMessage("system-error", `❌ Workflow error: ${data.error || data.message}`);
			updateWorkflowStatus("Failed", data.error || "Unknown error");
			
			if (currentWorkflowWS) {
				currentWorkflowWS.close();
				currentWorkflowWS = null;
			}
			break;
		case 'workflow.complete':
			const finalStatus = data.status || 'completed';
			addMessage("system", `🏁 Workflow complete: ${finalStatus}`);
			updateWorkflowStatus(finalStatus, "Execution finished");
			
			if (data.outputs) {
				console.log('Workflow outputs:', data.outputs);
				addMessage("system", `📊 Outputs: ${JSON.stringify(data.outputs, null, 2)}`);
			}
			break;
		case 'status':
			updateWorkflowFromStatus(data);
			break;
		default:
			console.log('Unhandled workflow event:', type, data);
	}
}

function highlightWorkflowNode(nodeId) {
	if (gGraph && gGraph.eventBus) {
		gGraph.eventBus.emit("workflow:node_highlight", { nodeId });
	}
}

async function stopCurrentWorkflow() {
	if (!currentExecutionId) {
		addMessage("system-error", "❌ No workflow running");
		return;
	}
	
	addMessage("system", "⏹️ Stopping workflow...");
	
	try {
		if (currentWorkflowWS && currentWorkflowWS.readyState === WebSocket.OPEN) {
			currentWorkflowWS.send(JSON.stringify({ command: "stop" }));
		}
		
		const url = gApp.url + `/workflow/stop/${currentExecutionId}`;
		const response = await fetch(url, {
			method: "POST",
			headers: {"Content-Type": "application/json"}
		});
		
		const result = await response.json();
		
		if (result.error) {
			addMessage("system-error", `❌ Stop failed: ${result.error}`);
		} else {
			addMessage("system", `✅ ${result.message || 'Workflow stopped'}`);
			updateWorkflowStatus("Cancelled", "Stopped by user");
		}
	} catch (error) {
		addMessage("system-error", `❌ Failed to stop workflow: ${error.message}`);
	}
}

async function getWorkflowStatus() {
	if (!currentExecutionId) {
		return null;
	}
	
	try {
		const url = gApp.url + `/workflow/status/${currentExecutionId}`;
		const response = await fetch(url, {
			method: "POST",
			headers: {"Content-Type": "application/json"}
		});
		
		const result = await response.json();
		
		if (result.error) {
			console.error('Failed to get workflow status:', result.error);
			return null;
		}
		
		updateWorkflowFromStatus(result);
		return result;
	} catch (error) {
		console.error('Error getting workflow status:', error);
		return null;
	}
}

// ====================================================================
// WORKFLOW UI UPDATES
// ====================================================================

function updateWorkflowStatus(status, message) {
	const statusEl = document.getElementById("workflowStatus");
	const messageEl = document.getElementById("workflowMessage");
	
	if (statusEl) {
		statusEl.textContent = status;
		statusEl.className = `workflow-status workflow-status-${status.toLowerCase()}`;
	}
	
	if (messageEl && message) {
		messageEl.textContent = message;
	}
}

function updateWorkflowProgress(percent) {
	const progressBar = document.getElementById("workflowProgressBar");
	const progressText = document.getElementById("workflowProgressText");
	
	if (progressBar) {
		progressBar.style.width = `${percent}%`;
	}
	
	if (progressText) {
		progressText.textContent = `${Math.round(percent)}%`;
	}
}

function updateWorkflowFromStatus(status) {
	const {
		status: execStatus,
		progress,
		duration,
		completed_nodes,
		total_nodes,
		outputs,
		errors
	} = status;
	
	updateWorkflowStatus(execStatus, `${completed_nodes}/${total_nodes} nodes`);
	
	if (progress !== undefined) {
		updateWorkflowProgress(progress);
	}
	
	if (duration) {
		const durationEl = document.getElementById("workflowDuration");
		if (durationEl) {
			durationEl.textContent = `${duration.toFixed(2)}s`;
		}
	}
	
	if (errors && errors.length > 0) {
		errors.forEach(err => {
			addMessage("system-error", `❌ ${err.error || err.message}`);
		});
	}
}

function toggleWorkflowLayout(show) {
	const body = document.body;
	const panel = document.getElementById("workflowPanel");
	
	if (show && panel) {
		body.classList.add("workflow-active");
		panel.style.display = "flex";
	} else {
		body.classList.remove("workflow-active");
		if (panel) {
			panel.style.display = "none";
		}
	}
	
	if (gGraph) {
		setTimeout(() => {
			gGraph.api.view.center();
			gGraph.draw();
		}, 100);
	}
}

function showWorkflowList() {
	const config = gApp?.status?.config;
	if (!config || !config.workflows) {
		addMessage("system-error", "❌ No workflows available");
		return;
	}
	
	const workflowListEl = document.getElementById("workflowList");
	if (!workflowListEl) return;
	
	workflowListEl.innerHTML = "";
	
	config.workflows.forEach((workflow, index) => {
		const item = document.createElement("div");
		item.className = "workflow-list-item";
		item.innerHTML = `
			<div class="workflow-item-name">${workflow.name || workflow.id}</div>
			<div class="workflow-item-desc">${workflow.description || 'No description'}</div>
			<button class="numel-btn numel-btn-primary workflow-execute-btn" data-index="${index}">
				▶️ Execute
			</button>
		`;
		
		workflowListEl.appendChild(item);
	});
	
	document.querySelectorAll(".workflow-execute-btn").forEach(btn => {
		btn.addEventListener("click", (e) => {
			const index = parseInt(e.target.dataset.index);
			executeWorkflow(index);
		});
	});
}

// ====================================================================
// WORKFLOW CONTROLS
// ====================================================================

function setupWorkflowControls() {
	const stopBtn = document.getElementById("stopWorkflowBtn");
	if (stopBtn) {
		stopBtn.addEventListener("click", stopCurrentWorkflow);
	}
	
	const refreshBtn = document.getElementById("refreshWorkflowBtn");
	if (refreshBtn) {
		refreshBtn.addEventListener("click", showWorkflowList);
	}
	
	const statusBtn = document.getElementById("getWorkflowStatusBtn");
	if (statusBtn) {
		statusBtn.addEventListener("click", getWorkflowStatus);
	}
}

function setupWorkflowPanelToggle() {
	const toggleBtn = document.getElementById("toggleWorkflowPanel");
	const panel = document.getElementById("workflowPanel");
	
	if (toggleBtn && panel) {
		toggleBtn.addEventListener("click", () => {
			panel.classList.toggle("collapsed");
			toggleBtn.textContent = panel.classList.contains("collapsed") ? 
				"▶ Expand" : "▼ Collapse";
		});
	}
}

// ====================================================================
// VIEW MODE SWITCHING
// ====================================================================

// Add UI controls for switching between config view and workflow view
function addViewModeControls() {
	// This can be added to your toolbar
	const modeSelect = document.createElement('select');
	modeSelect.id = 'viewMode';
	modeSelect.innerHTML = `
		<option value="config">📋 Config View</option>
		<option value="workflow">🔄 Workflow View</option>
	`;
	
	modeSelect.addEventListener('change', (e) => {
		switchViewMode(e.target.value);
	});
	
	// Add to toolbar or control panel
	document.querySelector('.numel-toolbar').appendChild(modeSelect);
}

function switchViewMode(mode) {
	if (mode === 'workflow') {
		// Show only workflow nodes
		gGraph.api.filter.apply((node) => {
			return node.type?.startsWith('Workflow.') || 
				   node.schema_type === 'WorkflowConfig' ||
				   node.schema_type === 'NodeConfig' ||
				   node.schema_type === 'EdgeConfig';
		});
		
		addMessage("system", "📊 Switched to Workflow View");
		gGraph.api.layout.apply("hierarchical-vertical");
		
	} else {
		// Show full config
		gGraph.api.filter.clear();
		addMessage("system", "📋 Switched to Config View");
		gGraph.api.layout.apply("circular");
	}
	
	gGraph.api.view.center();
}

// ========================================================================
// ENTRY POINT
// ========================================================================

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeApp);
} else {
	initializeApp();
}
