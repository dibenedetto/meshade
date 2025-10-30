/* ========================================================================
   NUMEL APP - Application Logic
   ======================================================================== */

// Constants
const SCHEMA_NAME = "numel";
const START_MESSAGE = "🤖 Hi, I am Numel, an AI playground. Ask me anything you want 🙂";
const END_MESSAGE = "🤖 See you soon 👋";

// Application State
let aguiApp = null;
let graph = null;
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
	graph = new SchemaGraphApp("sg-main-canvas");

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

	clearChatButton .disabled = true;
	connectButton   .disabled = true;

	addMessage("system", "⌛ Connecting...");

	const userId = userIdInput.value.trim();
	const sessionId = sessionIdInput.value.trim();

	enableAppInput(false);
	updateStatus("connecting", "Connecting...");

	try {
		aguiApp = await NumelApp.connect(serverUrl, {
			userId: userId,
			sessionId: sessionId,
			subscriber: {
				onEvent(params) {
					handleAGUIEvent(params.event);
				}
			}
		});

		if (!aguiApp) {
			throw new Error("NumelApp initialization failed");
		}

		// Load schema and config into SchemaGraph
		const config = await aguiApp.getConfig();
		graph.api.schema.register(SCHEMA_NAME, aguiApp.schema, "Index", "AppConfig");
		graph.api.config.import(config, SCHEMA_NAME);
		graph.api.layout.apply("circular");
		graph.api.view.center();

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
		addMessage("ui", START_MESSAGE);

	} catch (error) {
		console.error("Failed to initialize connection:", error);
		addMessage("system-error", `❌ Connection failed: ${error.message}`);
		updateStatus("disconnected", "Connection failed");
		enableAppInput(true);
	} finally {
		clearChatButton .disabled = false;
		connectButton   .disabled = false;
	}
}

async function disconnect() {
	clearChatButton .disabled = true;
	connectButton   .disabled = true;

	graph.api.schema.remove(SCHEMA_NAME);

	if (aguiApp) {
		addMessage("system", "⌛ Disconnecting...");
		await aguiApp.disconnect();
		aguiApp = null;
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

	clearChatButton .disabled = false;
	connectButton   .disabled = false;
}

function toggleConnection() {
	if (isConnected) {
		disconnect();
	} else {
		connect();
	}
}

async function setAppStatus() {
	const status = await aguiApp.getStatus();
	const config = status["config"];
	const agents = config["agents"];
	
	let content = "";
	if (agents.length === 0) {
		agentCurrIndex = -1;
		content = "<option value='-1'> - None - </option>";
	} else {
		agentCurrIndex = 0;
		for (let i = 0; i < agents.length; i++) {
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
	if (!message || !isConnected || !aguiApp) return;

	addMessage("user", message);

	// Show which agent we're talking to if changed
	if (agentPrevIndex !== agentCurrIndex) {
		agentPrevIndex = agentCurrIndex;
		const agent = aguiApp.status["config"]["agents"][agentPrevIndex];
		const agentName = aguiApp.status["config"]["infos"][agent["info"]]["name"];
		addMessage("ui", `🤖 Talking to Agent "${agentName}"`);
	}

	messageInput.value = "";
	sendButton.textContent = "Messaging...";
	sendButton.disabled = true;
	connectButton.disabled = true;
	clearChatButton.disabled = true;

	try {
		await aguiApp.send(message, agentPrevIndex);
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

// ========================================================================
// ENTRY POINT
// ========================================================================

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeApp);
} else {
	initializeApp();
}
