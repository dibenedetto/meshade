/* ========================================================================
   NUMEL WORKFLOW - Enhanced SchemaGraph Integration
   ======================================================================== */

class WorkflowClient {
	constructor(baseUrl) {
		this.baseUrl = baseUrl;
		this.websocket = null;
		this.eventHandlers = new Map();
		this.reconnectDelay = 1000;
		this.maxReconnectDelay = 30000;
		this.currentReconnectDelay = this.reconnectDelay;
	}

	// ====================================================================
	// WebSocket Management
	// ====================================================================

	connectWebSocket() {
		const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
		const wsEndpoint = `${wsUrl}/workflow/events`;

		try {
			this.websocket = new WebSocket(wsEndpoint);

			this.websocket.onopen = () => {
				console.log('✅ Workflow WebSocket connected');
				this.currentReconnectDelay = this.reconnectDelay;
				this.emit('connected', {});
			};

			this.websocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.handleWebSocketMessage(data);
				} catch (error) {
					console.error('❌ Error parsing WebSocket message:', error);
				}
			};

			this.websocket.onerror = (error) => {
				console.error('❌ WebSocket error:', error);
				this.emit('error', { error });
			};

			this.websocket.onclose = () => {
				console.log('🔌 WebSocket disconnected');
				this.emit('disconnected', {});
				this.scheduleReconnect();
			};
		} catch (error) {
			console.error('❌ Error connecting WebSocket:', error);
			this.scheduleReconnect();
		}
	}

	scheduleReconnect() {
		setTimeout(() => {
			console.log(`🔄 Reconnecting WebSocket in ${this.currentReconnectDelay}ms...`);
			this.connectWebSocket();
			this.currentReconnectDelay = Math.min(
				this.currentReconnectDelay * 2,
				this.maxReconnectDelay
			);
		}, this.currentReconnectDelay);
	}

	disconnectWebSocket() {
		if (this.websocket) {
			this.websocket.close();
			this.websocket = null;
		}
	}

	handleWebSocketMessage(data) {
		if (data.type === 'workflow_event') {
			this.emit('workflow_event', data.event);
			this.emit(data.event.event_type, data.event);
		} else if (data.type === 'event_history') {
			this.emit('event_history', data.events);
		}
	}

	// ====================================================================
	// Event Handling
	// ====================================================================

	on(eventType, handler) {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, []);
		}
		this.eventHandlers.get(eventType).push(handler);
	}

	off(eventType, handler) {
		if (this.eventHandlers.has(eventType)) {
			const handlers = this.eventHandlers.get(eventType);
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	emit(eventType, data) {
		if (this.eventHandlers.has(eventType)) {
			this.eventHandlers.get(eventType).forEach(handler => {
				try {
					handler(data);
				} catch (error) {
					console.error(`❌ Error in event handler for ${eventType}:`, error);
				}
			});
		}
	}

	// ====================================================================
	// API Methods
	// ====================================================================

	async startWorkflow(workflow, initialData = null) {
		const response = await fetch(`${this.baseUrl}/workflow/start`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				workflow: workflow,
				initial_data: initialData
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to start workflow: ${response.statusText}`);
		}

		return await response.json();
	}

	async cancelWorkflow(executionId) {
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/cancel`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Failed to cancel workflow: ${response.statusText}`);
		}

		return await response.json();
	}

	async getWorkflowStatus(executionId) {
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/status`);

		if (!response.ok) {
			throw new Error(`Failed to get workflow status: ${response.statusText}`);
		}

		return await response.json();
	}

	async listWorkflows() {
		const response = await fetch(`${this.baseUrl}/workflow/list`);

		if (!response.ok) {
			throw new Error(`Failed to list workflows: ${response.statusText}`);
		}

		return await response.json();
	}

	async provideUserInput(executionId, nodeId, inputData) {
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/input`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				node_id: nodeId,
				input_data: inputData
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to provide user input: ${response.statusText}`);
		}

		return await response.json();
	}

	async getEventHistory(filters = {}) {
		const response = await fetch(`${this.baseUrl}/workflow/events/history`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(filters)
		});

		if (!response.ok) {
			throw new Error(`Failed to get event history: ${response.statusText}`);
		}

		return await response.json();
	}

	async clearEventHistory() {
		const response = await fetch(`${this.baseUrl}/workflow/events/history`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			throw new Error(`Failed to clear event history: ${response.statusText}`);
		}

		return await response.json();
	}
}

// ========================================================================
// Enhanced Workflow Visualization with SchemaGraph
// ========================================================================

class WorkflowVisualizer {
	constructor(schemaGraphApp) {
		this.schemaGraph = schemaGraphApp;
		this.savedGraphState = null;  // Store previous graph state
		this.savedViewState = null;   // Store previous view state
		this.workflowNodes = new Map(); // Map workflow node IDs to SchemaGraph nodes
		this.workflowEdges = new Map(); // Map workflow edge IDs to SchemaGraph links
		this.nodeStates = new Map();    // Track execution states
		this.isWorkflowMode = false;
	}

	// ====================================================================
	// State Management
	// ====================================================================

	/**
	 * Enter workflow mode - save current graph and switch to workflow view
	 */
	enterWorkflowMode() {
		console.log('📊 Entering workflow mode...');
		
		// Save current graph state
		this.savedGraphState = this.schemaGraph.api.graph.export(false);
		this.savedViewState = this.schemaGraph.api.view.export();
		
		console.log('💾 Saved graph state:', {
			nodes: this.savedGraphState.nodes.length,
			links: this.savedGraphState.links.length,
			view: this.savedViewState
		});
		
		// Clear graph for workflow
		this.schemaGraph.api.graph.clear();
		this.workflowNodes.clear();
		this.workflowEdges.clear();
		this.nodeStates.clear();
		
		this.isWorkflowMode = true;
		
		// Update status
		this.schemaGraph.eventBus.emit('ui:update', { 
			id: 'status', 
			content: '🔄 Workflow Mode - Visualizing workflow execution' 
		});
	}

	/**
	 * Exit workflow mode - restore previous graph
	 */
	exitWorkflowMode() {
		console.log('📊 Exiting workflow mode...');
		
		if (!this.isWorkflowMode) {
			console.warn('⚠️ Not in workflow mode');
			return;
		}
		
		// Clear workflow graph
		this.schemaGraph.api.graph.clear();
		this.workflowNodes.clear();
		this.workflowEdges.clear();
		this.nodeStates.clear();
		
		// Restore previous graph state
		if (this.savedGraphState) {
			console.log('📥 Restoring graph state:', {
				nodes: this.savedGraphState.nodes.length,
				links: this.savedGraphState.links.length
			});
			
			this.schemaGraph.api.graph.import(this.savedGraphState, false);
			
			// Restore view state
			if (this.savedViewState) {
				this.schemaGraph.api.view.import(this.savedViewState);
			}
			
			this.savedGraphState = null;
			this.savedViewState = null;
		}
		
		this.isWorkflowMode = false;
		
		// Update status
		this.schemaGraph.eventBus.emit('ui:update', { 
			id: 'status', 
			content: '✅ Restored previous graph state' 
		});
		
		setTimeout(() => {
			this.schemaGraph.eventBus.emit('ui:update', { 
				id: 'status', 
				content: 'Right-click to add nodes.' 
			});
		}, 2000);
	}

	/**
	 * Check if currently in workflow mode
	 */
	isInWorkflowMode() {
		return this.isWorkflowMode;
	}

	// ====================================================================
	// Workflow Loading
	// ====================================================================

	/**
	 * Load and visualize a workflow
	 */
	loadWorkflow(workflow) {
		console.log('📋 Loading workflow:', workflow);
		
		if (!this.isWorkflowMode) {
			this.enterWorkflowMode();
		}
		
		// Clear existing workflow
		this.schemaGraph.api.graph.clear();
		this.workflowNodes.clear();
		this.workflowEdges.clear();
		
		// Create workflow nodes
		workflow.nodes.forEach((node, index) => {
			this.createWorkflowNode(node, index);
		});
		
		// Create workflow edges
		workflow.edges.forEach(edge => {
			this.createWorkflowEdge(edge);
		});
		
		// Apply layout and center view
		this.schemaGraph.api.layout.apply('hierarchical-vertical');
		this.schemaGraph.api.view.center();
		
		console.log('✅ Workflow loaded:', {
			nodes: this.workflowNodes.size,
			edges: this.workflowEdges.size
		});
	}

	/**
	 * Create a workflow node in the graph
	 */
	createWorkflowNode(workflowNode, index) {
		// Calculate position (if not provided)
		let x, y;
		if (workflowNode.position) {
			x = workflowNode.position.x;
			y = workflowNode.position.y;
		} else {
			// Auto-position in grid
			const col = index % 5;
			const row = Math.floor(index / 5);
			x = 100 + col * 250;
			y = 100 + row * 200;
		}
		
		// Determine node type based on workflow node type
		let nodeType;
		switch (workflowNode.type) {
			case 'llm':
			case 'chat':
				nodeType = 'Native.String';  // Use string for text
				break;
			case 'tool':
			case 'function':
				nodeType = 'Native.Dict';    // Use dict for structured data
				break;
			case 'condition':
			case 'branch':
				nodeType = 'Native.Boolean';  // Use boolean for conditions
				break;
			case 'loop':
			case 'iterate':
				nodeType = 'Native.List';     // Use list for loops
				break;
			default:
				nodeType = 'Native.String';   // Default to string
		}
		
		// Create the node
		const graphNode = this.schemaGraph.api.node.create(nodeType, x, y);
		
		if (!graphNode) {
			console.error('❌ Failed to create node:', workflowNode.id);
			return;
		}
		
		// Set node label/data
		if (workflowNode.label) {
			this.schemaGraph.api.node.setProperty(graphNode, 'value', workflowNode.label);
		} else {
			this.schemaGraph.api.node.setProperty(graphNode, 'value', workflowNode.type);
		}
		
		// Store mapping
		this.workflowNodes.set(workflowNode.id, graphNode);
		
		// Store workflow data in properties
		graphNode.workflowData = {
			id: workflowNode.id,
			type: workflowNode.type,
			label: workflowNode.label,
			data: workflowNode.data,
			status: 'pending'
		};
		
		console.log(`✓ Created workflow node: ${workflowNode.id} (${nodeType})`);
		
		return graphNode;
	}

	/**
	 * Create a workflow edge in the graph
	 */
	createWorkflowEdge(workflowEdge) {
		const sourceNode = this.workflowNodes.get(workflowEdge.source);
		const targetNode = this.workflowNodes.get(workflowEdge.target);
		
		if (!sourceNode || !targetNode) {
			console.error('❌ Cannot create edge - nodes not found:', workflowEdge);
			return;
		}
		
		// Create link between nodes (slot 0 output to slot 0 input)
		const link = this.schemaGraph.api.link.create(sourceNode, 0, targetNode, 0);
		
		if (link) {
			// Store mapping
			this.workflowEdges.set(workflowEdge.id, link);
			
			// Store workflow data
			link.workflowData = {
				id: workflowEdge.id,
				condition: workflowEdge.condition,
				label: workflowEdge.label
			};
			
			console.log(`✓ Created workflow edge: ${workflowEdge.id}`);
		} else {
			console.error('❌ Failed to create edge:', workflowEdge);
		}
		
		return link;
	}

	// ====================================================================
	// Execution State Updates
	// ====================================================================

	/**
	 * Update the execution state of a workflow node
	 */
	updateNodeState(nodeId, state) {
		const graphNode = this.workflowNodes.get(nodeId);
		
		if (!graphNode) {
			console.warn('⚠️ Node not found for state update:', nodeId);
			return;
		}
		
		// Update stored state
		this.nodeStates.set(nodeId, state);
		
		// Update node's workflow data
		if (graphNode.workflowData) {
			graphNode.workflowData.status = state.status;
			graphNode.workflowData.error = state.error;
			graphNode.workflowData.output = state.output;
		}
		
		// Update visual appearance based on state
		// Note: This is a workaround since SchemaGraph doesn't have built-in status colors
		// We'll update the node's value to include status indicator
		const statusEmoji = this.getStatusEmoji(state.status);
		const label = graphNode.workflowData?.label || graphNode.workflowData?.type || 'Node';
		this.schemaGraph.api.node.setProperty(graphNode, 'value', `${statusEmoji} ${label}`);
		
		// Select the node if it's currently running
		if (state.status === 'running') {
			this.schemaGraph.api.node.select(graphNode, false);
		}
		
		console.log(`🔄 Updated node state: ${nodeId} -> ${state.status}`);
	}

	/**
	 * Get emoji for status
	 */
	getStatusEmoji(status) {
		switch (status) {
			case 'pending': return '⏳';
			case 'running': return '▶️';
			case 'completed': return '✅';
			case 'failed': return '❌';
			case 'cancelled': return '⏸️';
			case 'waiting_input': return '⏱️';
			default: return '⚪';
		}
	}

	/**
	 * Highlight the execution path
	 */
	highlightPath(nodeIds) {
		// Clear previous selection
		this.schemaGraph.api.node.clearSelection();
		
		// Select all nodes in the path
		nodeIds.forEach(nodeId => {
			const graphNode = this.workflowNodes.get(nodeId);
			if (graphNode) {
				this.schemaGraph.api.node.select(graphNode, true);
			}
		});
		
		console.log(`🎯 Highlighted ${nodeIds.length} nodes in execution path`);
	}

	/**
	 * Clear all highlights and reset states
	 */
	clearHighlights() {
		this.schemaGraph.api.node.clearSelection();
		this.nodeStates.clear();
		
		// Reset all node labels
		this.workflowNodes.forEach((graphNode, workflowId) => {
			if (graphNode.workflowData) {
				const label = graphNode.workflowData.label || graphNode.workflowData.type;
				this.schemaGraph.api.node.setProperty(graphNode, 'value', label);
			}
		});
		
		console.log('🧹 Cleared all highlights');
	}

	// ====================================================================
	// Workflow Export/Import
	// ====================================================================

	/**
	 * Export current workflow visualization
	 */
	exportWorkflow() {
		const nodes = [];
		const edges = [];
		
		// Export nodes
		this.workflowNodes.forEach((graphNode, workflowId) => {
			nodes.push({
				id: workflowId,
				type: graphNode.workflowData?.type || 'unknown',
				label: graphNode.workflowData?.label || '',
				data: graphNode.workflowData?.data || {},
				position: {
					x: graphNode.pos[0],
					y: graphNode.pos[1]
				}
			});
		});
		
		// Export edges
		this.workflowEdges.forEach((link, edgeId) => {
			const originNode = this.schemaGraph.graph.getNodeById(link.origin_id);
			const targetNode = this.schemaGraph.graph.getNodeById(link.target_id);
			
			if (originNode && targetNode) {
				// Find workflow IDs
				let sourceId = null;
				let targetId = null;
				
				this.workflowNodes.forEach((node, id) => {
					if (node === originNode) sourceId = id;
					if (node === targetNode) targetId = id;
				});
				
				if (sourceId && targetId) {
					edges.push({
						id: edgeId,
						source: sourceId,
						target: targetId,
						label: link.workflowData?.label || '',
						condition: link.workflowData?.condition
					});
				}
			}
		});
		
		return { nodes, edges };
	}

	// ====================================================================
	// Utility Methods
	// ====================================================================

	/**
	 * Get workflow node by ID
	 */
	getWorkflowNode(nodeId) {
		return this.workflowNodes.get(nodeId);
	}

	/**
	 * Get all workflow nodes
	 */
	getAllWorkflowNodes() {
		return Array.from(this.workflowNodes.entries());
	}

	/**
	 * Get node state
	 */
	getNodeState(nodeId) {
		return this.nodeStates.get(nodeId);
	}

	/**
	 * Get all node states
	 */
	getAllNodeStates() {
		return new Map(this.nodeStates);
	}
}

// ========================================================================
// Export for use in other modules
// ========================================================================

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { WorkflowClient, WorkflowVisualizer };
}
