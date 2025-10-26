/* ========================================================================
   SCHEMAGRAPH WORKFLOW EXTENSION
   Adds workflow editor and execution capabilities to SchemaGraphApp
   ======================================================================== */

console.log('=== SCHEMAGRAPH WORKFLOW EXTENSION LOADING ===');

// ========================================================================
// WORKFLOW NODE TYPES
// ========================================================================

class WorkflowNodeTypes {
  
  static register(graph, eventBus) {
    console.log('Registering workflow node types...');
    
    // Control Flow Nodes
    this.registerStartNode(graph, eventBus);
    this.registerEndNode(graph, eventBus);
    this.registerDecisionNode(graph, eventBus);
    this.registerMergeNode(graph, eventBus);
    this.registerParallelNode(graph, eventBus);
    this.registerLoopNode(graph, eventBus);
    
    // AI Operation Nodes
    this.registerAgentNode(graph, eventBus);
    this.registerPromptNode(graph, eventBus);
    
    // Data Operation Nodes
    this.registerTransformNode(graph, eventBus);
    this.registerExtractNode(graph, eventBus);
    this.registerValidateNode(graph, eventBus);
    
    // External Operation Nodes
    this.registerAPICallNode(graph, eventBus);
    this.registerToolCallNode(graph, eventBus);
    this.registerWebhookNode(graph, eventBus);
    
    // User Interaction Nodes
    this.registerUserInputNode(graph, eventBus);
    this.registerNotificationNode(graph, eventBus);
    
    console.log('✅ Workflow node types registered');
  }
  
  // Control Flow Nodes
  
  static registerStartNode(graph, eventBus) {
    class WorkflowStartNode extends Node {
      constructor() {
        super('Workflow.Start');
        this.addOutput('flow', 'Flow');
        this.properties.trigger = 'manual'; // or 'schedule', 'webhook', 'event'
        this.size = [180, 80];
        this.isWorkflow = true;
        this.workflowNodeType = 'start';
      }
      
      onExecute() {
        this.setOutputData(0, { status: 'started', timestamp: Date.now() });
      }
    }
    
    graph.nodeTypes['Workflow.Start'] = WorkflowStartNode;
  }
  
  static registerEndNode(graph, eventBus) {
    class WorkflowEndNode extends Node {
      constructor() {
        super('Workflow.End');
        this.addInput('flow', 'Flow');
        this.addOutput('result', 'Any');
        this.properties.collect_outputs = true;
        this.size = [180, 80];
        this.isWorkflow = true;
        this.workflowNodeType = 'end';
      }
      
      onExecute() {
        const flowData = this.getInputData(0);
        this.setOutputData(0, { status: 'completed', data: flowData });
      }
    }
    
    graph.nodeTypes['Workflow.End'] = WorkflowEndNode;
  }
  
  static registerDecisionNode(graph, eventBus) {
    class WorkflowDecisionNode extends Node {
      constructor() {
        super('Workflow.Decision');
        this.addInput('flow', 'Flow');
        this.addInput('condition_data', 'Any');
        this.addOutput('true_path', 'Flow');
        this.addOutput('false_path', 'Flow');
        this.properties.condition = 'data.value > 0';
        this.properties.evaluation_mode = 'expression'; // or 'function'
        this.size = [200, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'decision';
      }
      
      onExecute() {
        const data = this.getInputData(1);
        const condition = this.properties.condition;
        
        try {
          // Simple evaluation (in production, use safer method)
          const result = eval(condition.replace(/data\./g, 'data.'));
          
          if (result) {
            this.setOutputData(0, { decision: 'true', data });
            eventBus.emit('workflow:decision', { node: this.id, path: 'true' });
          } else {
            this.setOutputData(1, { decision: 'false', data });
            eventBus.emit('workflow:decision', { node: this.id, path: 'false' });
          }
        } catch (e) {
          eventBus.emit('workflow:error', { node: this.id, error: e.message });
        }
      }
    }
    
    graph.nodeTypes['Workflow.Decision'] = WorkflowDecisionNode;
  }
  
  static registerMergeNode(graph, eventBus) {
    class WorkflowMergeNode extends Node {
      constructor() {
        super('Workflow.Merge');
        this.addInput('input_1', 'Flow');
        this.addInput('input_2', 'Flow');
        this.addOutput('flow', 'Flow');
        this.properties.merge_strategy = 'first'; // or 'last', 'combine'
        this.size = [180, 100];
        this.isWorkflow = true;
        this.workflowNodeType = 'merge';
      }
      
      onExecute() {
        const input1 = this.getInputData(0);
        const input2 = this.getInputData(1);
        
        if (this.properties.merge_strategy === 'first') {
          this.setOutputData(0, input1 || input2);
        } else if (this.properties.merge_strategy === 'last') {
          this.setOutputData(0, input2 || input1);
        } else {
          this.setOutputData(0, { input1, input2 });
        }
      }
    }
    
    graph.nodeTypes['Workflow.Merge'] = WorkflowMergeNode;
  }
  
  static registerParallelNode(graph, eventBus) {
    class WorkflowParallelNode extends Node {
      constructor() {
        super('Workflow.Parallel');
        this.addInput('flow', 'Flow');
        this.addOutput('branch_1', 'Flow');
        this.addOutput('branch_2', 'Flow');
        this.addOutput('branch_3', 'Flow');
        this.properties.wait_for_all = true;
        this.size = [200, 140];
        this.isWorkflow = true;
        this.workflowNodeType = 'parallel';
      }
      
      onExecute() {
        const flowData = this.getInputData(0);
        // Split flow to all branches
        this.setOutputData(0, { ...flowData, branch: 1 });
        this.setOutputData(1, { ...flowData, branch: 2 });
        this.setOutputData(2, { ...flowData, branch: 3 });
        eventBus.emit('workflow:parallel', { node: this.id, branches: 3 });
      }
    }
    
    graph.nodeTypes['Workflow.Parallel'] = WorkflowParallelNode;
  }
  
  static registerLoopNode(graph, eventBus) {
    class WorkflowLoopNode extends Node {
      constructor() {
        super('Workflow.Loop');
        this.addInput('flow', 'Flow');
        this.addInput('items', 'List[Any]');
        this.addOutput('item', 'Any');
        this.addOutput('done', 'Flow');
        this.properties.max_iterations = 100;
        this.properties.current_iteration = 0;
        this.size = [200, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'loop';
      }
      
      onExecute() {
        const items = this.getInputData(1) || [];
        const currentIdx = this.properties.current_iteration || 0;
        
        if (currentIdx < items.length && currentIdx < this.properties.max_iterations) {
          this.setOutputData(0, items[currentIdx]);
          this.properties.current_iteration = currentIdx + 1;
        } else {
          this.setOutputData(1, { status: 'completed', iterations: currentIdx });
          this.properties.current_iteration = 0;
        }
      }
    }
    
    graph.nodeTypes['Workflow.Loop'] = WorkflowLoopNode;
  }
  
  // AI Operation Nodes
  
  static registerAgentNode(graph, eventBus) {
    class WorkflowAgentNode extends Node {
      constructor() {
        super('Workflow.Agent');
        this.addInput('flow', 'Flow');
        this.addInput('message', 'str');
        this.addInput('agent_ref', 'int');
        this.addOutput('response', 'str');
        this.addOutput('flow', 'Flow');
        this.properties.agent_id = 0;
        this.properties.streaming = true;
        this.size = [220, 140];
        this.isWorkflow = true;
        this.workflowNodeType = 'agent';
      }
      
      onExecute() {
        const message = this.getInputData(1);
        const agentRef = this.getInputData(2) || this.properties.agent_id;
        
        // Emit event for external agent execution
        eventBus.emit('workflow:agent_call', {
          node: this.id,
          agent_ref: agentRef,
          message: message
        });
        
        // Mock response for now
        this.setOutputData(0, `Agent ${agentRef} response to: ${message}`);
        this.setOutputData(1, { status: 'completed' });
      }
    }
    
    graph.nodeTypes['Workflow.Agent'] = WorkflowAgentNode;
  }
  
  static registerPromptNode(graph, eventBus) {
    class WorkflowPromptNode extends Node {
      constructor() {
        super('Workflow.Prompt');
        this.addInput('flow', 'Flow');
        this.addInput('variables', 'Dict[str,Any]');
        this.addOutput('prompt', 'str');
        this.addOutput('flow', 'Flow');
        this.properties.template = 'Hello {name}, how can I help you?';
        this.size = [220, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'prompt';
      }
      
      onExecute() {
        const variables = this.getInputData(1) || {};
        let prompt = this.properties.template;
        
        // Simple template replacement
        for (const [key, value] of Object.entries(variables)) {
          prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        
        this.setOutputData(0, prompt);
        this.setOutputData(1, { status: 'completed' });
      }
    }
    
    graph.nodeTypes['Workflow.Prompt'] = WorkflowPromptNode;
  }
  
  // Data Operation Nodes
  
  static registerTransformNode(graph, eventBus) {
    class WorkflowTransformNode extends Node {
      constructor() {
        super('Workflow.Transform');
        this.addInput('flow', 'Flow');
        this.addInput('data', 'Any');
        this.addOutput('result', 'Any');
        this.addOutput('flow', 'Flow');
        this.properties.expression = 'data.toUpperCase()';
        this.size = [220, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'transform';
      }
      
      onExecute() {
        const data = this.getInputData(1);
        const expression = this.properties.expression;
        
        try {
          const result = eval(expression);
          this.setOutputData(0, result);
          this.setOutputData(1, { status: 'completed' });
        } catch (e) {
          eventBus.emit('workflow:error', { node: this.id, error: e.message });
          this.setOutputData(0, null);
        }
      }
    }
    
    graph.nodeTypes['Workflow.Transform'] = WorkflowTransformNode;
  }
  
  static registerExtractNode(graph, eventBus) {
    class WorkflowExtractNode extends Node {
      constructor() {
        super('Workflow.Extract');
        this.addInput('flow', 'Flow');
        this.addInput('data', 'Any');
        this.addOutput('result', 'Any');
        this.addOutput('flow', 'Flow');
        this.properties.path = 'response.data.items[0]';
        this.size = [220, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'extract';
      }
      
      onExecute() {
        const data = this.getInputData(1);
        const path = this.properties.path;
        
        try {
          // Simple path extraction
          const parts = path.split('.');
          let result = data;
          for (const part of parts) {
            if (part.includes('[')) {
              const [prop, idx] = part.split('[');
              result = result[prop][parseInt(idx.replace(']', ''))];
            } else {
              result = result[part];
            }
          }
          this.setOutputData(0, result);
          this.setOutputData(1, { status: 'completed' });
        } catch (e) {
          eventBus.emit('workflow:error', { node: this.id, error: e.message });
          this.setOutputData(0, null);
        }
      }
    }
    
    graph.nodeTypes['Workflow.Extract'] = WorkflowExtractNode;
  }
  
  static registerValidateNode(graph, eventBus) {
    class WorkflowValidateNode extends Node {
      constructor() {
        super('Workflow.Validate');
        this.addInput('flow', 'Flow');
        this.addInput('data', 'Any');
        this.addOutput('valid', 'Flow');
        this.addOutput('invalid', 'Flow');
        this.properties.rules = '{ required: ["name", "email"], types: { age: "number" } }';
        this.size = [220, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'validate';
      }
      
      onExecute() {
        const data = this.getInputData(1);
        
        try {
          const rules = JSON.parse(this.properties.rules);
          let isValid = true;
          
          // Simple validation
          if (rules.required) {
            for (const field of rules.required) {
              if (!data[field]) {
                isValid = false;
                break;
              }
            }
          }
          
          if (isValid) {
            this.setOutputData(0, { status: 'valid', data });
            eventBus.emit('workflow:validation', { node: this.id, result: 'valid' });
          } else {
            this.setOutputData(1, { status: 'invalid', data });
            eventBus.emit('workflow:validation', { node: this.id, result: 'invalid' });
          }
        } catch (e) {
          eventBus.emit('workflow:error', { node: this.id, error: e.message });
        }
      }
    }
    
    graph.nodeTypes['Workflow.Validate'] = WorkflowValidateNode;
  }
  
  // External Operation Nodes
  
  static registerAPICallNode(graph, eventBus) {
    class WorkflowAPICallNode extends Node {
      constructor() {
        super('Workflow.APICall');
        this.addInput('flow', 'Flow');
        this.addInput('url', 'str');
        this.addInput('data', 'Any');
        this.addOutput('response', 'Any');
        this.addOutput('flow', 'Flow');
        this.properties.method = 'POST';
        this.properties.headers = '{"Content-Type": "application/json"}';
        this.size = [220, 140];
        this.isWorkflow = true;
        this.workflowNodeType = 'api_call';
      }
      
      async onExecute() {
        const url = this.getInputData(1) || this.properties.url;
        const data = this.getInputData(2);
        
        eventBus.emit('workflow:api_call', {
          node: this.id,
          method: this.properties.method,
          url: url
        });
        
        // Mock response
        this.setOutputData(0, { status: 200, data: 'API response' });
        this.setOutputData(1, { status: 'completed' });
      }
    }
    
    graph.nodeTypes['Workflow.APICall'] = WorkflowAPICallNode;
  }
  
  static registerToolCallNode(graph, eventBus) {
    class WorkflowToolCallNode extends Node {
      constructor() {
        super('Workflow.ToolCall');
        this.addInput('flow', 'Flow');
        this.addInput('tool_ref', 'int');
        this.addInput('args', 'Dict[str,Any]');
        this.addOutput('result', 'Any');
        this.addOutput('flow', 'Flow');
        this.properties.tool_id = 0;
        this.size = [220, 140];
        this.isWorkflow = true;
        this.workflowNodeType = 'tool_call';
      }
      
      onExecute() {
        const toolRef = this.getInputData(1) || this.properties.tool_id;
        const args = this.getInputData(2) || {};
        
        eventBus.emit('workflow:tool_call', {
          node: this.id,
          tool_ref: toolRef,
          args: args
        });
        
        // Mock result
        this.setOutputData(0, { result: `Tool ${toolRef} result` });
        this.setOutputData(1, { status: 'completed' });
      }
    }
    
    graph.nodeTypes['Workflow.ToolCall'] = WorkflowToolCallNode;
  }
  
  static registerWebhookNode(graph, eventBus) {
    class WorkflowWebhookNode extends Node {
      constructor() {
        super('Workflow.Webhook');
        this.addInput('flow', 'Flow');
        this.addInput('data', 'Any');
        this.addOutput('response', 'Any');
        this.addOutput('flow', 'Flow');
        this.properties.url = 'https://example.com/webhook';
        this.properties.method = 'POST';
        this.size = [220, 120];
        this.isWorkflow = true;
        this.workflowNodeType = 'webhook';
      }
      
      onExecute() {
        const data = this.getInputData(1);
        
        eventBus.emit('workflow:webhook', {
          node: this.id,
          url: this.properties.url,
          data: data
        });
        
        // Mock response
        this.setOutputData(0, { status: 'sent' });
        this.setOutputData(1, { status: 'completed' });
      }
    }
    
    graph.nodeTypes['Workflow.Webhook'] = WorkflowWebhookNode;
  }
  
  // User Interaction Nodes
  
  static registerUserInputNode(graph, eventBus) {
    class WorkflowUserInputNode extends Node {
      constructor() {
        super('Workflow.UserInput');
        this.addInput('flow', 'Flow');
        this.addOutput('input', 'str');
        this.addOutput('flow', 'Flow');
        this.properties.prompt = 'Enter your input:';
        this.properties.variable = 'user_input';
        this.size = [220, 100];
        this.isWorkflow = true;
        this.workflowNodeType = 'user_input';
      }
      
      onExecute() {
        eventBus.emit('workflow:user_input_required', {
          node: this.id,
          prompt: this.properties.prompt
        });
        
        // Would pause workflow and wait for input
        this.setOutputData(0, ''); // Placeholder
        this.setOutputData(1, { status: 'waiting_for_input' });
      }
    }
    
    graph.nodeTypes['Workflow.UserInput'] = WorkflowUserInputNode;
  }
  
  static registerNotificationNode(graph, eventBus) {
    class WorkflowNotificationNode extends Node {
      constructor() {
        super('Workflow.Notification');
        this.addInput('flow', 'Flow');
        this.addInput('message', 'str');
        this.addOutput('flow', 'Flow');
        this.properties.channel = 'console'; // or 'email', 'slack', 'webhook'
        this.properties.template = 'Notification: {message}';
        this.size = [220, 100];
        this.isWorkflow = true;
        this.workflowNodeType = 'notification';
      }
      
      onExecute() {
        const message = this.getInputData(1) || 'No message';
        
        eventBus.emit('workflow:notification', {
          node: this.id,
          channel: this.properties.channel,
          message: message
        });
        
        console.log(`[Workflow Notification] ${message}`);
        this.setOutputData(0, { status: 'sent' });
      }
    }
    
    graph.nodeTypes['Workflow.Notification'] = WorkflowNotificationNode;
  }
}

// ========================================================================
// WORKFLOW EXECUTOR
// ========================================================================

class WorkflowExecutor {
  constructor(graph, eventBus) {
    this.graph = graph;
    this.eventBus = eventBus;
    this.executions = new Map();
    this.isExecuting = false;
    this.currentExecutionId = null;
  }
  
  async execute(startNodeId = null) {
    if (this.isExecuting) {
      console.warn('Workflow already executing');
      return null;
    }
    
    // Find start node
    let startNode = startNodeId ? this.graph.getNodeById(startNodeId) : null;
    
    if (!startNode) {
      // Look for Workflow.Start node
      for (const node of this.graph.nodes) {
        if (node.workflowNodeType === 'start') {
          startNode = node;
          break;
        }
      }
    }
    
    if (!startNode) {
      this.eventBus.emit('workflow:error', { error: 'No start node found' });
      return null;
    }
    
    const executionId = 'exec_' + Date.now();
    const execution = {
      id: executionId,
      startTime: Date.now(),
      currentNodes: [startNode],
      completedNodes: new Set(),
      state: {},
      status: 'running'
    };
    
    this.executions.set(executionId, execution);
    this.isExecuting = true;
    this.currentExecutionId = executionId;
    
    this.eventBus.emit('workflow:started', { executionId, startNode: startNode.id });
    
    try {
      await this.executeNodes(execution);
      
      execution.status = 'completed';
      execution.endTime = Date.now();
      
      this.eventBus.emit('workflow:completed', {
        executionId,
        duration: execution.endTime - execution.startTime,
        nodesExecuted: execution.completedNodes.size
      });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      
      this.eventBus.emit('workflow:failed', {
        executionId,
        error: error.message
      });
    } finally {
      this.isExecuting = false;
      this.currentExecutionId = null;
    }
    
    return execution;
  }
  
  async executeNodes(execution) {
    let iteration = 0;
    const maxIterations = 1000;
    
    while (execution.currentNodes.length > 0 && iteration < maxIterations) {
      iteration++;
      
      const nodesToExecute = [...execution.currentNodes];
      execution.currentNodes = [];
      
      for (const node of nodesToExecute) {
        if (execution.completedNodes.has(node.id)) {
          continue;
        }
        
        this.eventBus.emit('workflow:node_executing', {
          executionId: execution.id,
          nodeId: node.id,
          nodeType: node.workflowNodeType
        });
        
        // Execute node
        node.onExecute();
        execution.completedNodes.add(node.id);
        
        // Small delay for visualization
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Find next nodes
        const nextNodes = this.getNextNodes(node);
        execution.currentNodes.push(...nextNodes);
      }
    }
    
    if (iteration >= maxIterations) {
      throw new Error('Workflow exceeded maximum iterations');
    }
  }
  
  getNextNodes(node) {
    const nextNodes = [];
    
    // Find all outgoing links
    for (let i = 0; i < node.outputs.length; i++) {
      const output = node.outputs[i];
      
      for (const linkId of output.links) {
        const link = this.graph.links[linkId];
        if (!link) continue;
        
        const targetNode = this.graph.getNodeById(link.target_id);
        if (!targetNode) continue;
        
        // Don't add end nodes to execution queue
        if (targetNode.workflowNodeType === 'end') {
          this.eventBus.emit('workflow:reached_end', {
            nodeId: targetNode.id
          });
          continue;
        }
        
        nextNodes.push(targetNode);
      }
    }
    
    return nextNodes;
  }
  
  stop() {
    if (this.currentExecutionId) {
      const execution = this.executions.get(this.currentExecutionId);
      if (execution) {
        execution.status = 'cancelled';
        execution.endTime = Date.now();
      }
      
      this.isExecuting = false;
      this.currentExecutionId = null;
      
      this.eventBus.emit('workflow:cancelled', {
        executionId: this.currentExecutionId
      });
    }
  }
}

// ========================================================================
// WORKFLOW MODE EXTENSIONS
// ========================================================================

class WorkflowMode {
  constructor(app) {
    this.app = app;
    this.executor = new WorkflowExecutor(app.graph, app.eventBus);
    this.isWorkflowMode = false;
    
    // Register workflow node types
    WorkflowNodeTypes.register(app.graph, app.eventBus);
    
    // Setup workflow-specific event listeners
    this.setupEventListeners();
    
    console.log('✅ Workflow mode initialized');
  }
  
  setupEventListeners() {
    // Listen to workflow execution events
    this.app.eventBus.on('workflow:started', (data) => {
      console.log('🚀 Workflow started:', data);
      this.app.ui.update.status('Workflow executing...');
    });
    
    this.app.eventBus.on('workflow:completed', (data) => {
      console.log('✅ Workflow completed:', data);
      this.app.ui.update.status(`Workflow completed in ${data.duration}ms (${data.nodesExecuted} nodes)`);
      setTimeout(() => {
        this.app.ui.update.status('Right-click to add nodes.');
      }, 3000);
    });
    
    this.app.eventBus.on('workflow:node_executing', (data) => {
      console.log('⚡ Executing node:', data.nodeType, data.nodeId);
      // Highlight node during execution
      const node = this.app.graph.getNodeById(data.nodeId);
      if (node) {
        this.app.selectNode(node);
        this.app.draw();
      }
    });
    
    this.app.eventBus.on('workflow:failed', (data) => {
      console.error('❌ Workflow failed:', data.error);
      this.app.ui.messages.showError('Workflow failed: ' + data.error);
    });
  }
  
  toggle() {
    this.isWorkflowMode = !this.isWorkflowMode;
    
    if (this.isWorkflowMode) {
      console.log('📊 Entering workflow mode');
      this.app.ui.update.status('Workflow mode enabled');
    } else {
      console.log('📋 Exiting workflow mode');
      this.app.ui.update.status('Right-click to add nodes.');
    }
    
    return this.isWorkflowMode;
  }
  
  async execute() {
    if (this.executor.isExecuting) {
      console.warn('Workflow already executing');
      return;
    }
    
    return await this.executor.execute();
  }
  
  stop() {
    this.executor.stop();
  }
}

// ========================================================================
// EXTEND SCHEMAGRAPHAPP API
// ========================================================================

function extendSchemaGraphAPI(app) {
  console.log('Extending SchemaGraphApp API with workflow capabilities...');
  
  // Add workflow mode instance
  app.workflowMode = new WorkflowMode(app);
  
  // Add workflow API module
  app.api.workflow = {
    /**
     * Toggle workflow mode
     * @returns {boolean} New workflow mode state
     */
    toggleMode: () => {
      return app.workflowMode.toggle();
    },
    
    /**
     * Check if in workflow mode
     * @returns {boolean} Workflow mode state
     */
    isWorkflowMode: () => {
      return app.workflowMode.isWorkflowMode;
    },
    
    /**
     * Execute workflow from start node
     * @param {string} startNodeId - Optional start node ID
     * @returns {Promise} Execution result
     */
    execute: async (startNodeId = null) => {
      return await app.workflowMode.execute(startNodeId);
    },
    
    /**
     * Stop current workflow execution
     * @returns {void}
     */
    stop: () => {
      app.workflowMode.stop();
    },
    
    /**
     * Get workflow node types
     * @returns {string[]} Array of workflow node type names
     */
    getNodeTypes: () => {
      return Object.keys(app.graph.nodeTypes)
        .filter(type => type.startsWith('Workflow.'))
        .map(type => type.replace('Workflow.', ''));
    },
    
    /**
     * Create a workflow node
     * @param {string} type - Node type (without 'Workflow.' prefix)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Node} Created node
     */
    createNode: (type, x = 0, y = 0) => {
      const fullType = type.startsWith('Workflow.') ? type : 'Workflow.' + type;
      return app.api.node.create(fullType, x, y);
    },
    
    /**
     * Create a simple workflow template
     * @returns {void}
     */
    createTemplate: () => {
      // Clear existing nodes
      app.api.graph.clear();
      
      // Create Start node
      const start = app.api.workflow.createNode('Start', 100, 200);
      
      // Create Agent node
      const agent = app.api.workflow.createNode('Agent', 400, 200);
      app.api.node.setProperty(agent, 'agent_id', 0);
      
      // Create End node
      const end = app.api.workflow.createNode('End', 700, 200);
      
      // Connect them
      app.api.link.create(start, 0, agent, 0);
      app.api.link.create(agent, 1, end, 0);
      
      // Center view
      app.api.view.center();
      
      app.ui.update.status('Workflow template created!');
      setTimeout(() => {
        app.ui.update.status('Right-click to add nodes.');
      }, 2000);
    },
    
    /**
     * Validate workflow structure
     * @returns {Object} Validation result {valid, errors}
     */
    validate: () => {
      const errors = [];
      
      // Check for start node
      let hasStart = false;
      let hasEnd = false;
      
      for (const node of app.graph.nodes) {
        if (node.workflowNodeType === 'start') hasStart = true;
        if (node.workflowNodeType === 'end') hasEnd = true;
      }
      
      if (!hasStart) errors.push('Workflow must have a Start node');
      if (!hasEnd) errors.push('Workflow must have at least one End node');
      
      // Check for disconnected nodes
      const connectedNodes = new Set();
      for (const linkId in app.graph.links) {
        const link = app.graph.links[linkId];
        connectedNodes.add(link.origin_id);
        connectedNodes.add(link.target_id);
      }
      
      for (const node of app.graph.nodes) {
        if (!connectedNodes.has(node.id) && node.workflowNodeType !== 'start') {
          errors.push(`Node "${node.title}" is not connected`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    },
    
    /**
     * Export workflow definition
     * @returns {Object} Workflow definition
     */
    export: () => {
      const workflowNodes = app.graph.nodes.filter(n => n.isWorkflow);
      
      return {
        name: 'Exported Workflow',
        version: '1.0.0',
        nodes: workflowNodes.map(n => ({
          id: n.id,
          type: n.workflowNodeType,
          title: n.title,
          position: { x: n.pos[0], y: n.pos[1] },
          properties: n.properties
        })),
        links: Object.values(app.graph.links)
          .filter(l => {
            const source = app.graph.getNodeById(l.origin_id);
            return source && source.isWorkflow;
          })
          .map(l => ({
            id: l.id,
            from: l.origin_id,
            to: l.target_id,
            fromSlot: l.origin_slot,
            toSlot: l.target_slot
          }))
      };
    },
    
    /**
     * Import workflow definition
     * @param {Object} workflow - Workflow definition
     * @returns {boolean} Success status
     */
    import: (workflow) => {
      try {
        app.api.graph.clear();
        
        // Create nodes
        const nodeMap = new Map();
        for (const nodeData of workflow.nodes) {
          const node = app.api.workflow.createNode(
            nodeData.type,
            nodeData.position.x,
            nodeData.position.y
          );
          
          // Restore properties
          if (nodeData.properties) {
            for (const [key, value] of Object.entries(nodeData.properties)) {
              app.api.node.setProperty(node, key, value);
            }
          }
          
          nodeMap.set(nodeData.id, node);
        }
        
        // Create links
        for (const linkData of workflow.links) {
          const sourceNode = nodeMap.get(linkData.from);
          const targetNode = nodeMap.get(linkData.to);
          
          if (sourceNode && targetNode) {
            app.api.link.create(
              sourceNode,
              linkData.fromSlot,
              targetNode,
              linkData.toSlot
            );
          }
        }
        
        app.api.view.center();
        app.ui.update.status('Workflow imported successfully!');
        
        setTimeout(() => {
          app.ui.update.status('Right-click to add nodes.');
        }, 2000);
        
        return true;
      } catch (e) {
        app.ui.messages.showError('Workflow import failed: ' + e.message);
        return false;
      }
    }
  };
  
  // Add workflow help
  if (app.api.help) {
    const originalPrint = app.api.help.print;
    app.api.help.print = (module = null) => {
      if (module === 'workflow') {
        console.log('%c📊 WORKFLOW API', 'color: #46a2da; font-weight: bold; font-size: 14px;');
        console.log('\nMethods:', Object.keys(app.api.workflow).join(', '));
        console.log('\nExamples:');
        console.log('  app.api.workflow.toggleMode() // Enter workflow mode');
        console.log('  app.api.workflow.createTemplate() // Create simple workflow');
        console.log('  app.api.workflow.createNode("Agent", 100, 100) // Add workflow node');
        console.log('  app.api.workflow.validate() // Check workflow structure');
        console.log('  await app.api.workflow.execute() // Run workflow');
        console.log('  app.api.workflow.stop() // Stop execution');
        console.log('  const wf = app.api.workflow.export() // Export workflow');
        console.log('  app.api.workflow.import(wf) // Import workflow');
        console.log('\nAvailable Node Types:');
        console.log('  ' + app.api.workflow.getNodeTypes().join(', '));
      } else {
        originalPrint(module);
        if (!module) {
          console.log('\n  %cworkflow%c - Workflow editor and execution', 'color: #92d050; font-weight: bold;', 'color: inherit;');
          console.log('    ' + Object.keys(app.api.workflow).join(', '));
        }
      }
    };
  }
  
  console.log('✅ Workflow API integrated');
}

// ========================================================================
// AUTO-INITIALIZATION
// ========================================================================

// Hook into SchemaGraphApp initialization
if (typeof SchemaGraphApp !== 'undefined') {
  const originalConstructor = SchemaGraphApp.prototype.constructor;
  
  // We can't directly modify the constructor, so we'll add an init method
  // that should be called after SchemaGraphApp is created
  
  window.initWorkflowExtension = function(app) {
    if (!app || !(app instanceof SchemaGraphApp)) {
      console.error('Invalid SchemaGraphApp instance');
      return false;
    }
    
    if (app.workflowMode) {
      console.log('Workflow extension already initialized');
      return true;
    }
    
    extendSchemaGraphAPI(app);
    console.log('=== SCHEMAGRAPH WORKFLOW EXTENSION READY ===');
    return true;
  };
  
  console.log('✅ Workflow extension loaded. Call initWorkflowExtension(gApp) to activate.');
} else {
  console.error('SchemaGraphApp not found! Load schemagraph.js first.');
}
