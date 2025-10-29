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

// ========================================================================
// INITIALIZATION
// ========================================================================

function initializeApp() {
	// Get DOM elements
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

	// Check if required libraries are loaded
	checkLibrariesLoaded();

	// Initialize SchemaGraph
	gGraph = new SchemaGraphApp("sg-main-canvas");

	// Initialize Workflow Extension if available
	if (typeof initWorkflowExtension === "function") {
		initWorkflowExtension(gGraph);

		// Listen for workflow execution requests
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

		// Listen for agent node execution
		gGraph.eventBus.on("workflow:agent_call", async (data) => {
			// Use your existing gApp to call agents
			const response = await gApp.send(data.message, data.agent_ref);
			// Workflow continues automatically
		});

		console.log("✅ Workflow extension initialized");

		// Optional: Create a sample workflow template
		// gGraph.api.workflow.createTemplate();
	}

	// Setup event listeners
	setupEventListeners();
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
	// Server URL change
	serverUrlInput.addEventListener("change", () => {
		appAgentSelect.disabled = true;
		appAgentSelect.innerHTML = "<option value='-1'> - None - </option>";
	});

	// Agent selection change
	appAgentSelect.addEventListener("change", (e) => {
		agentCurrIndex = parseInt(e.target.value);
	});

	// Debug message toggle
	systemMsgButton.addEventListener("change", changeSystemVisibility);

	// Message input - Enter key to send
	messageInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	// Connect button
	connectButton.addEventListener("click", toggleConnection);

	// Send button
	sendButton.addEventListener("click", sendMessage);

	// Clear chat button
	clearChatButton.addEventListener("click", clearChat);
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

		// ====================================================================
		// INTEGRATED SCHEMA & WORKFLOW SETUP
		// ====================================================================
		
		// 1. Register the single merged schema
		const config = await gApp.getConfig();
		gGraph.api.schema.register(SCHEMA_NAME, gApp.schema, "Index", "AppConfig");
		
		// 2. Initialize workflow extension (adds workflow node types)
		if (typeof initWorkflowExtension === "function") {
			initWorkflowExtension(gGraph);
			console.log("✅ Workflow extension initialized");
		}
		
		// 3. Import the full config (includes workflows)
		gGraph.api.config.import(config, SCHEMA_NAME);
		
		// 4. Setup workflow execution handlers
		setupWorkflowHandlers();
		
		// 5. Initial layout
		gGraph.api.layout.apply("circular");
		gGraph.api.view.center();

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

	// Show which agent we're talking to if changed
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
			const content = event.delta || "No content";
			addMessage("agent", content);
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
// WORKFLOW EXECUTION HANDLERS
// ====================================================================

function setupWorkflowHandlers() {
	// Listen for workflow execution requests from SchemaGraph
	gGraph.eventBus.on("workflow:execute", async (data) => {
		addMessage("system", `🚀 Executing workflow: ${data.workflow_id || 'unnamed'}`);
		
		try {
			const url = gApp.url + "/workflow/start";
			const response = await fetch(url, {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({
					index: data.workflow_index,
					args: data.context || {}
				})
			});
			
			const result = await response.json();
			
			if (result.error) {
				addMessage("system-error", `❌ Workflow error: ${result.error}`);
				gGraph.eventBus.emit("workflow:error", result);
			} else {
				addMessage("system", `✅ Workflow ${result.workflow_id} started (execution: ${result.execution_id})`);
				
				// Connect to WebSocket for live updates
				connectWorkflowWebSocket(result.execution_id);
				
				gGraph.eventBus.emit("workflow:started", result);
			}
		} catch (error) {
			addMessage("system-error", `❌ Failed to execute workflow: ${error.message}`);
			gGraph.eventBus.emit("workflow:error", {error: error.message});
		}
	});
	
	// Listen for agent calls within workflows
	gGraph.eventBus.on("workflow:agent_call", async (data) => {
		addMessage("system", `🤖 Workflow calling agent ${data.agent_ref}: "${data.message}"`);
		
		try {
			const response = await gApp.send(data.message, data.agent_ref);
			addMessage("system", `✅ Agent ${data.agent_ref} responded`);
		} catch (error) {
			addMessage("system-error", `❌ Agent call failed: ${error.message}`);
		}
	});
	
	// Workflow status updates
	gGraph.eventBus.on("workflow:node_executing", (data) => {
		console.log(`⚡ Executing node: ${data.nodeType} (${data.nodeId})`);
	});
	
	gGraph.eventBus.on("workflow:completed", (data) => {
		addMessage("system", `✅ Workflow completed in ${data.duration}ms (${data.nodesExecuted} nodes)`);
	});
	
	gGraph.eventBus.on("workflow:failed", (data) => {
		addMessage("system-error", `❌ Workflow failed: ${data.error}`);
	});
}

function connectWorkflowWebSocket(executionId) {
	const wsUrl = gApp.url.replace('http', 'ws') + `/workflow/events/${executionId}`;
	const ws = new WebSocket(wsUrl);
	
	ws.onmessage = (event) => {
		const data = JSON.parse(event.data);
		
		switch (data.type) {
			case 'node.start':
				addMessage("system", `⚡ Node executing: ${data.data.node_type}`);
				// Highlight node in graph
				gGraph.eventBus.emit("workflow:node_highlight", {
					nodeId: data.data.node_id
				});
				break;
			
			case 'node.end':
				addMessage("system", `✓ Node completed: ${data.data.node_id}`);
				break;
			
			case 'agent.response':
				addMessage("agent", data.data.response);
				break;
			
			case 'workflow.end':
				addMessage("system", `✅ Workflow ${data.data.status}`);
				ws.close();
				break;
		}
	};
	
	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
		addMessage("system-error", "❌ Workflow connection lost");
	};
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
