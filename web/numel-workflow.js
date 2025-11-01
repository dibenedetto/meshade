/* ========================================================================
   NUMEL WORKFLOW - Fixed with Proper Schema Registration & Edge Conditions
   ======================================================================== */

class WorkflowVisualizer {
	constructor(schemaGraphApp) {
		this.schemaGraph = schemaGraphApp;
		this.savedGraphState = null;
		this.savedViewState = null;
		this.workflowNodes = [];  // Array mapping node index to SchemaGraph node
		this.workflowEdges = [];  // Array mapping to SchemaGraph links
		this.isWorkflowMode = false;
		this.currentWorkflow = null;
		this.workflowSchemaRegistered = false;
	}

	// ====================================================================
	// Schema Registration
	// ====================================================================

	/**
	 * Register workflow schema with SchemaGraph
	 */
	registerWorkflowSchema(workflowSchemaCode) {
		if (this.workflowSchemaRegistered) {
			console.log('📋 Workflow schema already registered');
			return;
		}

		try {
			// Register workflow schema (similar to how app schema is registered)
			this.schemaGraph.api.schema.register(
				'workflow',           // Schema name
				workflowSchemaCode,   // Python schema code
				'int',                // Index type (nodes referenced by index)
				'WorkflowConfig'      // Root type
			);
			
			this.workflowSchemaRegistered = true;
			console.log('✅ Workflow schema registered successfully');
		} catch (error) {
			console.error('❌ Failed to register workflow schema:', error);
			throw error;
		}
	}

	/**
	 * Get workflow node type from schema
	 */
	getWorkflowNodeType(workflowType) {
		// Map workflow node type to schema type
		const typeMap = {
			'start': 'WorkflowNodeConfig',
			'end': 'WorkflowNodeConfig',
			'agent': 'AgentNodeConfig',
			'prompt': 'PromptNodeConfig',
			'tool': 'ToolNodeConfig',
			'transform': 'TransformNodeConfig',
			'decision': 'DecisionNodeConfig',
			'merge': 'MergeNodeConfig',
			'parallel': 'ParallelNodeConfig',
			'loop': 'LoopNodeConfig',
			'user_input': 'UserInputNodeConfig'
		};
		
		return typeMap[workflowType] || 'WorkflowNodeConfig';
	}

	// ====================================================================
	// State Management
	// ====================================================================

	enterWorkflowMode() {
		console.log('📊 Entering workflow mode...');
		
		// Save current graph state
		this.savedGraphState = this.schemaGraph.api.graph.export(false);
		this.savedViewState = this.schemaGraph.api.view.export();
		
		console.log('💾 Saved graph state:', {
			nodes: this.savedGraphState.nodes?.length || 0,
			links: this.savedGraphState.links?.length || 0,
			view: this.savedViewState
		});
		
		// Clear graph for workflow
		this.schemaGraph.api.graph.clear();
		this.workflowNodes = [];
		this.workflowEdges = [];
		
		this.isWorkflowMode = true;
	}

	exitWorkflowMode() {
		console.log('📊 Exiting workflow mode...');
		
		if (!this.isWorkflowMode) {
			console.warn('⚠️ Not in workflow mode');
			return;
		}
		
		// Clear workflow graph
		this.schemaGraph.api.graph.clear();
		this.workflowNodes = [];
		this.workflowEdges = [];
		this.currentWorkflow = null;
		
		// Restore previous graph state
		if (this.savedGraphState) {
			console.log('📥 Restoring graph state');
			this.schemaGraph.api.graph.import(this.savedGraphState, false);
			
			if (this.savedViewState) {
				this.schemaGraph.api.view.import(this.savedViewState);
			}
			
			this.savedGraphState = null;
			this.savedViewState = null;
		}
		
		this.isWorkflowMode = false;
	}

	isInWorkflowMode() {
		return this.isWorkflowMode;
	}

	// ====================================================================
	// Workflow Loading
	// ====================================================================

	loadWorkflow(workflow) {
		console.log('📋 Loading workflow:', workflow);
		
		if (!this.isWorkflowMode) {
			this.enterWorkflowMode();
		}
		
		if (!this.workflowSchemaRegistered) {
			console.warn('⚠️ Workflow schema not registered - nodes will be basic');
		}
		
		this.currentWorkflow = workflow;
		
		// Clear existing workflow
		this.schemaGraph.api.graph.clear();
		this.workflowNodes = [];
		this.workflowEdges = [];
		
		// Create workflow nodes (by index)
		workflow.nodes.forEach((node, index) => {
			this.createWorkflowNode(node, index);
		});
		
		// Create workflow edges (using indices)
		workflow.edges.forEach(edge => {
			this.createWorkflowEdge(edge);
		});
		
		// Apply layout and center view
		this.schemaGraph.api.layout.apply('hierarchical-vertical');
		setTimeout(() => {
			this.schemaGraph.api.view.center();
		}, 100);
		
		console.log('✅ Workflow loaded:', {
			nodes: this.workflowNodes.length,
			edges: this.workflowEdges.length
		});
	}

	/**
	 * Create a workflow node in the graph
	 */
	createWorkflowNode(workflowNode, index) {
		// Calculate position
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
		
		// Get workflow-specific node type
		let nodeType;
		if (this.workflowSchemaRegistered) {
			// Use proper workflow schema types
			nodeType = this.getWorkflowNodeType(workflowNode.type);
		} else {
			// Fallback to basic node type if schema not registered
			nodeType = 'Native.String';
			console.warn(`⚠️ Using fallback type for node ${index} - workflow schema not registered`);
		}
		
		// Create the node
		const graphNode = this.schemaGraph.api.node.create(nodeType, x, y);
		
		if (!graphNode) {
			console.error('❌ Failed to create node at index:', index);
			this.workflowNodes[index] = null;
			return;
		}
		
		// Set node label
		const label = this.getNodeLabel(workflowNode, index);
		this.schemaGraph.api.node.setProperty(graphNode, 'label', label);
		
		// For typed nodes, also set the id property
		if (this.workflowSchemaRegistered) {
			this.schemaGraph.api.node.setProperty(graphNode, 'id', workflowNode.id);
		}
		
		// Store mapping
		this.workflowNodes[index] = graphNode;
		
		// Store workflow metadata in the node itself
		graphNode.workflowData = {
			index: index,
			id: workflowNode.id,
			type: workflowNode.type,
			label: workflowNode.label,
			status: 'pending',
			nodeConfig: workflowNode  // Store full node config
		};
		
		console.log(`✓ Created node [${index}]: ${workflowNode.id} (${nodeType})`);
		
		return graphNode;
	}

	/**
	 * Get display label for node
	 */
	getNodeLabel(workflowNode, index) {
		const emoji = this.getNodeEmoji(workflowNode.type);
		const label = workflowNode.label || workflowNode.type;
		return `${emoji} [${index}] ${label}`;
	}

	/**
	 * Get emoji for node type
	 */
	getNodeEmoji(nodeType) {
		const emojiMap = {
			'start': '🎬',
			'end': '🏁',
			'agent': '🤖',
			'prompt': '💭',
			'tool': '🔧',
			'transform': '🔄',
			'decision': '🔀',
			'merge': '🔗',
			'parallel': '⚡',
			'loop': '🔁',
			'user_input': '👤'
		};
		
		return emojiMap[nodeType] || '⚪';
	}

	/**
	 * Create a workflow edge using node indices
	 * Handles edge conditions and decision branches
	 */
	createWorkflowEdge(workflowEdge) {
		const sourceNode = this.workflowNodes[workflowEdge.source];
		const targetNode = this.workflowNodes[workflowEdge.target];
		
		if (!sourceNode || !targetNode) {
			console.error('❌ Cannot create edge - nodes not found:', 
				`[${workflowEdge.source}] -> [${workflowEdge.target}]`);
			return null;
		}
		
		// Create link between nodes
		const link = this.schemaGraph.api.link.create(sourceNode, 0, targetNode, 0);
		
		if (!link) {
			console.error('❌ Failed to create edge:', 
				`[${workflowEdge.source}] -> [${workflowEdge.target}]`);
			return null;
		}
		
		// Store edge in array (might be useful for updates)
		this.workflowEdges.push(link);
		
		// Store workflow metadata including condition
		link.workflowData = {
			source: workflowEdge.source,
			target: workflowEdge.target,
			condition: workflowEdge.condition,
			label: workflowEdge.label
		};
		
		// Apply edge label if present
		if (workflowEdge.label) {
			// Note: SchemaGraph might not have direct edge label API
			// Store in metadata for now
			link.label = workflowEdge.label;
		}
		
		// Apply visual styling based on condition type
		if (workflowEdge.condition) {
			this.styleConditionalEdge(link, workflowEdge.condition);
		}
		
		console.log(`✓ Created edge: [${workflowEdge.source}] -> [${workflowEdge.target}]`, 
			workflowEdge.condition ? `(condition: ${workflowEdge.condition.type})` : '');
		
		return link;
	}

	/**
	 * Apply visual styling to conditional edges
	 */
	styleConditionalEdge(link, condition) {
		// Store condition info for potential custom rendering
		link.conditionType = condition.type;
		link.conditionInfo = {
			field: condition.field,
			value: condition.value,
			expression: condition.expression
		};
		
		// Visual indication that this is a conditional edge
		// Note: Actual rendering depends on SchemaGraph's link rendering capabilities
		// This metadata can be used in custom rendering logic
		link.isConditional = true;
		
		// Create human-readable condition label
		if (condition.type === 'equals' && condition.field && condition.value !== undefined) {
			link.conditionLabel = `${condition.field} == ${JSON.stringify(condition.value)}`;
		} else if (condition.type === 'contains') {
			link.conditionLabel = `${condition.field} contains ${condition.value}`;
		} else if (condition.type === 'greater') {
			link.conditionLabel = `${condition.field} > ${condition.value}`;
		} else if (condition.type === 'less') {
			link.conditionLabel = `${condition.field} < ${condition.value}`;
		} else if (condition.type === 'custom' && condition.expression) {
			link.conditionLabel = condition.expression;
		} else if (condition.type === 'always') {
			link.conditionLabel = 'always';
		}
	}

	/**
	 * Get edge condition information for display
	 */
	getEdgeConditionInfo(sourceIndex, targetIndex) {
		const link = this.workflowEdges.find(l => 
			l.workflowData?.source === sourceIndex && 
			l.workflowData?.target === targetIndex
		);
		
		if (!link || !link.workflowData?.condition) {
			return null;
		}
		
		return {
			type: link.workflowData.condition.type,
			label: link.conditionLabel || link.workflowData.label,
			condition: link.workflowData.condition
		};
	}

	/**
	 * Highlight edges that match a condition
	 */
	highlightConditionalEdges(sourceIndex, matchedBranch) {
		// Find all edges from source node
		const sourceNode = this.workflowNodes[sourceIndex];
		if (!sourceNode) return;
		
		// Iterate through edges and highlight/dim based on condition match
		this.workflowEdges.forEach(link => {
			if (link.workflowData?.source === sourceIndex) {
				const condition = link.workflowData?.condition;
				const targetIndex = link.workflowData?.target;
				
				// Check if this edge leads to the matched branch
				const isMatchedPath = (targetIndex === matchedBranch);
				
				// Apply visual styling (depends on SchemaGraph API)
				link.isActive = isMatchedPath;
				link.isDimmed = !isMatchedPath;
				
				console.log(`Edge [${sourceIndex}] -> [${targetIndex}]: ${isMatchedPath ? 'ACTIVE' : 'dimmed'}`);
			}
		});
	}

	// ====================================================================
	// Execution State Updates
	// ====================================================================

	/**
	 * Update the execution state of a workflow node by index
	 */
	updateNodeState(nodeIndex, state) {
		if (nodeIndex >= this.workflowNodes.length) {
			console.warn('⚠️ Node index out of range:', nodeIndex);
			return;
		}
		
		const graphNode = this.workflowNodes[nodeIndex];
		
		if (!graphNode) {
			console.warn('⚠️ Node not found at index:', nodeIndex);
			return;
		}
		
		// Update workflow metadata
		if (graphNode.workflowData) {
			graphNode.workflowData.status = state.status;
			graphNode.workflowData.error = state.error;
			graphNode.workflowData.output = state.output;
		}
		
		// Update visual appearance
		const statusEmoji = this.getStatusEmoji(state.status);
		const nodeType = graphNode.workflowData?.type || 'unknown';
		const label = graphNode.workflowData?.label || nodeType;
		
		this.schemaGraph.api.node.setProperty(
			graphNode, 
			'label', 
			`${statusEmoji} [${nodeIndex}] ${label}`
		);
		
		// Highlight running nodes
		if (state.status === 'running') {
			this.schemaGraph.api.node.select(graphNode, false);
		}
		
		// Handle decision node - highlight the taken branch
		if (nodeType === 'decision' && state.output?.branch !== undefined) {
			const matchedBranch = state.output.branch;
			this.highlightConditionalEdges(nodeIndex, matchedBranch);
		}
		
		console.log(`🔄 Updated node [${nodeIndex}] -> ${state.status}`);
	}

	/**
	 * Get emoji for execution status
	 */
	getStatusEmoji(status) {
		const statusMap = {
			'pending': '⏳',
			'running': '▶️',
			'completed': '✅',
			'failed': '❌',
			'cancelled': '⏸️',
			'waiting': '⏱️',
			'skipped': '⏭️'
		};
		
		return statusMap[status] || '⚪';
	}

	/**
	 * Highlight execution path by node indices
	 */
	highlightPath(nodeIndices) {
		// Clear previous selection
		this.schemaGraph.api.node.clearSelection();
		
		// Select all nodes in the path
		nodeIndices.forEach(nodeIndex => {
			if (nodeIndex < this.workflowNodes.length) {
				const graphNode = this.workflowNodes[nodeIndex];
				if (graphNode) {
					this.schemaGraph.api.node.select(graphNode, true);
				}
			}
		});
		
		// Highlight edges in the path
		for (let i = 0; i < nodeIndices.length - 1; i++) {
			const sourceIdx = nodeIndices[i];
			const targetIdx = nodeIndices[i + 1];
			
			const link = this.workflowEdges.find(l =>
				l.workflowData?.source === sourceIdx &&
				l.workflowData?.target === targetIdx
			);
			
			if (link) {
				link.isInExecutionPath = true;
			}
		}
		
		console.log(`🎯 Highlighted ${nodeIndices.length} nodes in execution path`);
	}

	/**
	 * Clear all highlights and reset states
	 */
	clearHighlights() {
		this.schemaGraph.api.node.clearSelection();
		
		// Reset edge highlighting
		this.workflowEdges.forEach(link => {
			link.isActive = false;
			link.isDimmed = false;
			link.isInExecutionPath = false;
		});
		
		// Reset all node labels
		this.workflowNodes.forEach((graphNode, index) => {
			if (graphNode && this.currentWorkflow) {
				const workflowNode = this.currentWorkflow.nodes[index];
				if (workflowNode) {
					const label = this.getNodeLabel(workflowNode, index);
					this.schemaGraph.api.node.setProperty(graphNode, 'label', label);
					
					if (graphNode.workflowData) {
						graphNode.workflowData.status = 'pending';
					}
				}
			}
		});
		
		console.log('🧹 Cleared all highlights');
	}

	// ====================================================================
	// Workflow Export
	// ====================================================================

	/**
	 * Export current workflow with updated positions
	 */
	exportWorkflow() {
		if (!this.currentWorkflow) {
			return null;
		}
		
		// Clone workflow
		const exported = JSON.parse(JSON.stringify(this.currentWorkflow));
		
		// Update node positions from graph
		exported.nodes.forEach((node, index) => {
			const graphNode = this.workflowNodes[index];
			if (graphNode && graphNode.pos) {
				node.position = {
					x: Math.round(graphNode.pos[0]),
					y: Math.round(graphNode.pos[1])
				};
			}
		});
		
		return exported;
	}

	// ====================================================================
	// Inspection & Debugging
	// ====================================================================

	/**
	 * Get detailed info about a node for debugging
	 */
	inspectNode(nodeIndex) {
		const graphNode = this.workflowNodes[nodeIndex];
		if (!graphNode) {
			return null;
		}
		
		return {
			index: nodeIndex,
			id: graphNode.workflowData?.id,
			type: graphNode.workflowData?.type,
			status: graphNode.workflowData?.status,
			label: graphNode.workflowData?.label,
			position: graphNode.pos,
			config: graphNode.workflowData?.nodeConfig,
			error: graphNode.workflowData?.error,
			output: graphNode.workflowData?.output
		};
	}

	/**
	 * Get detailed info about edges from a node
	 */
	inspectNodeEdges(nodeIndex) {
		const outgoing = [];
		const incoming = [];
		
		this.workflowEdges.forEach(link => {
			if (link.workflowData?.source === nodeIndex) {
				outgoing.push({
					target: link.workflowData.target,
					condition: link.workflowData.condition,
					label: link.workflowData.label,
					conditionLabel: link.conditionLabel
				});
			}
			if (link.workflowData?.target === nodeIndex) {
				incoming.push({
					source: link.workflowData.source,
					condition: link.workflowData.condition,
					label: link.workflowData.label,
					conditionLabel: link.conditionLabel
				});
			}
		});
		
		return { incoming, outgoing };
	}

	/**
	 * Get SchemaGraph node by workflow index
	 */
	getGraphNodeByIndex(nodeIndex) {
		return this.workflowNodes[nodeIndex] || null;
	}

	/**
	 * Get workflow node index from SchemaGraph node
	 */
	getNodeIndex(graphNode) {
		return this.workflowNodes.indexOf(graphNode);
	}

	/**
	 * Get all workflow nodes
	 */
	getAllNodes() {
		return this.workflowNodes.filter(node => node !== null);
	}

	/**
	 * Get workflow metadata for a graph node
	 */
	getWorkflowData(graphNode) {
		return graphNode?.workflowData || null;
	}
}

// ========================================================================
// WorkflowClient (unchanged from previous version)
// ========================================================================

class WorkflowClient {
	constructor(baseUrl) {
		this.baseUrl = baseUrl;
		this.websocket = null;
		this.eventHandlers = new Map();
		this.reconnectDelay = 1000;
		this.maxReconnectDelay = 30000;
		this.currentReconnectDelay = this.reconnectDelay;
	}

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

	async startWorkflow(workflow, initialData = null) {
		const response = await fetch(`${this.baseUrl}/workflow/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
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
			headers: { 'Content-Type': 'application/json' },
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
			headers: { 'Content-Type': 'application/json' },
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { WorkflowClient, WorkflowVisualizer };
}
