/* ========================================================================
   NUMEL WORKFLOW
   ======================================================================== */

const WORKFLOW_SCHEMA_NAME = "workflow";

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

	registerWorkflowSchema(workflowSchemaCode) {
		if (this.workflowSchemaRegistered) {
			console.log('📋 Workflow schema already registered');
			return;
		}
		try {
			this.schemaGraph.api.schema.register(WORKFLOW_SCHEMA_NAME, workflowSchemaCode, 'int', 'WorkflowConfig');
			this.workflowSchemaRegistered = true;
			console.log('✅ Workflow schema registered successfully');
		} catch (error) {
			console.error('❌ Failed to register workflow schema:', error);
			throw error;
		}
	}

	getWorkflowNodeType(workflowType) {
		const typeMap = {
			'start': 'StartNodeConfig',
			'end': 'EndNodeConfig',
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
		return `${WORKFLOW_SCHEMA_NAME}.${typeMap[workflowType] || 'WorkflowNodeConfig'}`;
	}

	// ====================================================================
	// State Management
	// ====================================================================

	enterWorkflowMode() {
		console.log('📊 Entering workflow mode...');

		const currGraphState = this.schemaGraph.api.graph.export(false);
		const currViewState  = this.schemaGraph.api.view.export();
		if (this.savedGraphState) {
			this.schemaGraph.api.graph.import(this.savedGraphState, false);
			if (this.savedViewState) {
				this.schemaGraph.api.view.import(this.savedViewState);
			}
		}
		else {
			this.schemaGraph.api.graph.clear();
		}
		this.savedGraphState = currGraphState;
		this.savedViewState  = currViewState;
		this.workflowNodes = [];
		this.workflowEdges = [];
		this.isWorkflowMode = true;
	}

	exitWorkflowMode() {
		console.log('📊 Exiting workflow mode...');
		if (!this.isWorkflowMode) return;
		this.workflowNodes = [];
		this.workflowEdges = [];
		this.currentWorkflow = null;
		const currGraphState = this.schemaGraph.api.graph.export(false);
		const currViewState  = this.schemaGraph.api.view.export();
		if (this.savedGraphState) {
			this.schemaGraph.api.graph.import(this.savedGraphState, false);
			if (this.savedViewState) {
				this.schemaGraph.api.view.import(this.savedViewState);
			}
		}
		else {
			this.schemaGraph.api.graph.clear();
		}
		this.savedGraphState = currGraphState;
		this.savedViewState  = currViewState;
		this.isWorkflowMode  = false;
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
		this.currentWorkflow = workflow;
		this.schemaGraph.api.graph.clear();
		this.workflowNodes = [];
		this.workflowEdges = [];
		
		// Create nodes
		workflow.nodes.forEach((node, index) => {
			this.createWorkflowNode(node, index);
		});
		
		// Create edges
		workflow.edges.forEach(edge => {
			this.createWorkflowEdge(edge);
		});
		
		// Apply layout and center
		this.schemaGraph.api.layout.apply('hierarchical-vertical');
		setTimeout(() => {
			this.schemaGraph.api.view.center();
		}, 100);
		
		console.log('✅ Workflow loaded:', {
			nodes: this.workflowNodes.length,
			edges: this.workflowEdges.length
		});
	}

	// ====================================================================
	// Node Creation
	// ====================================================================

	createWorkflowNode(workflowNode, index) {
		// Calculate position
		let x, y;
		if (workflowNode.position) {
			x = workflowNode.position.x;
			y = workflowNode.position.y;
		} else {
			const col = index % 5;
			const row = Math.floor(index / 5);
			x = 100 + col * 250;
			y = 100 + row * 200;
		}
		
		// Get proper node type from schema
		let nodeType;
		if (this.workflowSchemaRegistered) {
			nodeType = this.getWorkflowNodeType(workflowNode.type);
		} else {
			nodeType = 'Native.String';
			console.warn(`⚠️ Using fallback type for node ${index}`);
		}
		
		// 🔧 FIX: Create the node using schema system
		const graphNode = this.schemaGraph.api.node.create(nodeType, x, y);
		if (!graphNode) {
			console.error('❌ Failed to create node at index:', index);
			this.workflowNodes[index] = null;
			return;
		}
		
		// Set properties from workflow data
		if (this.workflowSchemaRegistered) {
			this.schemaGraph.api.node.setProperty(graphNode, 'id', workflowNode.id);
			this.setNodeProperties(graphNode, workflowNode);
		}
		
		// 🔧 FIX: Add visual connection slots (keeping existing inputs/outputs from schema)
		this.addVisualConnectionSlots(graphNode, workflowNode);
		
		// Set visual properties
		const label = this.getNodeLabel(workflowNode, index);
		this.schemaGraph.api.node.setProperty(graphNode, 'label', label);
		
		const color = this.getNodeColor(workflowNode.type);
		if (graphNode.color !== undefined) {
			graphNode.color = color;
		}
		
		// Store node and metadata
		this.workflowNodes[index] = graphNode;
		graphNode.workflowData = {
			index: index,
			id: workflowNode.id,
			type: workflowNode.type,
			label: workflowNode.label,
			status: 'pending',
			nodeConfig: workflowNode
		};
		
		console.log(`✔ Created node [${index}]: ${workflowNode.id} (${nodeType})`);
		return graphNode;
	}

	// 🔧 NEW: Add visual connection slots alongside schema fields
	addVisualConnectionSlots(graphNode, workflowNode) {
		const nodeType = workflowNode.type;
		const universalType = 'Any';
		
		// Store original inputs/outputs from schema
		const originalInputs = graphNode.inputs || [];
		const originalOutputs = graphNode.outputs || [];
		
		// Create new arrays with flow control slots first, then schema fields
		graphNode.inputs = [];
		graphNode.outputs = [];
		
		switch (nodeType) {
			case 'start':
				// Start has no inputs, just output flow
				graphNode.inputs = originalInputs;
				graphNode.outputs = [{name: 'flow', type: universalType, links: []}, ...originalOutputs];
				break;
				
			case 'end':
				// End has input flow, no outputs
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				graphNode.outputs = originalOutputs;
				break;
				
			case 'decision':
				// Decision: input flow + schema fields, then branch outputs
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				
				const branches = workflowNode.branches || {};
				const branchOutputs = Object.keys(branches).map(branchName => ({
					name: branchName,
					type: universalType,
					links: []
				}));
				if (branchOutputs.length === 0) {
					branchOutputs.push({name: 'default', type: universalType, links: []});
				}
				graphNode.outputs = [...branchOutputs, ...originalOutputs];
				break;
				
			case 'merge':
				// Merge: multiple flow inputs + schema fields, then merged output
				const waitFor = workflowNode.wait_for || [];
				const inputCount = waitFor.length > 0 ? waitFor.length : 2;
				
				const flowInputs = [];
				graphNode.multiInputs = {};
				for (let i = 0; i < inputCount; i++) {
					flowInputs.push({name: `input_${i}`, type: universalType, link: null});
					graphNode.multiInputs[i] = { type: universalType, links: [] };
				}
				
				graphNode.inputs = [...flowInputs, ...originalInputs];
				graphNode.outputs = [{name: 'merged', type: universalType, links: []}, ...originalOutputs];
				break;
				
			case 'parallel':
				// Parallel: input flow + schema fields, then branch outputs
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				
				const parallelBranches = workflowNode.branches || [];
				const outputCount = parallelBranches.length > 0 ? parallelBranches.length : 2;
				const parallelOutputs = [];
				for (let i = 0; i < outputCount; i++) {
					parallelOutputs.push({name: `branch_${i}`, type: universalType, links: []});
				}
				
				graphNode.outputs = [...parallelOutputs, ...originalOutputs];
				break;
				
			case 'loop':
				// Loop: input flow + schema fields, then body/exit outputs
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				graphNode.outputs = [
					{name: 'body', type: universalType, links: []},
					{name: 'exit', type: universalType, links: []},
					...originalOutputs
				];
				break;
				
			default:
				// agent, prompt, tool, transform, user_input
				// Keep schema inputs/outputs, add flow control
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				graphNode.outputs = [{name: 'flow', type: universalType, links: []}, ...originalOutputs];
				break;
		}
	}

	setNodeProperties(graphNode, workflowNode) {
		const type = workflowNode.type;
		try {
			switch (type) {
				case 'agent':
					if (workflowNode.agent !== undefined) {
						this.schemaGraph.api.node.setProperty(graphNode, 'agent', workflowNode.agent);
					}
					if (workflowNode.input_mapping) {
						this.schemaGraph.api.node.setProperty(graphNode, 'input_mapping', workflowNode.input_mapping);
					}
					if (workflowNode.output_mapping) {
						this.schemaGraph.api.node.setProperty(graphNode, 'output_mapping', workflowNode.output_mapping);
					}
					break;
				case 'prompt':
					if (workflowNode.prompt !== undefined) {
						this.schemaGraph.api.node.setProperty(graphNode, 'prompt', workflowNode.prompt);
					}
					if (workflowNode.model !== undefined) {
						this.schemaGraph.api.node.setProperty(graphNode, 'model', workflowNode.model);
					}
					break;
				case 'tool':
					if (workflowNode.tool !== undefined) {
						this.schemaGraph.api.node.setProperty(graphNode, 'tool', workflowNode.tool);
					}
					break;
				case 'decision':
					if (workflowNode.condition_field) {
						this.schemaGraph.api.node.setProperty(graphNode, 'condition_field', workflowNode.condition_field);
					}
					if (workflowNode.branches) {
						this.schemaGraph.api.node.setProperty(graphNode, 'branches', workflowNode.branches);
					}
					break;
				case 'merge':
					if (workflowNode.strategy) {
						this.schemaGraph.api.node.setProperty(graphNode, 'strategy', workflowNode.strategy);
					}
					if (workflowNode.wait_for) {
						this.schemaGraph.api.node.setProperty(graphNode, 'wait_for', workflowNode.wait_for);
					}
					break;
				case 'parallel':
					if (workflowNode.branches) {
						this.schemaGraph.api.node.setProperty(graphNode, 'branches', workflowNode.branches);
					}
					break;
				case 'transform':
					if (workflowNode.transform_type) {
						this.schemaGraph.api.node.setProperty(graphNode, 'transform_type', workflowNode.transform_type);
					}
					if (workflowNode.transform_script) {
						this.schemaGraph.api.node.setProperty(graphNode, 'transform_script', workflowNode.transform_script);
					}
					break;
				case 'loop':
					if (workflowNode.body !== undefined) {
						this.schemaGraph.api.node.setProperty(graphNode, 'body', workflowNode.body);
					}
					if (workflowNode.max_iterations !== undefined) {
						this.schemaGraph.api.node.setProperty(graphNode, 'max_iterations', workflowNode.max_iterations);
					}
					break;
				case 'user_input':
					if (workflowNode.prompt_text) {
						this.schemaGraph.api.node.setProperty(graphNode, 'prompt_text', workflowNode.prompt_text);
					}
					break;
			}
		} catch (error) {
			console.warn(`⚠️ Could not set properties for node ${workflowNode.id}:`, error);
		}
	}

	getNodeLabel(workflowNode, index) {
		const emoji = this.getNodeEmoji(workflowNode.type);
		const label = workflowNode.label || workflowNode.type;
		return `${emoji} [${index}] ${label}`;
	}

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

	getNodeColor(nodeType) {
		const colorMap = {
			'start': '#4ade80',
			'end': '#f87171',
			'agent': '#60a5fa',
			'prompt': '#a78bfa',
			'tool': '#fb923c',
			'transform': '#fbbf24',
			'decision': '#ec4899',
			'merge': '#14b8a6',
			'parallel': '#8b5cf6',
			'loop': '#06b6d4',
			'user_input': '#f472b6'
		};
		return colorMap[nodeType] || '#94a3b8';
	}

	// ====================================================================
	// Edge Creation
	// ====================================================================

	createWorkflowEdge(workflowEdge) {
		const sourceNode = this.workflowNodes[workflowEdge.source];
		const targetNode = this.workflowNodes[workflowEdge.target];
		
		if (!sourceNode || !targetNode) {
			console.error('❌ Cannot create edge:', `[${workflowEdge.source}] -> [${workflowEdge.target}]`);
			return null;
		}
		
		// 🔧 FIX: Determine correct output slot
		let outputSlot = 0;
		const sourceType = sourceNode.workflowData?.type;
		
		if (sourceType === 'decision' && workflowEdge.condition) {
			// For decision nodes, find the output slot matching the branch
			const branchName = this.getBranchNameFromCondition(workflowEdge.condition);
			outputSlot = sourceNode.outputs.findIndex(o => o.name === branchName);
			if (outputSlot === -1) {
				console.warn(`⚠️ Branch "${branchName}" not found, using slot 0`);
				outputSlot = 0;
			}
		} else if (sourceType === 'loop') {
			// For loop nodes, determine if this is body or exit
			const isExitEdge = workflowEdge.label?.toLowerCase().includes('exit') || 
							workflowEdge.label?.toLowerCase().includes('done') ||
							workflowEdge.label?.toLowerCase().includes('complete');
			outputSlot = isExitEdge ? 1 : 0; // body=0, exit=1
		} else if (sourceType === 'parallel') {
			// For parallel nodes, find next available output slot (excluding flow slots)
			outputSlot = sourceNode.outputs.findIndex(o => 
				o.name.startsWith('branch_') && (!o.links || o.links.length === 0)
			);
			if (outputSlot === -1) {
				// All branch slots used, use the first one
				outputSlot = sourceNode.outputs.findIndex(o => o.name.startsWith('branch_'));
				if (outputSlot === -1) outputSlot = 0;
			}
		} else {
			// Default: use first flow output (typically slot 0)
			outputSlot = sourceNode.outputs.findIndex(o => o.name === 'flow');
			if (outputSlot === -1) outputSlot = 0;
		}
		
		// 🔧 FIX: Determine correct input slot
		let inputSlot = 0;
		const targetType = targetNode.workflowData?.type;
		
		if (targetType === 'merge') {
			// For merge nodes, find next available input slot in the multi-input slots
			inputSlot = Object.keys(targetNode.multiInputs || {}).findIndex(slotIdx => {
				const slot = targetNode.multiInputs[slotIdx];
				return slot && (!slot.links || slot.links.length === 0);
			});
			
			if (inputSlot === -1) {
				// All slots occupied, use slot 0 (it's multi-input anyway)
				inputSlot = 0;
			}
		} else {
			// Default: use first flow input (typically slot 0)
			inputSlot = targetNode.inputs.findIndex(i => i.name === 'flow');
			if (inputSlot === -1) inputSlot = 0;
		}
		
		// Create the link
		let link;
		
		if (targetType === 'merge' && targetNode.multiInputs && targetNode.multiInputs[inputSlot]) {
			// Multi-input connection for merge nodes
			const linkId = ++this.schemaGraph.graph.last_link_id;
			link = new Link(
				linkId,
				sourceNode.id,
				outputSlot,
				targetNode.id,
				inputSlot,
				'Any'
			);
			
			this.schemaGraph.graph.links[linkId] = link;
			sourceNode.outputs[outputSlot].links.push(linkId);
			targetNode.multiInputs[inputSlot].links.push(linkId);
		} else {
			// Regular single connection
			link = this.schemaGraph.graph.connect(sourceNode, outputSlot, targetNode, inputSlot);
		}
		
		if (!link) {
			console.error('❌ Failed to create edge:', `[${workflowEdge.source}] -> [${workflowEdge.target}]`);
			return null;
		}
		
		this.workflowEdges.push(link);
		
		link.workflowData = {
			source: workflowEdge.source,
			target: workflowEdge.target,
			condition: workflowEdge.condition,
			label: workflowEdge.label,
			outputSlot: outputSlot,
			inputSlot: inputSlot
		};
		
		if (workflowEdge.label) {
			link.label = workflowEdge.label;
		}
		
		if (workflowEdge.condition) {
			this.styleConditionalEdge(link, workflowEdge.condition);
		}
		
		console.log(`✔ Created edge: [${workflowEdge.source}:${outputSlot}] -> [${workflowEdge.target}:${inputSlot}]`);
		return link;
	}

	getBranchNameFromCondition(condition) {
		// Extract branch name from condition value
		if (condition.value !== undefined) {
			return String(condition.value); // e.g., "technical", "billing", "general"
		}
		if (condition.field) {
			return condition.field;
		}
		if (condition.label) {
			return condition.label;
		}
		return 'default';
	}

	styleConditionalEdge(link, condition) {
		link.conditionType = condition.type;
		link.conditionInfo = {
			field: condition.field,
			value: condition.value,
			expression: condition.expression
		};
		link.isConditional = true;
		
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
	 * USAGE: Call when you want to display edge condition details in UI
	 * Example: const condInfo = visualizer.getEdgeConditionInfo(0, 1);
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
	 * Highlight edges that match a condition (for decision nodes)
	 * USAGE: Called automatically by updateNodeState when a decision node executes
	 * Can also call manually: visualizer.highlightConditionalEdges(3, 5);
	 */
	highlightConditionalEdges(sourceIndex, matchedBranch) {
		const sourceNode = this.workflowNodes[sourceIndex];
		if (!sourceNode) return;
		
		this.workflowEdges.forEach(link => {
			if (link.workflowData?.source === sourceIndex) {
				const targetIndex = link.workflowData?.target;
				const isMatchedPath = (targetIndex === matchedBranch);
				
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
	 * Update node execution state
	 * USAGE: Called by workflow event handlers when node state changes
	 * Example: visualizer.updateNodeState(2, {status: 'running'});
	 */
	updateNodeState(nodeIndex, state) {
		if (nodeIndex >= this.workflowNodes.length) return;
		const graphNode = this.workflowNodes[nodeIndex];
		if (!graphNode) return;
		
		// Update metadata
		if (graphNode.workflowData) {
			graphNode.workflowData.status = state.status;
			graphNode.workflowData.error = state.error;
			graphNode.workflowData.output = state.output;
		}
		
		// Update visual appearance
		const statusEmoji = this.getStatusEmoji(state.status);
		const label = graphNode.workflowData?.label || graphNode.workflowData?.type || 'unknown';
		this.schemaGraph.api.node.setProperty(graphNode, 'label', `${statusEmoji} [${nodeIndex}] ${label}`);
		
		// Highlight running nodes
		if (state.status === 'running') {
			this.schemaGraph.api.node.select(graphNode, false);
		}
		
		// 🔧 Highlight decision branches when decision completes
		if (graphNode.workflowData?.type === 'decision' && state.output?.branch !== undefined) {
			this.highlightConditionalEdges(nodeIndex, state.output.branch);
		}
	}

	getStatusEmoji(status) {
		const statusMap = {
			'pending': '⏳', 'running': '▶️', 'completed': '✅',
			'failed': '❌', 'cancelled': '⏸️', 'waiting': '⏱️', 'skipped': '⏭️'
		};
		return statusMap[status] || '⚪';
	}

	/**
	 * Highlight execution path by node indices
	 * USAGE: Call to show which nodes are part of the execution path
	 * Example: visualizer.highlightPath([0, 1, 2, 5]);
	 */
	highlightPath(nodeIndices) {
		this.schemaGraph.api.node.clearSelection();
		
		// Select all nodes in path
		nodeIndices.forEach(nodeIndex => {
			if (nodeIndex < this.workflowNodes.length) {
				const graphNode = this.workflowNodes[nodeIndex];
				if (graphNode) {
					this.schemaGraph.api.node.select(graphNode, true);
				}
			}
		});
		
		// Highlight edges in path
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
	 * Clear all highlights and reset node states
	 * USAGE: Call when starting a new execution or resetting the visualization
	 */
	clearHighlights() {
		this.schemaGraph.api.node.clearSelection();
		
		// Reset edge highlighting
		this.workflowEdges.forEach(link => {
			link.isActive = false;
			link.isDimmed = false;
			link.isInExecutionPath = false;
		});
		
		// Reset node labels and status
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
	 * Export workflow with updated node positions
	 * USAGE: Call when saving workflow to file
	 */
	exportWorkflow() {
		if (!this.currentWorkflow) return null;
		const exported = JSON.parse(JSON.stringify(this.currentWorkflow));
		
		// Update positions from graph
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
	 * USAGE: Call from console or when displaying node details in UI
	 * Example: const info = visualizer.inspectNode(3);
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
			output: graphNode.workflowData?.output,
			// Additional graph-specific info
			inputs: graphNode.inputs?.map(i => ({
				name: i.name,
				type: i.type,
				connected: i.link !== null
			})),
			outputs: graphNode.outputs?.map(o => ({
				name: o.name,
				type: o.type,
				connections: o.links?.length || 0
			}))
		};
	}

	/**
	 * Get detailed info about edges from a node
	 * USAGE: Call when you want to see all connections of a node
	 * Example: const edges = visualizer.inspectNodeEdges(3);
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
					conditionLabel: link.conditionLabel,
					isActive: link.isActive,
					isDimmed: link.isDimmed
				});
			}
			if (link.workflowData?.target === nodeIndex) {
				incoming.push({
					source: link.workflowData.source,
					condition: link.workflowData.condition,
					label: link.workflowData.label,
					conditionLabel: link.conditionLabel,
					isActive: link.isActive,
					isDimmed: link.isDimmed
				});
			}
		});
		
		return { incoming, outgoing };
	}

	// ====================================================================
	// Helper Methods
	// ====================================================================

	getGraphNodeByIndex(nodeIndex) {
		return this.workflowNodes[nodeIndex] || null;
	}

	getNodeIndex(graphNode) {
		return this.workflowNodes.indexOf(graphNode);
	}

	getAllNodes() {
		return this.workflowNodes.filter(node => node !== null);
	}

	getWorkflowData(graphNode) {
		return graphNode?.workflowData || null;
	}
}


// ========================================================================
// USAGE EXAMPLES - Where to Call These Methods
// ========================================================================

/*
// 1. When workflow loads:
workflowVisualizer.loadWorkflow(workflowData);

// 2. When WebSocket event arrives (in event handler):
workflowClient.on('node.started', (event) => {
	const nodeIndex = parseInt(event.node_id);
	workflowVisualizer.updateNodeState(nodeIndex, { status: 'running' });
});

workflowClient.on('node.completed', (event) => {
	const nodeIndex = parseInt(event.node_id);
	workflowVisualizer.updateNodeState(nodeIndex, { 
		status: 'completed',
		output: event.data?.output 
	});
});

// 3. When decision node completes, highlightConditionalEdges is called automatically
// by updateNodeState, but you can also call it manually:
workflowVisualizer.highlightConditionalEdges(3, 5); // Source node 3, matched branch at node 5

// 4. To show execution path (call after workflow completes or when reviewing):
const executionPath = [0, 1, 3, 5, 7, 9]; // Indices of nodes that executed
workflowVisualizer.highlightPath(executionPath);

// 5. To reset visualization before new execution:
startWorkflowBtn.addEventListener('click', () => {
	workflowVisualizer.clearHighlights();
	// ... then start workflow
});

// 6. To inspect a node (e.g., on node click or for debugging):
canvas.addEventListener('click', (event) => {
	const clickedNode = getNodeAtPosition(event.x, event.y);
	if (clickedNode) {
		const nodeIndex = workflowVisualizer.getNodeIndex(clickedNode);
		const nodeInfo = workflowVisualizer.inspectNode(nodeIndex);
		console.log('Node info:', nodeInfo);
		
		const edges = workflowVisualizer.inspectNodeEdges(nodeIndex);
		console.log('Node edges:', edges);
	}
});

// 7. To get edge condition info (e.g., for tooltip):
canvas.addEventListener('mouseover', (event) => {
	const edge = getEdgeAtPosition(event.x, event.y);
	if (edge) {
		const condInfo = workflowVisualizer.getEdgeConditionInfo(
			edge.workflowData.source, 
			edge.workflowData.target
		);
		if (condInfo) {
			showTooltip(`Condition: ${condInfo.label}`);
		}
	}
});

// 8. When saving workflow:
saveWorkflowBtn.addEventListener('click', () => {
	const exportedWorkflow = workflowVisualizer.exportWorkflow();
	downloadJSON(exportedWorkflow, 'workflow.json');
});

// 9. Debug helpers (call from console):
window.debugWorkflow = () => {
	console.log('Current workflow:', workflowVisualizer.currentWorkflow);
	console.log('All nodes:');
	workflowVisualizer.getAllNodes().forEach((node, i) => {
		console.log(`[${i}]`, workflowVisualizer.inspectNode(i));
	});
};
*/


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
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/status`, {
			method: 'POST',
		});

		if (!response.ok) {
			throw new Error(`Failed to get workflow status: ${response.statusText}`);
		}

		return await response.json();
	}

	async listWorkflows() {
		const response = await fetch(`${this.baseUrl}/workflow/list`, {
			method: 'POST',
		});

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
		const response = await fetch(`${this.baseUrl}/workflow/events/history/delete`, {
			method: 'POST',
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
