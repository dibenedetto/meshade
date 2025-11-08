/* ========================================================================
   NUMEL WORKFLOW - COMPLETE REWRITE WITH FIXES
   ======================================================================== */

const WORKFLOW_SCHEMA_NAME = "workflow";

class WorkflowVisualizer {
	constructor(schemaGraphApp) {
		this.schemaGraph = schemaGraphApp;
		// Separate state for chat and workflow modes
		this.savedChatGraphState = null;
		this.savedChatViewState = null;
		this.savedWorkflowViewState = null;
		this.workflowNodes = [];
		this.workflowEdges = [];
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
		
		if (this.isWorkflowMode) {
			console.log('Already in workflow mode');
			return;
		}

		// Save chat state completely
		this.savedChatGraphState = this.schemaGraph.api.graph.export(false);
		this.savedChatViewState = this.schemaGraph.api.view.export();
		console.log('💾 Saved chat state');
		
		// Clear the graph - workflow will be rebuilt
		this.schemaGraph.api.graph.clear();
		
		// DON'T restore workflow view here - let loadWorkflow handle it
		
		this.workflowNodes = [];
		this.workflowEdges = [];
		this.isWorkflowMode = true;
		
		console.log('✅ Entered workflow mode');
	}

	exitWorkflowMode() {
		console.log('📊 Exiting workflow mode...');
		
		if (!this.isWorkflowMode) {
			console.log('Not in workflow mode');
			return;
		}
		
		// Save workflow view state for later
		this.savedWorkflowViewState = this.schemaGraph.api.view.export();
		console.log('💾 Saved workflow view state');
		
		// Restore chat state completely
		if (this.savedChatGraphState) {
			console.log('🔄 Restoring chat state');
			this.schemaGraph.api.graph.import(this.savedChatGraphState, false);
			if (this.savedChatViewState) {
				this.schemaGraph.api.view.import(this.savedChatViewState);
			}
		} else {
			this.schemaGraph.api.graph.clear();
		}
		
		this.workflowNodes = [];
		this.workflowEdges = [];
		this.isWorkflowMode = false;
		
		console.log('✅ Exited workflow mode');
	}

	isInWorkflowMode() {
		return this.isWorkflowMode;
	}

	// ====================================================================
	// Workflow Loading
	// ====================================================================

	loadWorkflow(workflow, applyLayout = true, restoreView = true) {
		console.log('📋 Loading workflow:', workflow);
		console.log('   applyLayout:', applyLayout, 'restoreView:', restoreView);
		
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

		// Handle layout and view
		if (applyLayout) {
			console.log('📐 Applying hierarchical layout');
			this.schemaGraph.api.layout.apply('hierarchical-vertical');
			setTimeout(() => {
				this.schemaGraph.api.view.center();
			}, 100);
		} else if (restoreView && this.savedWorkflowViewState) {
			console.log('📐 Restoring saved workflow view');
			// Apply immediately to prevent visual glitch
			this.schemaGraph.api.view.import(this.savedWorkflowViewState);
		} else {
			console.log('📐 Centering view on workflow');
			setTimeout(() => {
				this.schemaGraph.api.view.center();
			}, 100);
		}

		// Force visualization refresh
		this.refreshVisualization();

		console.log('✅ Workflow loaded:', {
			nodes: this.workflowNodes.length,
			edges: this.workflowEdges.length
		});
	}

	refreshVisualization() {
		if (this.schemaGraph && this.schemaGraph.draw) {
			this.schemaGraph.draw();
		}
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
		
		// Create the node using schema system
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
		
		// Add visual connection slots
		this.addVisualConnectionSlots(graphNode, workflowNode);
		
		// Calculate proper node size based on slot count
		const maxSlots = Math.max(graphNode.inputs.length, graphNode.outputs.length);
		const nodeHeight = Math.max(100, 38 + maxSlots * 25);
		graphNode.size = [200, nodeHeight];
		
		// Set visual properties
		const label = this.getNodeLabel(workflowNode, index);
		this.schemaGraph.api.node.setProperty(graphNode, 'label', label);
		graphNode.color = this.getNodeColor(workflowNode.type);
		
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
		
		console.log(`✓ Created node [${index}]: ${workflowNode.id} (${nodeType})`);
		return graphNode;
	}

	addVisualConnectionSlots(graphNode, workflowNode) {
		const nodeType = workflowNode.type;
		const universalType = 'Any';
		
		const originalInputs = graphNode.inputs || [];
		const originalOutputs = graphNode.outputs || [];
		
		graphNode.inputs = [];
		graphNode.outputs = [];
		
		switch (nodeType) {
			case 'start':
				graphNode.inputs = originalInputs;
				graphNode.outputs = [{name: 'flow', type: universalType, links: []}, ...originalOutputs];
				break;
				
			case 'end':
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				graphNode.outputs = originalOutputs;
				break;
				
			case 'decision':
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
				graphNode.inputs = [{name: 'flow', type: universalType, link: null}, ...originalInputs];
				graphNode.outputs = [
					{name: 'body', type: universalType, links: []},
					{name: 'exit', type: universalType, links: []},
					...originalOutputs
				];
				break;
				
			default:
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
			'start': '🎬', 'end': '🏁', 'agent': '🤖', 'prompt': '💭',
			'tool': '🔧', 'transform': '🔄', 'decision': '🔀', 'merge': '🔗',
			'parallel': '⚡', 'loop': '🔁', 'user_input': '👤'
		};
		return emojiMap[nodeType] || '⚪';
	}

	getNodeColor(nodeType) {
		const colorMap = {
			'start': '#4ade80', 'end': '#f87171', 'agent': '#60a5fa', 'prompt': '#a78bfa',
			'tool': '#fb923c', 'transform': '#fbbf24', 'decision': '#ec4899', 'merge': '#14b8a6',
			'parallel': '#8b5cf6', 'loop': '#06b6d4', 'user_input': '#f472b6'
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
		
		let outputSlot = 0;
		const sourceType = sourceNode.workflowData?.type;
		
		if (sourceType === 'decision' && workflowEdge.condition) {
			const branchName = this.getBranchNameFromCondition(workflowEdge.condition);
			outputSlot = sourceNode.outputs.findIndex(o => o.name === branchName);
			if (outputSlot === -1) {
				console.warn(`⚠️ Branch "${branchName}" not found, using slot 0`);
				outputSlot = 0;
			}
		} else if (sourceType === 'loop') {
			const isExitEdge = workflowEdge.label?.toLowerCase().includes('exit') || 
							workflowEdge.label?.toLowerCase().includes('done') ||
							workflowEdge.label?.toLowerCase().includes('complete');
			outputSlot = isExitEdge ? 1 : 0;
		} else if (sourceType === 'parallel') {
			outputSlot = sourceNode.outputs.findIndex(o => 
				o.name.startsWith('branch_') && (!o.links || o.links.length === 0)
			);
			if (outputSlot === -1) {
				outputSlot = sourceNode.outputs.findIndex(o => o.name.startsWith('branch_'));
				if (outputSlot === -1) outputSlot = 0;
			}
		} else {
			outputSlot = sourceNode.outputs.findIndex(o => o.name === 'flow');
			if (outputSlot === -1) outputSlot = 0;
		}
		
		let inputSlot = 0;
		const targetType = targetNode.workflowData?.type;
		
		if (targetType === 'merge') {
			inputSlot = Object.keys(targetNode.multiInputs || {}).findIndex(slotIdx => {
				const slot = targetNode.multiInputs[slotIdx];
				return slot && (!slot.links || slot.links.length === 0);
			});
			if (inputSlot === -1) inputSlot = 0;
		} else {
			inputSlot = targetNode.inputs.findIndex(i => i.name === 'flow');
			if (inputSlot === -1) inputSlot = 0;
		}
		
		let link;
		
		if (targetType === 'merge' && targetNode.multiInputs && targetNode.multiInputs[inputSlot]) {
			const linkId = ++this.schemaGraph.graph.last_link_id;
			link = new Link(linkId, sourceNode.id, outputSlot, targetNode.id, inputSlot, 'Any');
			this.schemaGraph.graph.links[linkId] = link;
			sourceNode.outputs[outputSlot].links.push(linkId);
			targetNode.multiInputs[inputSlot].links.push(linkId);
		} else {
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
		
		console.log(`✓ Created edge: [${workflowEdge.source}:${outputSlot}] -> [${workflowEdge.target}:${inputSlot}]`);
		return link;
	}

	getBranchNameFromCondition(condition) {
		if (condition.value !== undefined) {
			return String(condition.value);
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

	// ====================================================================
	// Execution State Updates
	// ====================================================================

	updateNodeState(nodeIndex, state) {
		if (nodeIndex >= this.workflowNodes.length) return;
		const graphNode = this.workflowNodes[nodeIndex];
		if (!graphNode) return;
		
		if (graphNode.workflowData) {
			graphNode.workflowData.status = state.status;
			graphNode.workflowData.error = state.error;
			graphNode.workflowData.output = state.output;
		}
		
		const statusEmoji = this.getStatusEmoji(state.status);
		const label = graphNode.workflowData?.label || graphNode.workflowData?.type || 'unknown';
		this.schemaGraph.api.node.setProperty(graphNode, 'label', `${statusEmoji} [${nodeIndex}] ${label}`);
		
		if (state.status === 'running') {
			this.schemaGraph.api.node.select(graphNode, false);
		}
		
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

	highlightConditionalEdges(sourceIndex, matchedBranch) {
		const sourceNode = this.workflowNodes[sourceIndex];
		if (!sourceNode) return;
		
		this.workflowEdges.forEach(link => {
			if (link.workflowData?.source === sourceIndex) {
				const targetIndex = link.workflowData?.target;
				const isMatchedPath = (targetIndex === matchedBranch);
				link.isActive = isMatchedPath;
				link.isDimmed = !isMatchedPath;
			}
		});
	}

	highlightPath(nodeIndices) {
		this.schemaGraph.api.node.clearSelection();
		
		nodeIndices.forEach(nodeIndex => {
			if (nodeIndex < this.workflowNodes.length) {
				const graphNode = this.workflowNodes[nodeIndex];
				if (graphNode) {
					this.schemaGraph.api.node.select(graphNode, true);
				}
			}
		});
		
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
	}

	clearHighlights() {
		this.schemaGraph.api.node.clearSelection();
		
		this.workflowEdges.forEach(link => {
			link.isActive = false;
			link.isDimmed = false;
			link.isInExecutionPath = false;
		});
		
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
	}

	// ====================================================================
	// Workflow Export
	// ====================================================================

	exportWorkflow() {
		if (!this.currentWorkflow) return null;
		
		const exported = {
			info: this.currentWorkflow.info || {},
			options: this.currentWorkflow.options || {},
			nodes: [],
			edges: [],
			variables: this.currentWorkflow.variables || {}
		};
		
		const oldToNewIndex = new Map();
		let newIndex = 0;
		
		for (let oldIndex = 0; oldIndex < this.workflowNodes.length; oldIndex++) {
			const graphNode = this.workflowNodes[oldIndex];
			const isInGraph = graphNode && this.schemaGraph.graph.nodes.includes(graphNode);
			
			if (isInGraph && graphNode.workflowData && graphNode.workflowData.nodeConfig) {
				oldToNewIndex.set(oldIndex, newIndex);
				const nodeData = JSON.parse(JSON.stringify(graphNode.workflowData.nodeConfig));
				
				if (graphNode.pos) {
					nodeData.position = {
						x: Math.round(graphNode.pos[0]),
						y: Math.round(graphNode.pos[1])
					};
				}
				
				exported.nodes.push(nodeData);
				newIndex++;
			}
		}
		
		for (const linkId in this.schemaGraph.graph.links) {
			const link = this.schemaGraph.graph.links[linkId];
			if (link.workflowData) {
				const oldSourceIndex = link.workflowData.source;
				const oldTargetIndex = link.workflowData.target;
				const newSourceIndex = oldToNewIndex.get(oldSourceIndex);
				const newTargetIndex = oldToNewIndex.get(oldTargetIndex);
				
				if (newSourceIndex !== undefined && newTargetIndex !== undefined) {
					const edge = {
						source: newSourceIndex,
						target: newTargetIndex
					};
					if (link.workflowData.label) {
						edge.label = link.workflowData.label;
					}
					if (link.workflowData.condition) {
						edge.condition = link.workflowData.condition;
					}
					exported.edges.push(edge);
				}
			}
		}
		
		return exported;
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

	inspectNode(nodeIndex) {
		const graphNode = this.workflowNodes[nodeIndex];
		if (!graphNode) return null;
		
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
}

// ========================================================================
// WorkflowClient
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
			body: JSON.stringify({ workflow, initial_data: initialData })
		});
		if (!response.ok) throw new Error(`Failed to start workflow: ${response.statusText}`);
		return await response.json();
	}

	async cancelWorkflow(executionId) {
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/cancel`, { method: 'POST' });
		if (!response.ok) throw new Error(`Failed to cancel workflow: ${response.statusText}`);
		return await response.json();
	}

	async getWorkflowStatus(executionId) {
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/status`, { method: 'POST' });
		if (!response.ok) throw new Error(`Failed to get workflow status: ${response.statusText}`);
		return await response.json();
	}

	async listWorkflows() {
		const response = await fetch(`${this.baseUrl}/workflow/list`, { method: 'POST' });
		if (!response.ok) throw new Error(`Failed to list workflows: ${response.statusText}`);
		return await response.json();
	}

	async provideUserInput(executionId, nodeId, inputData) {
		const response = await fetch(`${this.baseUrl}/workflow/${executionId}/input`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ node_id: nodeId, input_data: inputData })
		});
		if (!response.ok) throw new Error(`Failed to provide user input: ${response.statusText}`);
		return await response.json();
	}

	async getEventHistory(filters = {}) {
		const response = await fetch(`${this.baseUrl}/workflow/events/history`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(filters)
		});
		if (!response.ok) throw new Error(`Failed to get event history: ${response.statusText}`);
		return await response.json();
	}

	async clearEventHistory() {
		const response = await fetch(`${this.baseUrl}/workflow/events/history/delete`, { method: 'POST' });
		if (!response.ok) throw new Error(`Failed to clear event history: ${response.statusText}`);
		return await response.json();
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { WorkflowClient, WorkflowVisualizer };
}