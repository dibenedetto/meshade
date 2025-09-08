class NumelGraph {

	static schema = `
from   pydantic        import BaseModel
from   typing          import Any, Dict, List, Optional, Required, Tuple, Union


DEFAULT_SEED                                      : int  = 42

DEFAULT_API_KEY                                   : str  = None

DEFAULT_BACKEND_TYPE                              : str  = "agno"
DEFAULT_BACKEND_VERSION                           : str  = ""

DEFAULT_MODEL_TYPE                                : str  = "ollama"
DEFAULT_MODEL_ID                                  : str  = "mistral"

DEFAULT_EMBEDDING_TYPE                            : str  = "ollama"
DEFAULT_EMBEDDING_ID                              : str  = "mistral"

DEFAULT_KNOWLEDGE_DB_TYPE                         : str  = "lancedb"
DEFAULT_KNOWLEDGE_DB_TABLE_NAME                   : str  = "knowledge"
DEFAULT_KNOWLEDGE_DB_URL                          : str  = "storage/knowledge"
DEFAULT_KNOWLEDGE_DB_SEARCH_TYPE                  : str  = "hybrid"

DEFAULT_KNOWLEDGE_TYPE                            : str  = "knowledge"

DEFAULT_MEMORY_DB_TYPE                            : str  = "sqlite"
DEFAULT_MEMORY_DB_TABLE_NAME                      : str  = "memory"
DEFAULT_MEMORY_DB_URL                             : str  = "storage/memory"

DEFAULT_MEMORY_TYPE                               : str  = "memory"

DEFAULT_STORAGE_DB_TYPE                           : str  = "sqlite"
DEFAULT_STORAGE_DB_TABLE_NAME                     : str  = "session"
DEFAULT_STORAGE_DB_URL                            : str  = "storage/session"

DEFAULT_STORAGE_TYPE                              : str  = "storage"

DEFAULT_OPTIONS_MARKDOWN                          : bool = True
DEFAULT_OPTIONS_SEARCH_KNOWLEDGE                  : bool = True
DEFAULT_OPTIONS_ENABLE_AGENTIC_MEMORY             : bool = True
DEFAULT_OPTIONS_ADD_HISTORY_TO_MESSAGES           : bool = True
DEFAULT_OPTIONS_NUM_HISTORY_RUNS                  : int  = 3
DEFAULT_OPTIONS_ENABLE_SESSION_SUMMARIES          : bool = True
DEFAULT_OPTIONS_SEARCH_PREVIOUS_SESSIONS_HISTORY  : bool = True
DEFAULT_OPTIONS_NUM_HISTORY_SESSIONS              : int  = 2
DEFAULT_OPTIONS_SHOW_TOOL_CALLS                   : bool = True
DEFAULT_OPTIONS_TOOL_CALL_LIMIT                   : int  = 5
DEFAULT_OPTIONS_REASONING                         : bool = True
DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS         : bool = True
DEFAULT_OPTIONS_MAX_WEB_SEARCH_RESULTS            : int  = 5

DEFAULT_APP_PORT                                  : int  = 8000
DEFAULT_APP_RELOAD                                : bool = True


class BackendConfig(BaseModel):
	type    : str = DEFAULT_BACKEND_TYPE
	version : str = DEFAULT_BACKEND_VERSION


class ModelConfig(BaseModel):
	type    : str           = DEFAULT_MODEL_TYPE
	id      : str           = DEFAULT_MODEL_ID
	path    : Optional[str] = None
	wrapper : Optional[str] = None
	version : Optional[str] = None
	name    : Optional[str] = None
	author  : Optional[str] = None
	source  : Optional[str] = None
	data    : Optional[Any] = None


class EmbeddingConfig(BaseModel):
	type    : str           = DEFAULT_EMBEDDING_TYPE
	id      : str           = DEFAULT_EMBEDDING_ID
	path    : Optional[str] = None
	wrapper : Optional[str] = None
	version : Optional[str] = None
	name    : Optional[str] = None
	author  : Optional[str] = None
	source  : Optional[str] = None
	data    : Optional[Any] = None


class KnowledgeDBConfig(BaseModel):
	type        : str           = DEFAULT_KNOWLEDGE_DB_TYPE
	table_name  : str           = DEFAULT_KNOWLEDGE_DB_TABLE_NAME
	db_url      : str           = DEFAULT_KNOWLEDGE_DB_URL
	search_type : str           = DEFAULT_KNOWLEDGE_DB_SEARCH_TYPE
	data        : Optional[Any] = None


class KnowledgeConfig(BaseModel):
	type  : str                                     = DEFAULT_KNOWLEDGE_TYPE
	db    : Optional[Union[KnowledgeDBConfig, int]] = None
	model : Optional[Union[ModelConfig, int]]       = None
	urls  : Optional[List[str]]                     = None
	data  : Optional[Any]                           = None


class MemoryDBConfig(BaseModel):
	type       : str           = DEFAULT_MEMORY_DB_TYPE
	table_name : str           = DEFAULT_MEMORY_DB_TABLE_NAME
	db_url     : str           = DEFAULT_MEMORY_DB_URL
	data       : Optional[Any] = None


class MemoryConfig(BaseModel):
	type       : str                                  = DEFAULT_MEMORY_TYPE
	db         : Optional[Union[MemoryDBConfig, int]] = None
	model      : Optional[Union[ModelConfig, int]]    = None
	summarizer : Optional[Union[ModelConfig, int]]    = None
	data       : Optional[Any]                        = None


class StorageDBConfig(BaseModel):
	type       : str           = DEFAULT_STORAGE_DB_TYPE
	table_name : str           = DEFAULT_STORAGE_DB_TABLE_NAME
	db_url     : str           = DEFAULT_STORAGE_DB_URL
	data       : Optional[Any] = None


class StorageConfig(BaseModel):
	type : str                                   = DEFAULT_STORAGE_TYPE
	db   : Optional[Union[StorageDBConfig, int]] = None
	data : Optional[Any]                         = None


class ToolConfig(BaseModel):
	type : str                      = Required
	args : Optional[Dict[str, Any]] = None
	ref  : Optional[str]            = None
	data : Optional[Any]            = None


class OptionsConfig(BaseModel):
	markdown                         : bool          = DEFAULT_OPTIONS_MARKDOWN
	search_knowledge                 : bool          = DEFAULT_OPTIONS_SEARCH_KNOWLEDGE
	enable_agentic_memory            : bool          = DEFAULT_OPTIONS_ENABLE_AGENTIC_MEMORY
	add_history_to_messages          : bool          = DEFAULT_OPTIONS_ADD_HISTORY_TO_MESSAGES
	num_history_runs                 : int           = DEFAULT_OPTIONS_NUM_HISTORY_RUNS
	enable_session_summaries         : bool          = DEFAULT_OPTIONS_ENABLE_SESSION_SUMMARIES
	search_previous_sessions_history : bool          = DEFAULT_OPTIONS_SEARCH_PREVIOUS_SESSIONS_HISTORY
	num_history_sessions             : int           = DEFAULT_OPTIONS_NUM_HISTORY_SESSIONS
	show_tool_calls                  : bool          = DEFAULT_OPTIONS_SHOW_TOOL_CALLS
	tool_call_limit                  : int           = DEFAULT_OPTIONS_TOOL_CALL_LIMIT
	reasoning                        : bool          = DEFAULT_OPTIONS_REASONING
	stream_intermediate_steps        : bool          = DEFAULT_OPTIONS_STREAM_INTERMEDIATE_STEPS
	data                             : Optional[Any] = None


class AgentConfig(BaseModel):
	backend      : Optional[Union[BackendConfig, int]]         = None
	model        : Optional[Union[ModelConfig, int]]           = None
	embedding    : Optional[Union[EmbeddingConfig, int]]       = None
	options      : Optional[Union[OptionsConfig, int]]         = None
	version      : Optional[str]                               = None
	name         : Optional[str]                               = None
	author       : Optional[str]                               = None
	port         : Optional[int]                               = None
	description  : Optional[str]                               = None
	instructions : Optional[List[str]]                         = None
	knowledge    : Optional[List[Union[KnowledgeConfig, int]]] = None
	memory       : Optional[Union[MemoryConfig, int]]          = None
	storage      : Optional[Union[StorageConfig, int]]         = None
	tools        : Optional[List[ToolConfig]]                  = None
	data         : Optional[Any]                               = None


class AppConfig(BaseModel):
	port          : int                                 = DEFAULT_APP_PORT
	reload        : bool                                = DEFAULT_APP_RELOAD
	backend       : Optional[Union[BackendConfig, int]] = None
	version       : Optional[str]                       = None
	name          : Optional[str]                       = None
	author        : Optional[str]                       = None
	description   : Optional[str]                       = None
	backends      : Optional[List[BackendConfig]]       = None
	models        : Optional[List[ModelConfig]]         = None
	embeddings    : Optional[List[EmbeddingConfig]]     = None
	knowledge_dbs : Optional[List[KnowledgeDBConfig]]   = None
	knowledges    : Optional[List[KnowledgeConfig]]     = None
	memory_dbs    : Optional[List[MemoryDBConfig]]      = None
	memories      : Optional[List[MemoryConfig]]        = None
	storage_dbs   : Optional[List[StorageDBConfig]]     = None
	storages      : Optional[List[StorageConfig]]       = None
	options       : Optional[List[OptionsConfig]]       = None
	agents        : Optional[List[AgentConfig]]         = None
	seed          : Optional[int]                       = None
	data          : Optional[Any]                       = None
	`;

	constructor(canvasId) {
		const graph  = new LGraph();
		const canvas = new LGraphCanvas("#" + canvasId, graph);

		canvas.resize();
		canvas.ds.scale             = 1.0;
		canvas.allow_dragcanvas     = true;
		canvas.allow_dragnodes      = true;
		canvas.render_connections   = true;
		canvas.render_shadows       = true;
		canvas.use_gradients        = true;
		canvas.node_title_color     = "#ffffff";
		canvas.render_canvas_border = false;

		graph.start();

		const that = this;

		this.canvasId = canvasId;
		this.canvas   = canvas;
		this.graph    = graph;
		this.models   = that._parseSchema(NumelGraph.schema);
		this.currentConfig = null;

		// Store reference to original menu function
		this._originalGetCanvasMenuOptions = this.canvas.getCanvasMenuOptions;

		// Add layout controls to right-click menu
		this.addLayoutControls();

		window.addEventListener("resize", () => canvas.resize());
	}

	// Simple schema parser
	_parseSchema(input) {
		const that = this;

		input = input.trim();
		const models = that._parseSchemaText(input);
		that._generateNodes(models);
		return models;
	}

	// Parse schema text into structured data
	_parseSchemaText(text) {
		const that = this;

		const models = {};
		const constants = {};
		const lines = text.split('\n');
		let currentModel = null;
		let inClass = false;

		// First pass - collect constants and model names
		for (let line of lines) {
			line = line.trim();
			if (line.startsWith('#') || line.startsWith('from ') || line.startsWith('import ')) continue;

			// Parse constants
			const constantMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
			if (constantMatch && !inClass) {
				constants[constantMatch[1]] = that._parseConstantValue(constantMatch[2]);
			}

			// Collect model names
			const classMatch = line.match(/^class\s+(\w+)\s*\([^)]*BaseModel[^)]*\):/);
			if (classMatch) {
				models[classMatch[1]] = { fields: {}, relationships: [], constants: constants };
			}
		}

		// Second pass - parse fields and relationships
		inClass = false;
		currentModel = null;

		for (let line of lines) {
			line = line.trim();
			if (line.startsWith('#') || line.startsWith('from ') || line.startsWith('import ')) continue;

			// Class definition
			const classMatch = line.match(/^class\s+(\w+)\s*\([^)]*BaseModel[^)]*\):/);
			if (classMatch) {
				currentModel = classMatch[1];
				inClass = true;
				continue;
			}

			// Field definition
			if (inClass && currentModel && line.includes(':') && !line.startsWith('def ')) {
				const field = that._parseField(models, line, constants);
				if (field) {
					models[currentModel].fields[field.name] = field;

					// Add relationship if this field references another model
					if (field.isReference && field.referenceType) {
						models[currentModel].relationships.push({
							field: field.name,
							target: field.referenceType,
							isOptional: field.isOptional,
							isList: field.isList
						});
					}
				}
			}

			// End of class
			if (inClass && (line === '' || line.startsWith('class '))) {
				if (line.startsWith('class ')) {
					const classMatch = line.match(/^class\s+(\w+)\s*\([^)]*BaseModel[^)]*\):/);
					if (classMatch) {
						currentModel = classMatch[1];
					}
				} else {
					inClass = false;
					currentModel = null;
				}
			}
		}

		return models;
	}

	// Parse individual field
	_parseField(models, line, constants = {}) {
		const that = this;

		// Handle various field patterns
		const patterns = [
			/(\w+)\s*:\s*(Optional\[([^\]]+)\])\s*=\s*(.+)/, // name: Optional[type] = default
			/(\w+)\s*:\s*(List\[([^\]]+)\])\s*=\s*(.+)/, // name: List[type] = default  
			/(\w+)\s*:\s*(Union\[([^\]]+)\])\s*=\s*(.+)/, // name: Union[types] = default
			/(\w+)\s*:\s*(\w+)\s*=\s*(.+)/, // name: type = default
			/(\w+)\s*:\s*(Optional\[([^\]]+)\])/, // name: Optional[type] (no default)
			/(\w+)\s*:\s*(List\[([^\]]+)\])/, // name: List[type] (no default)
			/(\w+)\s*:\s*(\w+)/, // name: type (no default)
		];

		for (let pattern of patterns) {
			const match = line.match(pattern);
			if (match) {
				const name = match[1];
				const typeStr = match[2];
				let defaultValue = match[4] || match[3] || '';

				// For patterns with inner type (Optional[Type], List[Type])
				const innerType = match[3];

				// Resolve constant references
				if (defaultValue && constants[defaultValue]) {
					defaultValue = constants[defaultValue];
				}

				const isRef = that._isModelReference(models, typeStr);
				const refType = that._extractReferenceType(models, typeStr);

				return {
					name,
					type: that._extractBaseType(typeStr),
					originalType: typeStr,
					innerType: innerType,
					default: that._parseDefault(defaultValue),
					isOptional: typeStr.includes('Optional') || defaultValue === 'None',
					isList: typeStr.includes('List'),
					isUnion: typeStr.includes('Union'),
					isReference: isRef,
					referenceType: refType,
					usesConstant: constants.hasOwnProperty(defaultValue)
				};
			}
		}
		return null;
	}

	// Helper functions
	_extractBaseType(typeStr) {
		const that = this;

		if (typeStr.includes('str')) return 'string';
		if (typeStr.includes('int')) return 'number';
		if (typeStr.includes('float')) return 'number';
		if (typeStr.includes('bool')) return 'boolean';
		if (typeStr.includes('List')) return 'array';
		return 'string'; // default
	}

	_parseDefault(defaultStr) {
		const that = this;

		if (!defaultStr || defaultStr === 'None') return '';
		if (defaultStr.startsWith('"') || defaultStr.startsWith("'")) {
			return defaultStr.slice(1, -1); // Remove quotes
		}
		if (defaultStr.startsWith('[') && defaultStr.endsWith(']')) {
			// Handle list defaults
			try {
				return defaultStr.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, '')).join(', ');
			} catch (e) {
				return defaultStr;
			}
		}
		return defaultStr;
	}

	_parseConstantValue(valueStr) {
		const that = this;

		valueStr = valueStr.trim();

		// String values
		if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
			return valueStr.slice(1, -1);
		}

		// List values
		if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
			try {
				return valueStr.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
			} catch (e) {
				return valueStr;
			}
		}

		// Numeric values
		if (!isNaN(valueStr)) {
			return valueStr.includes('.') ? parseFloat(valueStr) : parseInt(valueStr);
		}

		// Boolean values
		if (valueStr === 'True') return true;
		if (valueStr === 'False') return false;

		return valueStr;
	}

	_isModelReference(models, typeStr) {
		const that = this;

		// Check if type string contains any model names from the current schema
		if (!models || Object.keys(models).length === 0) return false;

		const modelNames = Object.keys(models);
		return modelNames.some(name => {
			// Check for direct reference: ModelName
			if (typeStr.includes(name)) return true;
			// Check for Optional reference: Optional[ModelName]
			if (typeStr.includes(`Optional[${name}]`)) return true;
			// Check for Union reference: Union[ModelName, int]
			if (typeStr.includes(`Union[`) && typeStr.includes(name)) return true;
			// Check for List reference: List[ModelName]
			if (typeStr.includes(`List[${name}]`)) return true;
			return false;
		});
	}

	_extractReferenceType(models, typeStr) {
		const that = this;

		if (!models || Object.keys(models).length === 0) return null;

		const modelNames = Object.keys(models);
		for (let name of modelNames) {
			// Direct reference
			if (typeStr === name) return name;
			// Optional reference
			if (typeStr === `Optional[${name}]`) return name;
			// List reference
			if (typeStr === `List[${name}]`) return name;
			// Union reference (get first model found)
			if (typeStr.includes(`Union[`) && typeStr.includes(name)) return name;
			// Complex nested patterns
			if (typeStr.includes(name) && (
				typeStr.includes('[') || 
				typeStr.includes('Optional') || 
				typeStr.includes('List') ||
				typeStr.includes('Union')
			)) {
				return name;
			}
		}
		return null;
	}

	// Generate LiteGraph node classes
	_generateNodes(models) {
		const that = this;

		// Clear existing nodes
		Object.keys(LiteGraph.registered_node_types).forEach(key => {
			if (key.startsWith('schema/')) {
				delete LiteGraph.registered_node_types[key];
			}
		});

		Object.entries(models).forEach(([modelName, model]) => {
			that._createNodeClass(modelName, model);
		});
	}

	// Create a LiteGraph node class from schema
	_createNodeClass(modelName, model) {
		const that = this;

		class SchemaNode extends LGraphNode {
			constructor() {
				super();
				this.title = modelName;
				this.color = that._getColorForModel(modelName);
				this.size = [400, Math.max(120, Object.keys(model.fields).length * 35 + model.relationships.length * 30 + 100)];
				this.resizable = false;

				// Store model info for validation
				this._modelName = modelName;
				this._modelSchema = model;
				this._graphInstance = that;

				// Add inputs for relationships FIRST
				model.relationships.forEach(rel => {
					this.addInput(rel.field, rel.target);
				});

				// Add properties for non-relationship fields
				Object.entries(model.fields).forEach(([fieldName, field]) => {
					if (!field.isReference) {
						this.addProperty(fieldName, field);
					}
				});

				// Add output
				this.addOutput(modelName.toLowerCase(), modelName);

				// Initialize properties
				this.properties = this.properties || {};

				// Store original widget functionality
				this._originalWidgets = [];
			}

			addProperty(fieldName, field) {
				this.properties = this.properties || {};
				let defaultValue = field.default || '';
				this.properties[fieldName] = defaultValue;

				// Truncate field name if too long for display
				let displayName = fieldName;
				if (fieldName.length > 12) {
					displayName = fieldName.substring(0, 10) + '..';
				}

				if (field.type === 'boolean') {
					const boolValue = defaultValue === true || defaultValue === 'True' || defaultValue === 'true';
					this.addWidget("toggle", displayName, boolValue, (v) => {
						this.properties[fieldName] = v;
					});
				} else if (field.type === 'number') {
					const numValue = parseFloat(defaultValue) || 0;
					this.addWidget("number", displayName, numValue, (v) => {
						this.properties[fieldName] = v;
					});
				} else {
					// For text fields, show truncated value but allow full editing
					let displayValue = String(defaultValue);
					if (displayValue.length > 20) {
						displayValue = displayValue.substring(0, 17) + '...';
					}

					const widget = this.addWidget("text", displayName, displayValue, (v) => {
						this.properties[fieldName] = v;
					});

					// Store original value and field name for reference
					if (widget) {
						widget._originalFieldName = fieldName;
						widget._originalValue = defaultValue;

						// Override the widget's value getter/setter to handle full values
						const originalValue = widget.value;
						Object.defineProperty(widget, 'value', {
							get: function() {
								return this._currentValue !== undefined ? this._currentValue : originalValue;
							},
							set: function(val) {
								this._currentValue = val;
								// Update the actual property with full value
								if (this.node && this.node.properties) {
									this.node.properties[this._originalFieldName] = val;
								}
							}
						});

						// Set initial value
						widget.value = defaultValue;
					}
				}
			}

			onExecute() {
				const config = { ...this.properties };

				// Add connected relationship inputs
				if (this.inputs) {
					this.inputs.forEach((input, index) => {
						const data = this.getInputData(index);
						if (data) {
							config[input.name] = data;
						}
					});
				}

				// Clean up empty values
				Object.keys(config).forEach(key => {
					if (config[key] === '' || config[key] === null) {
						delete config[key];
					}
				});

				this.setOutputData(0, config);
			}


			// Handle connection changes (simplified)
			onConnectionsChange(type, slotIndex, isConnected, linkInfo, inputInfo) {
				// Notify graph instance of connection changes for config sync
				if (this._graphInstance && this._graphInstance._onConnectionChanged) {
					setTimeout(() => {
						this._graphInstance._onConnectionChanged(this, type, slotIndex, isConnected, linkInfo, inputInfo);
					}, 10); // Small delay to ensure connection is processed
				}
			}
		}

		LiteGraph.registerNodeType(`schema/${modelName}`, SchemaNode);
	}

	// Utility functions
	_getColorForModel(modelName) {
		const that = this;

		const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
		const hash = modelName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
		return colors[hash % colors.length];
	}

	// Add node to graph
	add(modelName) {
		const node = LiteGraph.createNode(`schema/${modelName}`);
		// node.pos = [Math.random() * 300, Math.random() * 300];
		node.pos = [100, 100];
		this.graph.add(node);
		return node;
	}

	// Build graph from AppConfig object
	buildFromConfig(appConfig) {
		const that = this;
		this.clear();
		
		// Store current config for sync operations
		this.currentConfig = JSON.parse(JSON.stringify(appConfig)); // Deep copy
		
		// Enable interactive connections (use LiteGraph standard properties)
		this.canvas.allow_reconnect_links = true;
		this.canvas.connections_width = 3;
		
		const nodeMap = new Map(); // Track created nodes by their config data
		const inlineNodes = new Map(); // Track inline config objects
		let yOffset = 50;
		const xSpacing = 450;
		let currentX = 50;

		// Create main AppConfig node
		const appNode = this.add('AppConfig');
		appNode.pos = [currentX, yOffset];
		that._populateNodeFromConfig(appNode, appConfig);
		nodeMap.set('AppConfig', appNode);
		currentX += xSpacing;

		// Create referenced config nodes
		const configTypes = [
			{ key: 'backend', type: 'BackendConfig' },
			{ key: 'backends', type: 'BackendConfig', isList: true },
			{ key: 'models', type: 'ModelConfig', isList: true },
			{ key: 'embeddings', type: 'EmbeddingConfig', isList: true },
			{ key: 'knowledge_dbs', type: 'KnowledgeDBConfig', isList: true },
			{ key: 'knowledges', type: 'KnowledgeConfig', isList: true },
			{ key: 'memory_dbs', type: 'MemoryDBConfig', isList: true },
			{ key: 'memories', type: 'MemoryConfig', isList: true },
			{ key: 'storage_dbs', type: 'StorageDBConfig', isList: true },
			{ key: 'storages', type: 'StorageConfig', isList: true },
			{ key: 'options', type: 'OptionsConfig', isList: true },
			{ key: 'agents', type: 'AgentConfig', isList: true }
		];

		configTypes.forEach(({ key, type, isList }) => {
			const configData = appConfig[key];
			if (!configData) return;

			if (isList && Array.isArray(configData)) {
				let localY = yOffset;
				configData.forEach((item, index) => {
					const node = this.add(type);
					node.pos = [currentX, localY];
					that._populateNodeFromConfig(node, item);
					nodeMap.set(`${key}[${index}]`, node);
					
					// Connect to main app node if there's a corresponding input
					that._connectNodes(appNode, node, key);
					localY += 200;
				});
				currentX += xSpacing;
			} else if (!isList && typeof configData === 'object') {
				const node = this.add(type);
				node.pos = [currentX, yOffset];
				that._populateNodeFromConfig(node, configData);
				nodeMap.set(key, node);
				
				// Connect to main app node
				that._connectNodes(appNode, node, key);
				currentX += xSpacing;
			}
		});

		// Create nodes for inline config objects found within other configs
		that._createInlineNodes(nodeMap, inlineNodes, appConfig, currentX, yOffset, xSpacing);

		// Handle nested relationships (like AgentConfig -> ModelConfig)
		that._connectNestedReferences(nodeMap, inlineNodes, appConfig);
		
		setTimeout(() => {
			// Use hierarchical layout by default for config graphs
			that.layoutGraph('hierarchical', {
				direction: 'LR',  // Left to right
				layerSpacing: 450,  // Match your existing xSpacing
				nodeSpacing: 200,
				alignLayers: true
			});
		}, 100);  // Small delay to ensure all nodes are rendered

		return nodeMap;
	}

	// Create nodes for inline config objects found within other configs
	_createInlineNodes(nodeMap, inlineNodes, appConfig, startX, startY, xSpacing) {
		const that = this;
		let currentX = startX;
		let inlineCount = 0;

		// Helper function to create inline node
		const createInlineNode = (configObj, type, parentKey, parentIndex) => {
			const node = this.add(type);
			node.pos = [currentX, startY + (inlineCount * 150)];
			that._populateNodeFromConfig(node, configObj);
			const nodeKey = `inline_${type}_${parentKey}_${parentIndex}_${inlineCount}`;
			inlineNodes.set(nodeKey, node);
			inlineCount++;
			return { node, nodeKey };
		};

		// Scan through agents for inline configs
		if (appConfig.agents) {
			appConfig.agents.forEach((agent, agentIndex) => {
				// Check for inline model config
				if (agent.model && typeof agent.model === 'object' && !Array.isArray(agent.model)) {
					const { node, nodeKey } = createInlineNode(agent.model, 'ModelConfig', 'agents', agentIndex);
					inlineNodes.set(`model_for_agent_${agentIndex}`, node);
				}

				// Check for inline embedding config
				if (agent.embedding && typeof agent.embedding === 'object' && !Array.isArray(agent.embedding)) {
					const { node, nodeKey } = createInlineNode(agent.embedding, 'EmbeddingConfig', 'agents', agentIndex);
					inlineNodes.set(`embedding_for_agent_${agentIndex}`, node);
				}

				// Check for inline memory config
				if (agent.memory && typeof agent.memory === 'object' && !Array.isArray(agent.memory)) {
					const { node, nodeKey } = createInlineNode(agent.memory, 'MemoryConfig', 'agents', agentIndex);
					inlineNodes.set(`memory_for_agent_${agentIndex}`, node);
				}

				// Check for inline storage config
				if (agent.storage && typeof agent.storage === 'object' && !Array.isArray(agent.storage)) {
					const { node, nodeKey } = createInlineNode(agent.storage, 'StorageConfig', 'agents', agentIndex);
					inlineNodes.set(`storage_for_agent_${agentIndex}`, node);
				}

				// Check for inline options config
				if (agent.options && typeof agent.options === 'object' && !Array.isArray(agent.options)) {
					const { node, nodeKey } = createInlineNode(agent.options, 'OptionsConfig', 'agents', agentIndex);
					inlineNodes.set(`options_for_agent_${agentIndex}`, node);
				}

				// Check for inline knowledge configs
				if (agent.knowledge && Array.isArray(agent.knowledge)) {
					agent.knowledge.forEach((knowledgeItem, knowledgeIndex) => {
						if (typeof knowledgeItem === 'object' && !Array.isArray(knowledgeItem)) {
							const { node, nodeKey } = createInlineNode(knowledgeItem, 'KnowledgeConfig', 'agents', agentIndex);
							inlineNodes.set(`knowledge_${knowledgeIndex}_for_agent_${agentIndex}`, node);
						}
					});
				}
			});
		}

		// Scan through memories for inline db configs
		if (appConfig.memories) {
			appConfig.memories.forEach((memory, memoryIndex) => {
				if (memory.db && typeof memory.db === 'object' && !Array.isArray(memory.db)) {
					const { node, nodeKey } = createInlineNode(memory.db, 'MemoryDBConfig', 'memories', memoryIndex);
					inlineNodes.set(`db_for_memory_${memoryIndex}`, node);
				}
			});
		}

		// Scan through knowledges for inline db configs
		if (appConfig.knowledges) {
			appConfig.knowledges.forEach((knowledge, knowledgeIndex) => {
				if (knowledge.db && typeof knowledge.db === 'object' && !Array.isArray(knowledge.db)) {
					const { node, nodeKey } = createInlineNode(knowledge.db, 'KnowledgeDBConfig', 'knowledges', knowledgeIndex);
					inlineNodes.set(`db_for_knowledge_${knowledgeIndex}`, node);
				}
			});
		}

		// Scan through storages for inline db configs
		if (appConfig.storages) {
			appConfig.storages.forEach((storage, storageIndex) => {
				if (storage.db && typeof storage.db === 'object' && !Array.isArray(storage.db)) {
					const { node, nodeKey } = createInlineNode(storage.db, 'StorageDBConfig', 'storages', storageIndex);
					inlineNodes.set(`db_for_storage_${storageIndex}`, node);
				}
			});
		}
	}

	// Populate node properties from config object
	_populateNodeFromConfig(node, config) {
		if (!config || !node.properties) return;

		Object.entries(config).forEach(([key, value]) => {
			if (node.properties.hasOwnProperty(key) && value !== null && value !== undefined) {
				// Handle different value types
				if (typeof value === 'object' && !Array.isArray(value)) {
					// Skip nested objects - they should be separate nodes
					return;
				} else if (Array.isArray(value)) {
					// Convert arrays to comma-separated strings for display
					node.properties[key] = value.join(', ');
				} else {
					node.properties[key] = value;
				}

				// Update corresponding widget if exists
				if (node.widgets) {
					const widget = node.widgets.find(w => w._originalFieldName === key || w.name === key);
					if (widget) {
						widget.value = node.properties[key];
					}
				}
			}
		});
	}

	// Connect two nodes
	_connectNodes(sourceNode, targetNode, inputName) {
		if (!sourceNode.inputs || !targetNode.outputs) return;
		
		const inputSlot = sourceNode.inputs.findIndex(input => input.name === inputName);
		const outputSlot = 0; // Assuming first output slot
		
		if (inputSlot >= 0 && targetNode.outputs.length > 0) {
			targetNode.connect(outputSlot, sourceNode, inputSlot);
		}
	}

	// Handle nested references like AgentConfig -> ModelConfig
	_connectNestedReferences(nodeMap, inlineNodes, appConfig) {
		const that = this;
		
		// Handle agent references to models, embeddings, etc.
		if (appConfig.agents) {
			appConfig.agents.forEach((agent, agentIndex) => {
				const agentNode = nodeMap.get(`agents[${agentIndex}]`);
				if (!agentNode) return;

				// Connect model reference (index or inline object)
				if (typeof agent.model === 'number' && appConfig.models && appConfig.models[agent.model]) {
					const modelNode = nodeMap.get(`models[${agent.model}]`);
					if (modelNode) {
						that._connectNodes(agentNode, modelNode, 'model');
					}
				} else if (typeof agent.model === 'object' && agent.model !== null) {
					const inlineModelNode = inlineNodes.get(`model_for_agent_${agentIndex}`);
					if (inlineModelNode) {
						that._connectNodes(agentNode, inlineModelNode, 'model');
					}
				}

				// Connect embedding reference (index or inline object)
				if (typeof agent.embedding === 'number' && appConfig.embeddings && appConfig.embeddings[agent.embedding]) {
					const embeddingNode = nodeMap.get(`embeddings[${agent.embedding}]`);
					if (embeddingNode) {
						that._connectNodes(agentNode, embeddingNode, 'embedding');
					}
				} else if (typeof agent.embedding === 'object' && agent.embedding !== null) {
					const inlineEmbeddingNode = inlineNodes.get(`embedding_for_agent_${agentIndex}`);
					if (inlineEmbeddingNode) {
						that._connectNodes(agentNode, inlineEmbeddingNode, 'embedding');
					}
				}

				// Connect other references (memory, storage, backend, options)
				const refTypes = ['memory', 'storage', 'backend', 'options'];
				refTypes.forEach(refType => {
					if (typeof agent[refType] === 'number') {
						const refKey = refType === 'backend' ? 'backends' : `${refType}s`;
						const refArray = appConfig[refKey];
						if (refArray && refArray[agent[refType]]) {
							const refNode = nodeMap.get(`${refKey}[${agent[refType]}]`);
							if (refNode) {
								that._connectNodes(agentNode, refNode, refType);
							}
						}
					} else if (typeof agent[refType] === 'object' && agent[refType] !== null) {
						const inlineRefNode = inlineNodes.get(`${refType}_for_agent_${agentIndex}`);
						if (inlineRefNode) {
							that._connectNodes(agentNode, inlineRefNode, refType);
						}
					}
				});

				// Handle knowledge references (array of indices or objects)
				if (agent.knowledge && Array.isArray(agent.knowledge)) {
					agent.knowledge.forEach((knowledgeRef, knowledgeIndex) => {
						if (typeof knowledgeRef === 'number' && appConfig.knowledges && appConfig.knowledges[knowledgeRef]) {
							const knowledgeNode = nodeMap.get(`knowledges[${knowledgeRef}]`);
							if (knowledgeNode) {
								that._connectNodes(agentNode, knowledgeNode, 'knowledge');
							}
						} else if (typeof knowledgeRef === 'object' && knowledgeRef !== null) {
							const inlineKnowledgeNode = inlineNodes.get(`knowledge_${knowledgeIndex}_for_agent_${agentIndex}`);
							if (inlineKnowledgeNode) {
								that._connectNodes(agentNode, inlineKnowledgeNode, 'knowledge');
							}
						}
					});
				}
			});
		}

		// Handle memory config references to memory_dbs
		if (appConfig.memories) {
			appConfig.memories.forEach((memory, memoryIndex) => {
				const memoryNode = nodeMap.get(`memories[${memoryIndex}]`);
				if (!memoryNode) return;

				// Connect db reference (index or inline object)
				if (typeof memory.db === 'number' && appConfig.memory_dbs && appConfig.memory_dbs[memory.db]) {
					const dbNode = nodeMap.get(`memory_dbs[${memory.db}]`);
					if (dbNode) {
						that._connectNodes(memoryNode, dbNode, 'db');
					}
				} else if (typeof memory.db === 'object' && memory.db !== null) {
					const inlineDbNode = inlineNodes.get(`db_for_memory_${memoryIndex}`);
					if (inlineDbNode) {
						that._connectNodes(memoryNode, inlineDbNode, 'db');
					}
				}

				// Connect model and summarizer references (index only for now)
				['model', 'summarizer'].forEach(refType => {
					if (typeof memory[refType] === 'number' && appConfig.models && appConfig.models[memory[refType]]) {
						const modelNode = nodeMap.get(`models[${memory[refType]}]`);
						if (modelNode) {
							that._connectNodes(memoryNode, modelNode, refType);
						}
					}
				});
			});
		}

		// Handle knowledge config references to knowledge_dbs and models
		if (appConfig.knowledges) {
			appConfig.knowledges.forEach((knowledge, knowledgeIndex) => {
				const knowledgeNode = nodeMap.get(`knowledges[${knowledgeIndex}]`);
				if (!knowledgeNode) return;

				// Connect db reference (index or inline object)
				if (typeof knowledge.db === 'number' && appConfig.knowledge_dbs && appConfig.knowledge_dbs[knowledge.db]) {
					const dbNode = nodeMap.get(`knowledge_dbs[${knowledge.db}]`);
					if (dbNode) {
						that._connectNodes(knowledgeNode, dbNode, 'db');
					}
				} else if (typeof knowledge.db === 'object' && knowledge.db !== null) {
					const inlineDbNode = inlineNodes.get(`db_for_knowledge_${knowledgeIndex}`);
					if (inlineDbNode) {
						that._connectNodes(knowledgeNode, inlineDbNode, 'db');
					}
				}

				// Connect model reference (index only for now)
				if (typeof knowledge.model === 'number' && appConfig.models && appConfig.models[knowledge.model]) {
					const modelNode = nodeMap.get(`models[${knowledge.model}]`);
					if (modelNode) {
						that._connectNodes(knowledgeNode, modelNode, 'model');
					}
				}
			});
		}

		// Handle storage config references to storage_dbs
		if (appConfig.storages) {
			appConfig.storages.forEach((storage, storageIndex) => {
				const storageNode = nodeMap.get(`storages[${storageIndex}]`);
				if (!storageNode) return;

				// Connect db reference (index or inline object)
				if (typeof storage.db === 'number' && appConfig.storage_dbs && appConfig.storage_dbs[storage.db]) {
					const dbNode = nodeMap.get(`storage_dbs[${storage.db}]`);
					if (dbNode) {
						that._connectNodes(storageNode, dbNode, 'db');
					}
				} else if (typeof storage.db === 'object' && storage.db !== null) {
					const inlineDbNode = inlineNodes.get(`db_for_storage_${storageIndex}`);
					if (inlineDbNode) {
						that._connectNodes(storageNode, inlineDbNode, 'db');
					}
				}
			});
		}
	}

	clear() {
		this.graph.clear();
		this.currentConfig = null;
	}

	// Add new node of specified type
	addNewNode(nodeType, position) {
		const node = this.add(nodeType);
		if (position) {
			node.pos = [position.x || 100, position.y || 100];
		} else {
			node.pos = [100 + Math.random() * 200, 100 + Math.random() * 200];
		}

		// Add to current config if exists
		if (this.currentConfig) {
			this._addNodeToConfig(node);
		}

		return node;
	}

	// Add a node to the current configuration
	_addNodeToConfig(node) {
		if (!this.currentConfig || !node._modelName) return;

		const arrayKeys = {
			'AgentConfig': 'agents',
			'ModelConfig': 'models',
			'EmbeddingConfig': 'embeddings',
			'MemoryConfig': 'memories', 
			'KnowledgeConfig': 'knowledges',
			'StorageConfig': 'storages',
			'BackendConfig': 'backends',
			'OptionsConfig': 'options',
			'MemoryDBConfig': 'memory_dbs',
			'KnowledgeDBConfig': 'knowledge_dbs',
			'StorageDBConfig': 'storage_dbs'
		};

		const arrayKey = arrayKeys[node._modelName];
		if (arrayKey) {
			if (!this.currentConfig[arrayKey]) {
				this.currentConfig[arrayKey] = [];
			}

			// Create new config object from node properties
			const newConfig = { ...node.properties };
			this.currentConfig[arrayKey].push(newConfig);
		}
	}

	// Remove node and update config
	removeNode(node) {
		if (this.currentConfig && node._modelName) {
			this._removeNodeFromConfig(node);
		}
		this.graph.remove(node);
	}

	// Remove node from configuration
	_removeNodeFromConfig(node) {
		const arrayKeys = {
			'AgentConfig': 'agents',
			'ModelConfig': 'models',
			'EmbeddingConfig': 'embeddings', 
			'MemoryConfig': 'memories',
			'KnowledgeConfig': 'knowledges',
			'StorageConfig': 'storages',
			'BackendConfig': 'backends',
			'OptionsConfig': 'options',
			'MemoryDBConfig': 'memory_dbs',
			'KnowledgeDBConfig': 'knowledge_dbs',
			'StorageDBConfig': 'storage_dbs'
		};

		const arrayKey = arrayKeys[node._modelName];
		if (arrayKey && this.currentConfig[arrayKey]) {
			const index = this.currentConfig[arrayKey].findIndex(item => 
				this._nodeMatchesConfig(node, item)
			);
			if (index >= 0) {
				this.currentConfig[arrayKey].splice(index, 1);
			}
		}
	}

	// Get current configuration with live updates
	getCurrentConfig() {
		this._syncConfigFromGraph();
		return this.currentConfig;
	}

	// Handle connection changes for config synchronization
	_onConnectionChanged(node, type, slotIndex, isConnected, linkInfo, inputInfo) {
		// Update the underlying configuration data
		if (this.currentConfig) {
			this._syncConfigFromGraph();
		}
	}

	// Check if connection is compatible based on schema
	_isCompatibleConnection(outputNodeType, inputNodeType, inputName) {
		const compatibility = {
			'ModelConfig': ['model', 'summarizer'],
			'EmbeddingConfig': ['embedding'],
			'BackendConfig': ['backend'],
			'MemoryDBConfig': ['db'],
			'KnowledgeDBConfig': ['db'],
			'StorageDBConfig': ['db'],
			'MemoryConfig': ['memory'],
			'KnowledgeConfig': ['knowledge'],
			'StorageConfig': ['storage'],
			'OptionsConfig': ['options'],
			'AgentConfig': ['agents']
		};

		const allowedInputs = compatibility[outputNodeType] || [];
		return allowedInputs.includes(inputName) || allowedInputs.some(allowed => inputName.includes(allowed));
	}

	// Sync configuration object from current graph state
	_syncConfigFromGraph() {
		if (!this.currentConfig) return;

		const that = this;
		const updatedConfig = { ...this.currentConfig };

		// Clear existing array references
		['agents', 'models', 'embeddings', 'memories', 'knowledges', 'storages', 
		 'backends', 'options', 'memory_dbs', 'knowledge_dbs', 'storage_dbs'].forEach(key => {
			if (updatedConfig[key]) {
				updatedConfig[key].forEach((item, index) => {
					if (typeof item === 'object') {
						// Reset reference fields to be updated from connections
						Object.keys(item).forEach(fieldKey => {
							if (that._isReferenceField(fieldKey)) {
								delete item[fieldKey];
							}
						});
					}
				});
			}
		});

		// Rebuild references from graph connections
		this.graph._nodes.forEach(node => {
			if (!node._modelName) return;

			// Update connections for this node
			if (node.inputs) {
				node.inputs.forEach((input, inputIndex) => {
					const link = input.link;
					if (link) {
						const sourceNode = node.graph.getNodeById(link.origin_id);
						if (sourceNode && sourceNode._modelName) {
							that._updateConfigReference(updatedConfig, node, input.name, sourceNode);
						}
					}
				});
			}
		});

		this.currentConfig = updatedConfig;
		
		// Trigger config change event if needed
		if (this.onConfigChanged) {
			this.onConfigChanged(updatedConfig);
		}
	}

	// Check if a field is a reference field
	_isReferenceField(fieldName) {
		const referenceFields = ['model', 'embedding', 'backend', 'memory', 'storage', 
								'knowledge', 'options', 'db', 'summarizer'];
		return referenceFields.includes(fieldName) || fieldName.endsWith('_id');
	}

	// Update config reference based on connection
	_updateConfigReference(config, targetNode, fieldName, sourceNode) {
		// Find the config object this node represents
		const nodeConfig = this._findConfigForNode(config, targetNode);
		if (!nodeConfig) return;

		// Find the index of the source node in its respective array
		const sourceIndex = this._findNodeIndex(config, sourceNode);
		if (sourceIndex >= 0) {
			nodeConfig[fieldName] = sourceIndex;
		}
	}

	// Find the config object that corresponds to a node
	_findConfigForNode(config, node) {
		const modelName = node._modelName;
		const nodeTitle = node.title;

		// Check main config arrays
		const arrayKeys = {
			'AgentConfig': 'agents',
			'ModelConfig': 'models', 
			'EmbeddingConfig': 'embeddings',
			'MemoryConfig': 'memories',
			'KnowledgeConfig': 'knowledges',
			'StorageConfig': 'storages',
			'BackendConfig': 'backends',
			'OptionsConfig': 'options',
			'MemoryDBConfig': 'memory_dbs',
			'KnowledgeDBConfig': 'knowledge_dbs',
			'StorageDBConfig': 'storage_dbs'
		};

		const arrayKey = arrayKeys[modelName];
		if (arrayKey && config[arrayKey]) {
			return config[arrayKey].find((item, index) => {
				// Match by properties or position
				return this._nodeMatchesConfig(node, item);
			});
		}

		return null;
	}

	// Find the index of a node in the config arrays
	_findNodeIndex(config, node) {
		const modelName = node._modelName;
		const arrayKeys = {
			'AgentConfig': 'agents',
			'ModelConfig': 'models',
			'EmbeddingConfig': 'embeddings', 
			'MemoryConfig': 'memories',
			'KnowledgeConfig': 'knowledges',
			'StorageConfig': 'storages',
			'BackendConfig': 'backends',
			'OptionsConfig': 'options',
			'MemoryDBConfig': 'memory_dbs',
			'KnowledgeDBConfig': 'knowledge_dbs',
			'StorageDBConfig': 'storage_dbs'
		};

		const arrayKey = arrayKeys[modelName];
		if (arrayKey && config[arrayKey]) {
			return config[arrayKey].findIndex(item => this._nodeMatchesConfig(node, item));
		}

		return -1;
	}

	// Check if a node matches a config object
	_nodeMatchesConfig(node, configItem) {
		if (!node.properties || !configItem) return false;
		
		// Match by key properties like name, type, or unique identifiers
		const keyProps = ['name', 'type', 'id', 'title'];
		for (let prop of keyProps) {
			if (node.properties[prop] && configItem[prop] && 
				node.properties[prop] === configItem[prop]) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Auto-layout graph nodes using various algorithms
	 * @param {string} algorithm - Layout algorithm: 'hierarchical', 'force', 'circular', 'grid'
	 * @param {object} options - Layout options
	 */
	layoutGraph(algorithm = 'hierarchical', options = {}) {
		const nodes = this.graph._nodes;
		if (!nodes || nodes.length === 0) return;

		switch (algorithm) {
			case 'hierarchical':
				this._hierarchicalLayout(nodes, options);
				break;
			case 'force':
				this._forceDirectedLayout(nodes, options);
				break;
			case 'circular':
				this._circularLayout(nodes, options);
				break;
			case 'grid':
				this._gridLayout(nodes, options);
				break;
			default:
				this._hierarchicalLayout(nodes, options);
		}

		// Center the graph in view
		this.centerGraph();
	}

	/**
	 * Hierarchical layout - best for directed graphs with clear dependencies
	 */
	_hierarchicalLayout(nodes, options = {}) {
		const {
			layerSpacing = 250,
			nodeSpacing = 150,
			direction = 'LR', // 'TB' (top-bottom), 'LR' (left-right)
			alignLayers = true
		} = options;

		// Build adjacency information
		const nodeMap = new Map();
		const inDegree = new Map();
		const outEdges = new Map();
		
		nodes.forEach(node => {
			nodeMap.set(node.id, node);
			inDegree.set(node.id, 0);
			outEdges.set(node.id, []);
		});

		// Count connections and build edge lists
		nodes.forEach(node => {
			if (node.outputs) {
				node.outputs.forEach(output => {
					if (output.links && output.links.length > 0) {
						output.links.forEach(linkId => {
							const link = this.graph.links[linkId];
							if (link) {
								const targetNode = this.graph.getNodeById(link.target_id);
								if (targetNode) {
									outEdges.get(node.id).push(targetNode.id);
									inDegree.set(targetNode.id, inDegree.get(targetNode.id) + 1);
								}
							}
						});
					}
				});
			}
		});

		// Assign nodes to layers using topological sort
		const layers = [];
		const visited = new Set();
		const nodeLayer = new Map();

		// Find root nodes (no incoming edges)
		const roots = [];
		inDegree.forEach((degree, nodeId) => {
			if (degree === 0) {
				roots.push(nodeId);
			}
		});

		// If no roots found, pick nodes with minimum in-degree
		if (roots.length === 0) {
			let minDegree = Infinity;
			inDegree.forEach((degree, nodeId) => {
				if (degree < minDegree) {
					minDegree = degree;
				}
			});
			inDegree.forEach((degree, nodeId) => {
				if (degree === minDegree) {
					roots.push(nodeId);
				}
			});
		}

		// BFS to assign layers
		let currentLayer = 0;
		let queue = [...roots];
		
		while (queue.length > 0) {
			const nextQueue = [];
			const currentLayerNodes = [];
			
			queue.forEach(nodeId => {
				if (!visited.has(nodeId)) {
					visited.add(nodeId);
					nodeLayer.set(nodeId, currentLayer);
					currentLayerNodes.push(nodeId);
					
					// Add connected nodes to next layer
					const edges = outEdges.get(nodeId) || [];
					edges.forEach(targetId => {
						if (!visited.has(targetId)) {
							nextQueue.push(targetId);
						}
					});
				}
			});
			
			if (currentLayerNodes.length > 0) {
				layers[currentLayer] = currentLayerNodes;
			}
			
			queue = [...new Set(nextQueue)];
			currentLayer++;
		}

		// Handle any unvisited nodes
		nodes.forEach(node => {
			if (!visited.has(node.id)) {
				nodeLayer.set(node.id, currentLayer);
				if (!layers[currentLayer]) {
					layers[currentLayer] = [];
				}
				layers[currentLayer].push(node.id);
			}
		});

		// Position nodes
		const isHorizontal = direction === 'LR' || direction === 'RL';
		const startX = 50;
		const startY = 50;

		layers.forEach((layerNodes, layerIndex) => {
			// Sort nodes in each layer to minimize crossings
			if (layerIndex > 0) {
				layerNodes.sort((a, b) => {
					const aNode = nodeMap.get(a);
					const bNode = nodeMap.get(b);
					return this._getBarycenter(aNode, layers[layerIndex - 1], nodeMap) - 
						this._getBarycenter(bNode, layers[layerIndex - 1], nodeMap);
				});
			}

			// Position nodes in this layer
			layerNodes.forEach((nodeId, nodeIndex) => {
				const node = nodeMap.get(nodeId);
				if (node) {
					if (isHorizontal) {
						node.pos[0] = startX + layerIndex * layerSpacing;
						node.pos[1] = startY + nodeIndex * nodeSpacing;
						
						// Center the layer vertically if alignment is enabled
						if (alignLayers) {
							const layerHeight = layerNodes.length * nodeSpacing;
							const offset = -layerHeight / 2;
							node.pos[1] += offset + this.canvas.canvas.height / 2;
						}
					} else {
						node.pos[0] = startX + nodeIndex * nodeSpacing;
						node.pos[1] = startY + layerIndex * layerSpacing;
						
						// Center the layer horizontally if alignment is enabled
						if (alignLayers) {
							const layerWidth = layerNodes.length * nodeSpacing;
							const offset = -layerWidth / 2;
							node.pos[0] += offset + this.canvas.canvas.width / 2;
						}
					}
				}
			});
		});

		this.graph.setDirtyCanvas(true, true);
	}

	/**
	 * Calculate barycenter for crossing minimization
	 */
	_getBarycenter(node, previousLayer, nodeMap) {
		if (!node || !node.inputs) return 0;
		
		let sum = 0;
		let count = 0;
		
		node.inputs.forEach(input => {
			if (input.link) {
				const link = this.graph.links[input.link];
				if (link) {
					const sourceNode = this.graph.getNodeById(link.origin_id);
					if (sourceNode) {
						const index = previousLayer.indexOf(sourceNode.id);
						if (index !== -1) {
							sum += index;
							count++;
						}
					}
				}
			}
		});
		
		return count > 0 ? sum / count : 0;
	}

	/**
	 * Force-directed layout - good for general graphs
	 */
	_forceDirectedLayout(nodes, options = {}) {
		const {
			iterations = 100,
			nodeRepulsion = 1000,
			linkDistance = 200,
			centerForce = 0.01,
			damping = 0.9
		} = options;

		// Initialize node positions randomly if not set
		const positions = new Map();
		const velocities = new Map();
		
		nodes.forEach(node => {
			positions.set(node.id, {
				x: node.pos[0] || Math.random() * 800,
				y: node.pos[1] || Math.random() * 600
			});
			velocities.set(node.id, { x: 0, y: 0 });
		});

		// Get canvas center
		const centerX = this.canvas.canvas.width / 2;
		const centerY = this.canvas.canvas.height / 2;

		// Simulation loop
		for (let iter = 0; iter < iterations; iter++) {
			// Reset forces
			const forces = new Map();
			nodes.forEach(node => {
				forces.set(node.id, { x: 0, y: 0 });
			});

			// Apply repulsion between all nodes
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					const node1 = nodes[i];
					const node2 = nodes[j];
					const pos1 = positions.get(node1.id);
					const pos2 = positions.get(node2.id);
					
					const dx = pos2.x - pos1.x;
					const dy = pos2.y - pos1.y;
					const distance = Math.sqrt(dx * dx + dy * dy) + 0.01;
					
					const force = nodeRepulsion / (distance * distance);
					const fx = (dx / distance) * force;
					const fy = (dy / distance) * force;
					
					forces.get(node1.id).x -= fx;
					forces.get(node1.id).y -= fy;
					forces.get(node2.id).x += fx;
					forces.get(node2.id).y += fy;
				}
			}

			// Apply spring forces for connected nodes
			nodes.forEach(node => {
				if (node.outputs) {
					node.outputs.forEach(output => {
						if (output.links) {
							output.links.forEach(linkId => {
								const link = this.graph.links[linkId];
								if (link) {
									const targetNode = this.graph.getNodeById(link.target_id);
									if (targetNode) {
										const pos1 = positions.get(node.id);
										const pos2 = positions.get(targetNode.id);
										
										const dx = pos2.x - pos1.x;
										const dy = pos2.y - pos1.y;
										const distance = Math.sqrt(dx * dx + dy * dy) + 0.01;
										
										const force = (distance - linkDistance) * 0.01;
										const fx = (dx / distance) * force;
										const fy = (dy / distance) * force;
										
										forces.get(node.id).x += fx;
										forces.get(node.id).y += fy;
										forces.get(targetNode.id).x -= fx;
										forces.get(targetNode.id).y -= fy;
									}
								}
							});
						}
					});
				}
			});

			// Apply center force
			nodes.forEach(node => {
				const pos = positions.get(node.id);
				const dx = centerX - pos.x;
				const dy = centerY - pos.y;
				
				forces.get(node.id).x += dx * centerForce;
				forces.get(node.id).y += dy * centerForce;
			});

			// Update velocities and positions
			nodes.forEach(node => {
				const force = forces.get(node.id);
				const vel = velocities.get(node.id);
				const pos = positions.get(node.id);
				
				vel.x = vel.x * damping + force.x;
				vel.y = vel.y * damping + force.y;
				
				pos.x += vel.x;
				pos.y += vel.y;
			});
		}

		// Apply final positions
		nodes.forEach(node => {
			const pos = positions.get(node.id);
			node.pos[0] = pos.x;
			node.pos[1] = pos.y;
		});

		this.graph.setDirtyCanvas(true, true);
	}

	/**
	 * Circular layout - good for showing all nodes equally
	 */
	_circularLayout(nodes, options = {}) {
		const {
			radius = Math.min(this.canvas.canvas.width, this.canvas.canvas.height) / 3,
			startAngle = 0,
			sweep = Math.PI * 2
		} = options;

		const centerX = this.canvas.canvas.width / 2;
		const centerY = this.canvas.canvas.height / 2;
		const angleStep = sweep / nodes.length;

		nodes.forEach((node, index) => {
			const angle = startAngle + index * angleStep;
			node.pos[0] = centerX + Math.cos(angle) * radius;
			node.pos[1] = centerY + Math.sin(angle) * radius;
		});

		this.graph.setDirtyCanvas(true, true);
	}

	/**
	 * Grid layout - simple organization in a grid
	 */
	_gridLayout(nodes, options = {}) {
		const {
			columns = Math.ceil(Math.sqrt(nodes.length)),
			cellWidth = 250,
			cellHeight = 200,
			startX = 50,
			startY = 50
		} = options;

		nodes.forEach((node, index) => {
			const row = Math.floor(index / columns);
			const col = index % columns;
			
			node.pos[0] = startX + col * cellWidth;
			node.pos[1] = startY + row * cellHeight;
		});

		this.graph.setDirtyCanvas(true, true);
	}

	/**
	 * Center the graph view on all nodes
	 */
	centerGraph() {
		if (!this.graph._nodes || this.graph._nodes.length === 0) return;

		// Calculate bounding box
		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;
		
		this.graph._nodes.forEach(node => {
			minX = Math.min(minX, node.pos[0]);
			minY = Math.min(minY, node.pos[1]);
			maxX = Math.max(maxX, node.pos[0] + node.size[0]);
			maxY = Math.max(maxY, node.pos[1] + node.size[1]);
		});

		// Calculate center and size
		const graphWidth = maxX - minX;
		const graphHeight = maxY - minY;
		const graphCenterX = minX + graphWidth / 2;
		const graphCenterY = minY + graphHeight / 2;

		// Calculate required scale to fit
		const canvasWidth = this.canvas.canvas.width;
		const canvasHeight = this.canvas.canvas.height;
		const padding = 50;
		
		const scaleX = (canvasWidth - padding * 2) / graphWidth;
		const scaleY = (canvasHeight - padding * 2) / graphHeight;
		const scale = Math.min(scaleX, scaleY, 1.5); // Don't zoom in too much

		// Apply scale and center
		this.canvas.ds.scale = scale;
		this.canvas.ds.offset[0] = canvasWidth / 2 - graphCenterX * scale;
		this.canvas.ds.offset[1] = canvasHeight / 2 - graphCenterY * scale;

		this.graph.setDirtyCanvas(true, true);
	}

	/**
	 * Add layout button to canvas menu
	 */
	addLayoutControls() {
		const that = this;
		
		// Override the canvas menu to add layout options
		const originalGetCanvasMenuOptions = this.canvas.getCanvasMenuOptions;
		this.canvas.getCanvasMenuOptions = function() {
			const options = originalGetCanvasMenuOptions ? originalGetCanvasMenuOptions.call(this) : [];
			
			// Add separator
			options.push(null);
			
			// Add layout options
			options.push({
				content: "Layout: Hierarchical",
				callback: () => that.layoutGraph('hierarchical')
			});
			
			options.push({
				content: "Layout: Force-Directed",
				callback: () => that.layoutGraph('force')
			});
			
			options.push({
				content: "Layout: Circular",
				callback: () => that.layoutGraph('circular')
			});
			
			options.push({
				content: "Layout: Grid",
				callback: () => that.layoutGraph('grid')
			});
			
			options.push(null);
			
			options.push({
				content: "Center View",
				callback: () => that.centerGraph()
			});
			
			return options;
		};
	}

	exportJSON() {
		// Sync config before export
		this._syncConfigFromGraph();
		
		const configs = [];
		this.graph._nodes.forEach(node => {
			if (node.outputs && node.outputs.length > 0) {
				const data = node.getOutputData(0);
				if (data) configs.push(data);
			}
		});

		const json = JSON.stringify(this.currentConfig || (configs.length === 1 ? configs[0] : configs), null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'schema-config.json';
		a.click();
		URL.revokeObjectURL(url);
	}
};
