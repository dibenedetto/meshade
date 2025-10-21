console.log('=== SCHEMAGRAPH LOADING ===');

// ========================================================================
// EVENT BUS
// ========================================================================

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistory = 1000;
  }

  on(event, callback, context = null) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ callback, context });
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const listeners = this.listeners.get(event);
    const index = listeners.findIndex(l => l.callback === callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  emit(event, data = null) {
    const eventData = { event, data, timestamp: Date.now() };
    this.eventHistory.push(eventData);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    if (!this.listeners.has(event)) return;
    const listeners = this.listeners.get(event);
    for (const { callback, context } of listeners) {
      try {
        callback.call(context, data);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    }
  }

  clear(event = null) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  getHistory(event = null, limit = 100) {
    let history = this.eventHistory;
    if (event) {
      history = history.filter(e => e.event === event);
    }
    return history.slice(-limit);
  }
}

// ========================================================================
// ANALYTICS SERVICE
// ========================================================================

class AnalyticsService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.metrics = {
      nodeCreated: 0,
      nodeDeleted: 0,
      linkCreated: 0,
      linkDeleted: 0,
      schemaRegistered: 0,
      schemaRemoved: 0,
      graphExported: 0,
      graphImported: 0,
      configExported: 0,
      configImported: 0,
      layoutApplied: 0,
      errors: 0,
      interactions: 0
    };
    this.sessions = [];
    this.currentSession = this.createSession();
    this.setupListeners();
  }

  createSession() {
    return {
      id: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      events: [],
      metrics: {}
    };
  }

  setupListeners() {
    this.eventBus.on('node:created', () => this.track('nodeCreated'));
    this.eventBus.on('node:deleted', () => this.track('nodeDeleted'));
    this.eventBus.on('link:created', () => this.track('linkCreated'));
    this.eventBus.on('link:deleted', () => this.track('linkDeleted'));
    this.eventBus.on('schema:registered', () => this.track('schemaRegistered'));
    this.eventBus.on('schema:removed', () => this.track('schemaRemoved'));
    this.eventBus.on('graph:exported', () => this.track('graphExported'));
    this.eventBus.on('graph:imported', () => this.track('graphImported'));
    this.eventBus.on('config:exported', () => this.track('configExported'));
    this.eventBus.on('config:imported', () => this.track('configImported'));
    this.eventBus.on('layout:applied', () => this.track('layoutApplied'));
    this.eventBus.on('error', () => this.track('errors'));
    this.eventBus.on('interaction', () => this.track('interactions'));
  }

  track(metric, value = 1) {
    if (this.metrics.hasOwnProperty(metric)) {
      this.metrics[metric] += value;
    }
    this.currentSession.events.push({
      metric,
      value,
      timestamp: Date.now()
    });
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getSessionMetrics() {
    return {
      sessionId: this.currentSession.id,
      duration: Date.now() - this.currentSession.startTime,
      events: this.currentSession.events.length,
      metrics: this.metrics
    };
  }

  endSession() {
    this.currentSession.endTime = Date.now();
    this.sessions.push(this.currentSession);
    this.currentSession = this.createSession();
  }

  log(message, data = null) {
    console.log(`[Analytics] ${message}`, data || '');
  }
}

// ========================================================================
// CORE GRAPH CLASSES
// ========================================================================

class LNode {
  constructor(title) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.title = title || "Node";
    this.pos = [0, 0];
    this.size = [180, 60];
    this.inputs = [];
    this.outputs = [];
    this.properties = {};
    this.graph = null;
  }

  addInput(name, type) {
    this.inputs.push({ name, type, link: null });
    return this.inputs.length - 1;
  }

  addOutput(name, type) {
    this.outputs.push({ name, type, links: [] });
    return this.outputs.length - 1;
  }

  getInputData(slot) {
    if (!this.inputs[slot] || !this.inputs[slot].link) return null;
    const link = this.graph.links[this.inputs[slot].link];
    if (!link) return null;
    const originNode = this.graph.getNodeById(link.origin_id);
    if (!originNode || !originNode.outputs[link.origin_slot]) return null;
    return originNode.outputs[link.origin_slot].value;
  }

  setOutputData(slot, data) {
    if (this.outputs[slot]) {
      this.outputs[slot].value = data;
    }
  }

  onExecute() {}
}

class LLink {
  constructor(id, origin_id, origin_slot, target_id, target_slot, type) {
    this.id = id;
    this.origin_id = origin_id;
    this.origin_slot = origin_slot;
    this.target_id = target_id;
    this.target_slot = target_slot;
    this.type = type;
  }
}

class LGraph {
  constructor() {
    this.nodes = [];
    this.links = {};
    this._nodes_by_id = {};
    this.last_link_id = 0;
  }

  add(node) {
    this.nodes.push(node);
    this._nodes_by_id[node.id] = node;
    node.graph = this;
    return node;
  }

  getNodeById(id) {
    return this._nodes_by_id[id];
  }

  connect(originNode, originSlot, targetNode, targetSlot) {
    const outputType = originNode.outputs[originSlot].type;
    const inputType = targetNode.inputs[targetSlot].type;
    
    if (!this._areTypesCompatible(outputType, inputType)) {
      console.warn('Type mismatch:', outputType, '!=', inputType);
      return null;
    }
    
    const linkId = ++this.last_link_id;
    const link = new LLink(linkId, originNode.id, originSlot, targetNode.id, targetSlot, outputType);
    
    this.links[linkId] = link;
    originNode.outputs[originSlot].links.push(linkId);
    targetNode.inputs[targetSlot].link = linkId;
    
    return link;
  }

  _areTypesCompatible(outputType, inputType) {
    if (!outputType || !inputType) return true;
    const output = outputType.trim();
    const input = inputType.trim();
    if (output === input) return true;
    if (input === 'Any' || output === 'Any') return true;
    
    const optMatch = input.match(/Optional\[(.+)\]/);
    if (optMatch) return this._areTypesCompatible(output, optMatch[1]);
    
    const unionMatch = input.match(/Union\[(.+)\]/);
    if (unionMatch) {
      const types = this._splitTypeString(unionMatch[1]);
      for (let i = 0; i < types.length; i++) {
        if (this._areTypesCompatible(output, types[i])) return true;
      }
      return false;
    }
    
    if (input.indexOf('|') !== -1) {
      const parts = input.split('|');
      for (let i = 0; i < parts.length; i++) {
        if (this._areTypesCompatible(output, parts[i].trim())) return true;
      }
      return false;
    }
    
    if (output.indexOf('.') !== -1) {
      const outModel = output.split('.').pop();
      return outModel === input || this._areTypesCompatible(outModel, input);
    }
    if (input.indexOf('.') !== -1) {
      const inModel = input.split('.').pop();
      return output === inModel || this._areTypesCompatible(output, inModel);
    }
    
    if (output === 'int' && (input === 'Index' || input === 'integer')) return true;
    if (input === 'int' && (output === 'Index' || output === 'integer')) return true;
    if (output === 'str' && input === 'string') return true;
    if (input === 'str' && output === 'string') return true;
    
    return false;
  }

  _splitTypeString(str) {
    const result = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < str.length; i++) {
      const c = str.charAt(i);
      if (c === '[') depth++;
      if (c === ']') depth--;
      if (c === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    if (current) result.push(current.trim());
    return result;
  }
}

// ========================================================================
// SCHEMA GRAPH
// ========================================================================

class SchemaGraph extends LGraph {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    this.schemas = {};
    this.nodeTypes = {};
  }

  registerSchema(schemaName, schemaCode, indexType = 'int', rootType = null) {
    try {
      console.log('=== REGISTERING SCHEMA:', schemaName, '===');
      
      const parsed = this._parseSchema(schemaCode);
      const fieldMapping = this._createFieldMappingFromSchema(schemaCode, parsed, rootType);
      
      this.schemas[schemaName] = { 
        code: schemaCode, 
        parsed, 
        indexType,
        rootType,
        fieldMapping
      };
      this._generateNodes(schemaName, parsed, indexType);
      
      this.eventBus.emit('schema:registered', { schemaName, rootType });
      return true;
    } catch (e) {
      console.error('Schema error:', e);
      this.eventBus.emit('error', { type: 'schema:register', error: e.message });
      return false;
    }
  }

  _createFieldMappingFromSchema(schemaCode, parsedModels, rootType) {
    const mapping = { modelToField: {}, fieldToModel: {} };
    
    if (!rootType || !parsedModels[rootType]) {
      return this._createFallbackMapping(parsedModels);
    }
    
    const rootFields = parsedModels[rootType];
    
    for (const field of rootFields) {
      const modelType = this._extractModelTypeFromField(field.type);
      if (modelType && parsedModels[modelType]) {
        mapping.modelToField[modelType] = field.name;
        mapping.fieldToModel[field.name] = modelType;
      }
    }
    
    return mapping;
  }
  
  _extractModelTypeFromField(fieldType) {
    let current = fieldType;
    
    if (current.kind === 'optional') current = current.inner;
    if (current.kind === 'list' || current.kind === 'set' || current.kind === 'tuple') {
      current = current.inner;
    }
    
    if (current.kind === 'dict') {
      const innerStr = current.inner;
      if (innerStr && innerStr.indexOf('Union[') !== -1) {
        const unionMatch = innerStr.match(/Union\[([^\]]+)\]/);
        if (unionMatch) {
          const types = unionMatch[1].split(',').map(t => t.trim());
          for (const type of types) {
            if (type.endsWith('Config')) return type;
          }
        }
      }
      return null;
    }
    
    if (current.kind === 'union') {
      for (const type of current.types) {
        if (type.kind === 'basic' && type.name && type.name.endsWith('Config')) {
          return type.name;
        }
      }
      return null;
    }
    
    if (current.kind === 'basic') {
      if (current.name && current.name.endsWith('Config')) return current.name;
      return null;
    }
    
    return null;
  }
  
  _createFallbackMapping(parsedModels) {
    const mapping = { modelToField: {}, fieldToModel: {} };
    
    for (const modelName in parsedModels) {
      if (!parsedModels.hasOwnProperty(modelName)) continue;
      
      const baseName = modelName.replace(/Config$/, '');
      let fieldName = baseName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z\d])([A-Z])/g, '$1_$2')
        .toLowerCase();
      
      if (!fieldName.endsWith('s')) {
        if (fieldName.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(end => fieldName.endsWith(end))) {
          fieldName = fieldName.slice(0, -1) + 'ies';
        } else {
          fieldName = fieldName + 's';
        }
      }
      
      mapping.modelToField[modelName] = fieldName;
      mapping.fieldToModel[fieldName] = modelName;
    }
    
    return mapping;
  }

  modelNameToFieldName(modelName) {
    const baseName = modelName.replace(/Config$/, '');
    let fieldName = baseName
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();
    
    if (!fieldName.endsWith('s')) {
      if (fieldName.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(end => fieldName.endsWith(end))) {
        fieldName = fieldName.slice(0, -1) + 'ies';
      } else if (fieldName.endsWith('x') || fieldName.endsWith('ch') || fieldName.endsWith('sh')) {
        fieldName = fieldName + 'es';
      } else {
        fieldName = fieldName + 's';
      }
    }
    
    return fieldName;
  }

  _parseSchema(code) {
    const models = {};
    const lines = code.split('\n');
    let currentModel = null;
    let currentFields = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const classMatch = line.match(/^class\s+(\w+)\s*\(/);
      if (classMatch) {
        if (currentModel) models[currentModel] = currentFields;
        currentModel = classMatch[1];
        currentFields = [];
        continue;
      }
      if (currentModel && line.indexOf(':') !== -1) {
        const fieldMatch = line.match(/^(\w+)\s*:\s*(.+?)(?:\s*=|$)/);
        if (fieldMatch) {
          currentFields.push({
            name: fieldMatch[1],
            type: this._parseType(fieldMatch[2].trim()),
            rawType: fieldMatch[2].trim()
          });
        }
      }
    }
    if (currentModel) models[currentModel] = currentFields;
    return models;
  }

  _parseType(str) {
    str = str.trim();
    if (str.indexOf('Optional[') === 0) {
      const inner = this._extractBracket(str, 9);
      return { kind: 'optional', inner: this._parseType(inner) };
    }
    if (str.indexOf('Union[') === 0) {
      const inner = this._extractBracket(str, 6);
      const types = this._splitTypes(inner);
      return { kind: 'union', types: types.map(t => this._parseType(t)) };
    }
    if (str.indexOf('List[') === 0) {
      const inner = this._extractBracket(str, 5);
      return { kind: 'list', inner: this._parseType(inner) };
    }
    if (str.indexOf('Set[') === 0) {
      const inner = this._extractBracket(str, 4);
      return { kind: 'set', inner: this._parseType(inner) };
    }
    if (str.indexOf('Tuple[') === 0) {
      const inner = this._extractBracket(str, 6);
      return { kind: 'tuple', inner: this._parseType(inner) };
    }
    if (str.indexOf('Dict[') === 0 || str.indexOf('dict[') === 0) {
      const startIdx = str.indexOf('[') + 1;
      const inner = this._extractBracket(str, startIdx);
      return { kind: 'dict', inner: inner };
    }
    return { kind: 'basic', name: str };
  }

  _extractBracket(str, start) {
    let depth = 1;
    let i = start;
    while (i < str.length && depth > 0) {
      if (str.charAt(i) === '[') depth++;
      if (str.charAt(i) === ']') depth--;
      if (depth === 0) break;
      i++;
    }
    return str.substring(start, i);
  }

  _splitTypes(str) {
    const result = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < str.length; i++) {
      const c = str.charAt(i);
      if (c === '[') depth++;
      if (c === ']') depth--;
      if (c === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    if (current) result.push(current.trim());
    return result;
  }

  _generateNodes(schemaName, models, indexType) {
    for (const modelName in models) {
      if (!models.hasOwnProperty(modelName)) continue;
      const fields = models[modelName];
      
      const self = this;
      const schemaInfo = this.schemas[schemaName];
      const isRootType = schemaInfo && schemaInfo.rootType === modelName;
      
      class GeneratedNode extends LNode {
        constructor() {
          super(schemaName + '.' + modelName);
          this.schemaName = schemaName;
          this.modelName = modelName;
          this.isRootType = isRootType;
          this.addOutput('self', modelName);
          
          this.nativeInputs = {};
          this.multiInputs = {};
          this.optionalFields = {};
          
          for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const inputType = self._getInputType(f, indexType);
            const compactType = self.compactType(inputType);
            
            const isOptional = f.type.kind === 'optional';
            if (isOptional) {
              this.optionalFields[i] = true;
            }
            
            const isCollectionOfUnions = self._isCollectionOfUnions(f.type);
            const isListField = isRootType && self._isListFieldType(f.type);
            
            if (isCollectionOfUnions || isListField) {
              this.addInput(f.name, compactType);
              this.multiInputs[i] = { type: compactType, links: [] };
            } else {
              this.addInput(f.name, compactType);
              
              const isNative = self._isNativeType(compactType);
              if (isNative) {
                const baseType = self._getNativeBaseType(compactType);
                const defaultValue = self._getDefaultValueForType(baseType);
                this.nativeInputs[i] = {
                  type: baseType,
                  value: defaultValue,  // ← NOW USES DEFAULT VALUE
                  optional: isOptional
                };
              }
            }
          }
          this.size = [200, Math.max(80, 30 + fields.length * 25)];
        }
  
        onExecute() {
          const data = {};
          for (let i = 0; i < this.inputs.length; i++) {
            if (this.multiInputs[i]) {
              const values = [];
              for (const linkId of this.multiInputs[i].links) {
                const link = this.graph.links[linkId];
                if (link) {
                  const sourceNode = this.graph.getNodeById(link.origin_id);
                  if (sourceNode && sourceNode.outputs[link.origin_slot]) {
                    values.push(sourceNode.outputs[link.origin_slot].value);
                  }
                }
              }
              if (values.length > 0) {
                data[this.inputs[i].name] = values;
              } else if (this.optionalFields[i]) {
                continue;
              }
            } else {
              const connectedVal = this.getInputData(i);
              if (connectedVal !== null && connectedVal !== undefined) {
                data[this.inputs[i].name] = connectedVal;
              } else if (this.nativeInputs[i] !== undefined) {
                const val = this.nativeInputs[i].value;
                const isOptional = this.nativeInputs[i].optional;
                const baseType = this.nativeInputs[i].type;
                
                // FIX: Handle boolean values correctly
                if (baseType === 'bool') {
                  if (val === true || val === false) {
                    data[this.inputs[i].name] = val;
                  } else if (val === 'true') {
                    data[this.inputs[i].name] = true;
                  } else if (val === 'false' || val === '') {
                    if (!isOptional) {
                      data[this.inputs[i].name] = false;
                    }
                  }
                  continue;
                }
                
                const isEmpty = val === null || val === undefined || val === '';
                
                if (isOptional && isEmpty) {
                  continue;
                }
                
                if (!isEmpty) {
                  if (baseType === 'dict' || baseType === 'list' || baseType === 'set' || baseType === 'tuple') {
                    try {
                      data[this.inputs[i].name] = JSON.parse(val);
                    } catch (e) {
                      data[this.inputs[i].name] = baseType === 'dict' ? {} : [];
                    }
                  } else if (baseType === 'int') {
                    data[this.inputs[i].name] = parseInt(val) || 0;
                  } else if (baseType === 'float') {
                    data[this.inputs[i].name] = parseFloat(val) || 0.0;
                  } else {
                    data[this.inputs[i].name] = val;
                  }
                } else if (!isOptional) {
                  if (baseType === 'int') data[this.inputs[i].name] = 0;
                  else if (baseType === 'float') data[this.inputs[i].name] = 0.0;
                  else if (baseType === 'dict') data[this.inputs[i].name] = {};
                  else if (baseType === 'list' || baseType === 'set' || baseType === 'tuple') {
                    data[this.inputs[i].name] = [];
                  } else {
                    data[this.inputs[i].name] = '';
                  }
                }
              }
            }
          }
          this.setOutputData(0, data);
        }
      }
      
      this.nodeTypes[schemaName + '.' + modelName] = GeneratedNode;
    }
  }

  _isNativeType(typeStr) {
    if (!typeStr) return false;
    const base = typeStr.replace(/^Optional\[|\]$/g, '').split('|')[0].trim();
    const nativeTypes = ['str', 'int', 'bool', 'float', 'string', 'integer', 'Index'];
    if (nativeTypes.indexOf(base) !== -1) return true;
    if (base.indexOf('Dict[') === 0 || base.indexOf('dict[') === 0) return true;
    if (base.indexOf('List[') === 0 || base.indexOf('list[') === 0) return true;
    if (base.indexOf('Set[') === 0 || base.indexOf('set[') === 0) return true;
    if (base.indexOf('Tuple[') === 0 || base.indexOf('tuple[') === 0) return true;
    return false;
  }

  _isCollectionOfUnions(fieldType) {
    let current = fieldType;
    if (current.kind === 'optional') current = current.inner;
    if (current.kind === 'list' || current.kind === 'set' || current.kind === 'tuple') {
      return current.inner && current.inner.kind === 'union';
    }
    if (current.kind === 'dict') {
      const innerStr = current.inner;
      if (innerStr && (innerStr.indexOf('Union[') !== -1 || innerStr.indexOf('union[') !== -1)) {
        return true;
      }
    }
    if (current.kind === 'basic' && current.name) {
      const name = current.name;
      if (name.indexOf('Dict[') === 0 || name.indexOf('dict[') === 0) {
        return name.indexOf('Union[') !== -1 || name.indexOf('union[') !== -1;
      }
    }
    return false;
  }

  _isListFieldType(fieldType) {
    let current = fieldType;
    if (current.kind === 'optional') current = current.inner;
    return current.kind === 'list';
  }

  _getNativeBaseType(typeStr) {
    if (!typeStr) return 'str';
    const base = typeStr.replace(/^Optional\[|\]$/g, '').split('|')[0].trim();
    if (base === 'int' || base === 'integer' || base === 'Index') return 'int';
    if (base === 'bool') return 'bool';
    if (base === 'float') return 'float';
    if (base.indexOf('Dict[') === 0 || base.indexOf('dict[') === 0) return 'dict';
    if (base.indexOf('List[') === 0 || base.indexOf('list[') === 0) return 'list';
    if (base.indexOf('Set[') === 0 || base.indexOf('set[') === 0) return 'set';
    if (base.indexOf('Tuple[') === 0 || base.indexOf('tuple[') === 0) return 'tuple';
    return 'str';
  }

  _getDefaultValueForType(baseType) {
    if (baseType === 'int') return 0;
    if (baseType === 'bool') return false;
    if (baseType === 'float') return 0.0;
    if (baseType === 'dict') return '{}';
    if (baseType === 'list') return '[]';
    if (baseType === 'set') return '[]';
    if (baseType === 'tuple') return '[]';
    return '';
  }

  _getInputType(field, indexType) {
    const t = field.type;
    if (t.kind === 'optional') {
      const innerType = this._getInputType({ type: t.inner }, indexType);
      return 'Optional[' + innerType + ']';
    }
    if (t.kind === 'union') {
      let hasIdx = false;
      let modelType = null;
      
      for (let i = 0; i < t.types.length; i++) {
        if (t.types[i].kind === 'basic' && t.types[i].name === indexType) {
          hasIdx = true;
        } else {
          modelType = t.types[i];
        }
      }
      
      if (hasIdx && modelType && t.types.length === 2) {
        return modelType.name || 'Model';
      }
      
      const names = t.types.map(tp => tp.name || tp.kind);
      return names.join('|');
    }
    if (t.kind === 'list') {
      const innerType = this._getInputType({ type: t.inner }, indexType);
      return 'List[' + innerType + ']';
    }
    if (t.kind === 'set') {
      const innerType = this._getInputType({ type: t.inner }, indexType);
      return 'Set[' + innerType + ']';
    }
    if (t.kind === 'tuple') {
      const innerType = this._getInputType({ type: t.inner }, indexType);
      return 'Tuple[' + innerType + ',...]';
    }
    if (t.kind === 'dict') {
      return 'Dict[' + t.inner + ']';
    }
    if (t.kind === 'basic') return t.name;
    return 'Any';
  }

  compactType(typeStr) {
    if (!typeStr) return typeStr;
    return typeStr.replace(/\s+/g, '');
  }

  getSchemaInfo(schemaName) {
    if (!this.schemas[schemaName]) return null;
    return {
      name: schemaName,
      indexType: this.schemas[schemaName].indexType,
      rootType: this.schemas[schemaName].rootType,
      models: Object.keys(this.schemas[schemaName].parsed)
    };
  }

  createNode(type) {
    const NodeClass = this.nodeTypes[type];
    if (!NodeClass) throw new Error('Unknown node type: ' + type);
    const node = new NodeClass();
    this.add(node);
    this.eventBus.emit('node:created', { type, nodeId: node.id });
    return node;
  }

  removeSchema(schemaName) {
    if (!this.schemas[schemaName]) return false;
    
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (node.schemaName === schemaName) {
        for (let j = 0; j < node.inputs.length; j++) {
          if (node.inputs[j].link) {
            const linkId = node.inputs[j].link;
            const link = this.links[linkId];
            if (link) {
              const originNode = this.getNodeById(link.origin_id);
              if (originNode) {
                const idx = originNode.outputs[link.origin_slot].links.indexOf(linkId);
                if (idx > -1) originNode.outputs[link.origin_slot].links.splice(idx, 1);
              }
              delete this.links[linkId];
            }
          }
        }
        for (let j = 0; j < node.outputs.length; j++) {
          const links = node.outputs[j].links.slice();
          for (let k = 0; k < links.length; k++) {
            const linkId = links[k];
            const link = this.links[linkId];
            if (link) {
              const targetNode = this.getNodeById(link.target_id);
              if (targetNode) {
                targetNode.inputs[link.target_slot].link = null;
              }
              delete this.links[linkId];
            }
          }
        }
        
        this.nodes.splice(i, 1);
        delete this._nodes_by_id[node.id];
      }
    }
    
    for (const type in this.nodeTypes) {
      if (this.nodeTypes.hasOwnProperty(type) && type.indexOf(schemaName + '.') === 0) {
        delete this.nodeTypes[type];
      }
    }
    
    delete this.schemas[schemaName];
    this.eventBus.emit('schema:removed', { schemaName });
    return true;
  }

  getRegisteredSchemas() {
    return Object.keys(this.schemas);
  }

  serialize(includeCamera = false, camera = null) {
    const data = {
      version: '1.0',
      nodes: [],
      links: []
    };
    
    for (const node of this.nodes) {
      const nodeData = {
        id: node.id,
        type: node.title,
        pos: node.pos.slice(),
        size: node.size.slice(),
        properties: JSON.parse(JSON.stringify(node.properties)),
        schemaName: node.schemaName,
        modelName: node.modelName,
        isNative: node.isNative || false,
        isRootType: node.isRootType || false
      };
      
      if (node.nativeInputs) {
        nodeData.nativeInputs = JSON.parse(JSON.stringify(node.nativeInputs));
      }
      
      data.nodes.push(nodeData);
    }
    
    for (const linkId in this.links) {
      if (this.links.hasOwnProperty(linkId)) {
        const link = this.links[linkId];
        data.links.push({
          id: link.id,
          origin_id: link.origin_id,
          origin_slot: link.origin_slot,
          target_id: link.target_id,
          target_slot: link.target_slot,
          type: link.type
        });
      }
    }
    
    if (includeCamera && camera) {
      data.camera = {
        x: camera.x,
        y: camera.y,
        scale: camera.scale
      };
    }
    
    return data;
  }

  deserialize(data, restoreCamera = false, camera = null) {
    this.nodes = [];
    this.links = {};
    this._nodes_by_id = {};
    this.last_link_id = 0;
    
    if (!data || !data.nodes) {
      throw new Error('Invalid graph data');
    }
    
    for (const nodeData of data.nodes) {
      let nodeTypeKey;
      if (nodeData.isNative) {
        nodeTypeKey = 'Native.' + nodeData.type;
      } else if (nodeData.schemaName && nodeData.modelName) {
        nodeTypeKey = nodeData.schemaName + '.' + nodeData.modelName;
      } else {
        nodeTypeKey = nodeData.type;
      }
      
      if (!this.nodeTypes[nodeTypeKey]) {
        console.warn('Node type not found:', nodeTypeKey);
        continue;
      }
      
      const node = new (this.nodeTypes[nodeTypeKey])();
      node.id = nodeData.id;
      node.pos = nodeData.pos.slice();
      node.size = nodeData.size.slice();
      node.properties = JSON.parse(JSON.stringify(nodeData.properties));
      
      if (nodeData.isRootType !== undefined) {
        node.isRootType = nodeData.isRootType;
      }
      
      if (nodeData.nativeInputs) {
        node.nativeInputs = JSON.parse(JSON.stringify(nodeData.nativeInputs));
      }
      
      this.nodes.push(node);
      this._nodes_by_id[node.id] = node;
      node.graph = this;
    }
    
    if (data.links) {
      for (const linkData of data.links) {
        const originNode = this._nodes_by_id[linkData.origin_id];
        const targetNode = this._nodes_by_id[linkData.target_id];
        
        if (originNode && targetNode) {
          const link = new LLink(
            linkData.id,
            linkData.origin_id,
            linkData.origin_slot,
            linkData.target_id,
            linkData.target_slot,
            linkData.type
          );
          
          this.links[linkData.id] = link;
          originNode.outputs[linkData.origin_slot].links.push(linkData.id);
          targetNode.inputs[linkData.target_slot].link = linkData.id;
          
          if (linkData.id > this.last_link_id) {
            this.last_link_id = linkData.id;
          }
        }
      }
    }
    
    if (restoreCamera && data.camera && camera) {
      camera.x = data.camera.x;
      camera.y = data.camera.y;
      camera.scale = data.camera.scale;
    }
    
    this.eventBus.emit('graph:deserialized', { nodeCount: this.nodes.length });
    return true;
  }
}

// ========================================================================
// CONTROLLERS
// ========================================================================

class MouseTouchController {
  constructor(canvas, eventBus) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this.setupListeners();
  }

  setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
    this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
  }

  handleMouseDown(e) {
    const coords = this.getCanvasCoordinates(e);
    this.eventBus.emit('mouse:down', { button: e.button, coords, event: e });
    this.eventBus.emit('interaction', { type: 'mouse:down' });
  }

  handleMouseMove(e) {
    const coords = this.getCanvasCoordinates(e);
    this.eventBus.emit('mouse:move', { coords, event: e });
  }

  handleMouseUp(e) {
    const coords = this.getCanvasCoordinates(e);
    this.eventBus.emit('mouse:up', { button: e.button, coords, event: e });
    this.eventBus.emit('interaction', { type: 'mouse:up' });
  }

  handleDoubleClick(e) {
    const coords = this.getCanvasCoordinates(e);
    this.eventBus.emit('mouse:dblclick', { coords, event: e });
    this.eventBus.emit('interaction', { type: 'mouse:dblclick' });
  }

  handleWheel(e) {
    e.preventDefault();
    const coords = this.getCanvasCoordinates(e);
    this.eventBus.emit('mouse:wheel', { delta: e.deltaY, coords, event: e });
    this.eventBus.emit('interaction', { type: 'mouse:wheel' });
  }

  handleContextMenu(e) {
    e.preventDefault();
    const coords = this.getCanvasCoordinates(e);
    this.eventBus.emit('mouse:contextmenu', { coords, event: e });
    this.eventBus.emit('interaction', { type: 'contextmenu' });
  }

  getCanvasCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return {
      screenX: (sx / rect.width) * this.canvas.width,
      screenY: (sy / rect.height) * this.canvas.height,
      clientX: e.clientX,
      clientY: e.clientY,
      rect: rect
    };
  }
}

class KeyboardController {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  handleKeyDown(e) {
    this.eventBus.emit('keyboard:down', { key: e.key, code: e.code, event: e });
    this.eventBus.emit('interaction', { type: 'keyboard:down' });
  }

  handleKeyUp(e) {
    this.eventBus.emit('keyboard:up', { key: e.key, code: e.code, event: e });
    this.eventBus.emit('interaction', { type: 'keyboard:up' });
  }
}

class VoiceController {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.recognition = null;
    this.isListening = false;
    this.setupRecognition();
  }

  setupRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      
      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.eventBus.emit('voice:result', { transcript, confidence: event.results[0][0].confidence });
        this.eventBus.emit('interaction', { type: 'voice:result' });
      };
      
      this.recognition.onerror = (event) => {
        this.eventBus.emit('voice:error', { error: event.error });
      };
      
      this.recognition.onend = () => {
        this.isListening = false;
        this.eventBus.emit('voice:stopped', {});
      };
    } else {
      console.warn('Speech recognition not supported');
    }
  }

  startListening() {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
      this.isListening = true;
      this.eventBus.emit('voice:started', {});
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }
}

class UIController {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.elements = new Map();
    this.setupDefaultListeners();
  }

  register(id, element) {
    this.elements.set(id, element);
  }

  get(id) {
    return this.elements.get(id);
  }

  setupDefaultListeners() {
    this.eventBus.on('ui:show', (data) => {
      const element = this.elements.get(data.id);
      if (element) element.classList.add('show');
    });

    this.eventBus.on('ui:hide', (data) => {
      const element = this.elements.get(data.id);
      if (element) element.classList.remove('show');
    });

    this.eventBus.on('ui:update', (data) => {
      const element = this.elements.get(data.id);
      if (element && data.content !== undefined) {
        element.textContent = data.content;
      }
    });
  }

  setupButton(id, eventName) {
    const element = this.elements.get(id);
    if (element) {
      element.addEventListener('click', () => {
        this.eventBus.emit(eventName, { id });
        this.eventBus.emit('interaction', { type: eventName });
      });
    }
  }

  setupFileInput(id, eventName) {
    const element = this.elements.get(id);
    if (element) {
      element.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.eventBus.emit(eventName, { file, element: e.target });
          this.eventBus.emit('interaction', { type: eventName });
        }
      });
    }
  }

  setupSelect(id, eventName) {
    const element = this.elements.get(id);
    if (element) {
      element.addEventListener('change', (e) => {
        this.eventBus.emit(eventName, { value: e.target.value, element: e.target });
        this.eventBus.emit('interaction', { type: eventName });
      });
    }
  }
}

class DrawingStyleManager {
  constructor() {
    this.currentStyle = 'default';
    this.styles = {
      default: {
        name: 'Default',
        nodeCornerRadius: 6,
        nodeShadowBlur: 10,
        nodeShadowOffset: 2,
        linkWidth: 2.5,
        linkShadowBlur: 6,
        linkCurve: 0.5,
        slotRadius: 4,
        slotHighlightRadius: 8,
        gridOpacity: 1.0,
        textFont: 'Arial, sans-serif',
        useGradient: false,
        useGlow: false,
        useDashed: false
      },
      minimal: {
        name: 'Minimal',
        nodeCornerRadius: 2,
        nodeShadowBlur: 0,
        nodeShadowOffset: 0,
        linkWidth: 1.5,
        linkShadowBlur: 0,
        linkCurve: 0.5,
        slotRadius: 3,
        slotHighlightRadius: 6,
        gridOpacity: 0.3,
        textFont: 'Arial, sans-serif',
        useGradient: false,
        useGlow: false,
        useDashed: false
      },
      blueprint: {
        name: 'Blueprint',
        nodeCornerRadius: 0,
        nodeShadowBlur: 0,
        nodeShadowOffset: 0,
        linkWidth: 1.5,
        linkShadowBlur: 8,
        linkCurve: 0,
        slotRadius: 3,
        slotHighlightRadius: 7,
        gridOpacity: 1.5,
        textFont: 'Courier New, monospace',
        useGradient: false,
        useGlow: true,
        useDashed: true
      },
      neon: {
        name: 'Neon',
        nodeCornerRadius: 8,
        nodeShadowBlur: 20,
        nodeShadowOffset: 0,
        linkWidth: 3,
        linkShadowBlur: 15,
        linkCurve: 0.6,
        slotRadius: 5,
        slotHighlightRadius: 12,
        gridOpacity: 0.5,
        textFont: 'Arial, sans-serif',
        useGradient: true,
        useGlow: true,
        useDashed: false
      },
      organic: {
        name: 'Organic',
        nodeCornerRadius: 15,
        nodeShadowBlur: 12,
        nodeShadowOffset: 3,
        linkWidth: 4,
        linkShadowBlur: 8,
        linkCurve: 0.7,
        slotRadius: 6,
        slotHighlightRadius: 10,
        gridOpacity: 0.7,
        textFont: 'Georgia, serif',
        useGradient: true,
        useGlow: false,
        useDashed: false
      },
      wireframe: {
        name: 'Wireframe',
        nodeCornerRadius: 0,
        nodeShadowBlur: 0,
        nodeShadowOffset: 0,
        linkWidth: 1,
        linkShadowBlur: 0,
        linkCurve: 0.5,
        slotRadius: 2,
        slotHighlightRadius: 5,
        gridOpacity: 0.8,
        textFont: 'Courier New, monospace',
        useGradient: false,
        useGlow: false,
        useDashed: true
      }
    };
  }

  setStyle(styleName) {
    if (this.styles[styleName]) {
      this.currentStyle = styleName;
      localStorage.setItem('schemagraph-drawing-style', styleName);
      return true;
    }
    return false;
  }

  getStyle() {
    return this.styles[this.currentStyle];
  }

  getCurrentStyleName() {
    return this.currentStyle;
  }

  loadSavedStyle() {
    const saved = localStorage.getItem('schemagraph-drawing-style');
    if (saved && this.styles[saved]) {
      this.currentStyle = saved;
    }
  }
}

// ========================================================================
// MAIN APPLICATION
// ========================================================================

class SchemaGraphApp {
  constructor() {
    this.eventBus = new EventBus();
    this.analytics = new AnalyticsService(this.eventBus);
    
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.mouseController = new MouseTouchController(this.canvas, this.eventBus);
    this.keyboardController = new KeyboardController(this.eventBus);
    this.voiceController = new VoiceController(this.eventBus);
    this.uiController = new UIController(this.eventBus);
    
    this.initializeState();
    this.registerUIElements();
    this.setupEventListeners();
    this.setupCanvasLeaveHandler();
    this.setupVoiceAndAnalyticsUI();
    this.setupDrawingStyleSelector();
    this.setupTextScalingToggle();
    this.setupVoiceCommands();
    this.registerNativeNodes();
    
    this.resizeCanvas();
    this.draw();
    
    this.eventBus.emit('app:ready', {});
    console.log('=== SCHEMAGRAPH READY ===');
  }

  initializeState() {
    this.graph = new SchemaGraph(this.eventBus);
    this.camera = { x: 0, y: 0, scale: 1.0 };
    
    this.selectedNodes = new Set(); // Multi-selection support
    this.selectedNode = null; // Keep for backward compatibility
    this.selectionRect = null; // For drag-to-select
    this.selectionStart = null;
    this.isMouseDown = false;
    this.dragNode = null;
    this.dragOffset = [0, 0];
    this.connecting = null;
    this.mousePos = [0, 0];
    this.isPanning = false;
    this.panStart = [0, 0];
    this.spacePressed = false;
    this.editingNode = null;
    this.pendingSchemaCode = null;
    
    this.themes = ['dark', 'light', 'ocean'];
    this.currentThemeIndex = 0;
    this.loadTheme();
    
    this.drawingStyleManager = new DrawingStyleManager();
    this.drawingStyleManager.loadSavedStyle();
    
    this.textScalingMode = 'fixed';  // Default to fixed text size
    this.loadTextScalingMode();
  }

  registerUIElements() {
    const ui = this.uiController;
    
    // Register all UI elements
    ui.register('status', document.getElementById('status'));
    ui.register('errorBanner', document.getElementById('errorBanner'));
    ui.register('nodeTypesList', document.getElementById('nodeTypesList'));
    ui.register('zoomLevel', document.getElementById('zoomLevel'));
    ui.register('contextMenu', document.getElementById('contextMenu'));
    ui.register('nodeInput', document.getElementById('nodeInput'));
    ui.register('schemaList', document.getElementById('schemaList'));
    ui.register('schemaDialog', document.getElementById('schemaDialog'));
    ui.register('schemaRemovalDialog', document.getElementById('schemaRemovalDialog'));
    
    // Setup buttons
    ui.register('uploadSchemaBtn', document.getElementById('uploadSchemaBtn'));
    ui.register('exportBtn', document.getElementById('exportBtn'));
    ui.register('importBtn', document.getElementById('importBtn'));
    ui.register('exportConfigBtn', document.getElementById('exportConfigBtn'));
    ui.register('importConfigBtn', document.getElementById('importConfigBtn'));
    ui.register('centerViewBtn', document.getElementById('centerViewBtn'));
    ui.register('resetZoomBtn', document.getElementById('resetZoomBtn'));
    ui.register('themeBtn', document.getElementById('themeBtn'));
    
    // Setup file inputs
    ui.register('uploadSchemaFile', document.getElementById('uploadSchemaFile'));
    ui.register('importFile', document.getElementById('importFile'));
    ui.register('importConfigFile', document.getElementById('importConfigFile'));
    
    // Setup selects
    ui.register('layoutSelect', document.getElementById('layoutSelect'));
    
    // Setup dialog elements
    ui.register('schemaNameInput', document.getElementById('schemaNameInput'));
    ui.register('schemaIndexTypeInput', document.getElementById('schemaIndexTypeInput'));
    ui.register('schemaRootTypeInput', document.getElementById('schemaRootTypeInput'));
    ui.register('schemaDialogConfirm', document.getElementById('schemaDialogConfirm'));
    ui.register('schemaDialogCancel', document.getElementById('schemaDialogCancel'));
    ui.register('schemaRemovalNameInput', document.getElementById('schemaRemovalNameInput'));
    ui.register('schemaRemovalConfirm', document.getElementById('schemaRemovalConfirm'));
    ui.register('schemaRemovalCancel', document.getElementById('schemaRemovalCancel'));
  }

  setupEventListeners() {
    // Mouse events
    this.eventBus.on('mouse:down', (data) => this.handleMouseDown(data));
    this.eventBus.on('mouse:move', (data) => this.handleMouseMove(data));
    this.eventBus.on('mouse:up', (data) => this.handleMouseUp(data));
    this.eventBus.on('mouse:dblclick', (data) => this.handleDoubleClick(data));
    this.eventBus.on('mouse:wheel', (data) => this.handleWheel(data));
    this.eventBus.on('mouse:contextmenu', (data) => this.handleContextMenu(data));
    
    // Keyboard events
    this.eventBus.on('keyboard:down', (data) => this.handleKeyDown(data));
    this.eventBus.on('keyboard:up', (data) => this.handleKeyUp(data));
    
    // UI events
    this.uiController.setupButton('uploadSchemaBtn', 'ui:upload-schema');
    this.uiController.setupButton('exportBtn', 'ui:export-graph');
    this.uiController.setupButton('importBtn', 'ui:import-graph');
    this.uiController.setupButton('exportConfigBtn', 'ui:export-config');
    this.uiController.setupButton('importConfigBtn', 'ui:import-config');
    this.uiController.setupButton('centerViewBtn', 'ui:center-view');
    this.uiController.setupButton('resetZoomBtn', 'ui:reset-zoom');
    this.uiController.setupButton('themeBtn', 'ui:cycle-theme');
    this.uiController.setupButton('schemaDialogConfirm', 'ui:confirm-schema');
    this.uiController.setupButton('schemaDialogCancel', 'ui:cancel-schema');
    this.uiController.setupButton('schemaRemovalConfirm', 'ui:confirm-removal');
    this.uiController.setupButton('schemaRemovalCancel', 'ui:cancel-removal');
    
    this.uiController.setupFileInput('uploadSchemaFile', 'file:schema-uploaded');
    this.uiController.setupFileInput('importFile', 'file:graph-uploaded');
    this.uiController.setupFileInput('importConfigFile', 'file:config-uploaded');
    
    this.uiController.setupSelect('layoutSelect', 'ui:layout-selected');
    
    this.eventBus.on('ui:upload-schema', () => {
      this.uiController.get('uploadSchemaFile').click();
    });
    
    this.eventBus.on('ui:import-graph', () => {
      this.uiController.get('importFile').click();
    });
    
    this.eventBus.on('ui:import-config', () => {
      this.uiController.get('importConfigFile').click();
    });
    
    this.eventBus.on('ui:export-graph', () => this.exportGraph());
    this.eventBus.on('ui:export-config', () => this.exportConfig());
    this.eventBus.on('ui:center-view', () => this.centerView());
    this.eventBus.on('ui:reset-zoom', () => this.resetZoom());
    this.eventBus.on('ui:cycle-theme', () => this.cycleTheme());
    
    this.eventBus.on('ui:layout-selected', (data) => {
      if (data.value) {
        this.applyLayout(data.value);
        data.element.value = '';
      }
    });
    
    this.eventBus.on('file:schema-uploaded', (data) => this.handleSchemaFileUpload(data));
    this.eventBus.on('file:graph-uploaded', (data) => this.handleImportGraph(data));
    this.eventBus.on('file:config-uploaded', (data) => this.handleImportConfig(data));
    
    this.eventBus.on('ui:confirm-schema', () => this.confirmSchemaRegistration());
    this.eventBus.on('ui:cancel-schema', () => this.cancelSchemaRegistration());
    this.eventBus.on('ui:confirm-removal', () => this.confirmSchemaRemoval());
    this.eventBus.on('ui:cancel-removal', () => this.cancelSchemaRemoval());
    
    // Graph events
    this.eventBus.on('node:created', () => {
      this.updateSchemaList();
      this.updateNodeTypesList();
      this.draw();
    });
    
    this.eventBus.on('node:deleted', () => {
      this.updateSchemaList();
      this.draw();
    });
    
    this.eventBus.on('link:created', () => this.draw());
    this.eventBus.on('link:deleted', () => this.draw());
    
    this.eventBus.on('schema:registered', () => {
      this.updateSchemaList();
      this.updateNodeTypesList();
      this.draw();
    });
    
    this.eventBus.on('schema:removed', () => {
      this.updateSchemaList();
      this.updateNodeTypesList();
      this.draw();
    });
    
    // Input events
    const nodeInput = this.uiController.get('nodeInput');
    nodeInput.addEventListener('blur', () => this.handleInputBlur());
    nodeInput.addEventListener('keydown', (e) => this.handleInputKeyDown(e));
    
    // Document events
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#contextMenu')) {
        this.uiController.get('contextMenu').classList.remove('show');
      }
    });
    
    // Window events
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Set ready status
    this.eventBus.emit('ui:update', { id: 'status', content: 'Ready. Upload a schema to begin.' });
  }

  setupCanvasLeaveHandler() {
    this.canvas.addEventListener('mouseleave', () => {
      // Clean up selection rectangle if mouse leaves canvas
      if (this.selectionRect) {
        this.selectionRect = null;
        this.selectionStart = null;
        this.isMouseDown = false;
        this.draw();
      }
    });
  }

  setupVoiceAndAnalyticsUI() {
    const voiceStartBtn = document.getElementById('voiceStartBtn');
    const voiceStopBtn = document.getElementById('voiceStopBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    const analyticsToggleBtn = document.getElementById('analyticsToggleBtn');
    const analyticsPanel = document.getElementById('analyticsPanel');
    const analyticsCloseBtn = document.getElementById('analyticsCloseBtn');
    const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
    const exportAnalyticsBtn = document.getElementById('exportAnalyticsBtn');
    const resetAnalyticsBtn = document.getElementById('resetAnalyticsBtn');
    
    // Voice control handlers
    voiceStartBtn.addEventListener('click', () => {
      if (this.voiceController) {
        this.voiceController.startListening();
        voiceStartBtn.style.display = 'none';
        voiceStopBtn.style.display = 'inline-block';
        voiceStopBtn.classList.add('active');
        voiceStatus.textContent = 'Listening...';
      }
    });
    
    voiceStopBtn.addEventListener('click', () => {
      if (this.voiceController) {
        this.voiceController.stopListening();
        voiceStopBtn.style.display = 'none';
        voiceStartBtn.style.display = 'inline-block';
        voiceStopBtn.classList.remove('active');
        voiceStatus.textContent = '';
      }
    });
    
    // Voice event listeners
    this.eventBus.on('voice:result', (data) => {
      voiceStatus.textContent = `Heard: "${data.transcript}"`;
      setTimeout(() => {
        voiceStatus.textContent = 'Listening...';
      }, 3000);
    });
    
    this.eventBus.on('voice:stopped', () => {
      voiceStopBtn.style.display = 'none';
      voiceStartBtn.style.display = 'inline-block';
      voiceStopBtn.classList.remove('active');
      voiceStatus.textContent = '';
    });
    
    this.eventBus.on('voice:error', (data) => {
      voiceStatus.textContent = `Error: ${data.error}`;
      voiceStopBtn.style.display = 'none';
      voiceStartBtn.style.display = 'inline-block';
      voiceStopBtn.classList.remove('active');
    });
    
    // Analytics panel handlers
    analyticsToggleBtn.addEventListener('click', () => {
      analyticsPanel.classList.toggle('show');
      if (analyticsPanel.classList.contains('show')) {
        this.updateAnalyticsDisplay();
      }
    });
    
    analyticsCloseBtn.addEventListener('click', () => {
      analyticsPanel.classList.remove('show');
    });
    
    refreshAnalyticsBtn.addEventListener('click', () => {
      this.updateAnalyticsDisplay();
    });
    
    exportAnalyticsBtn.addEventListener('click', () => {
      if (this.analytics) {
        const metrics = this.analytics.getSessionMetrics();
        const jsonString = JSON.stringify(metrics, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
    
    resetAnalyticsBtn.addEventListener('click', () => {
      if (confirm('Reset analytics for current session? This cannot be undone.')) {
        if (this.analytics) {
          this.analytics.endSession();
          this.updateAnalyticsDisplay();
        }
      }
    });
    
    // Auto-refresh analytics every 5 seconds if panel is open
    setInterval(() => {
      if (analyticsPanel.classList.contains('show')) {
        this.updateAnalyticsDisplay();
      }
    }, 5000);
  }

  setupDrawingStyleSelector() {
    const drawingStyleSelect = document.getElementById('drawingStyleSelect');
    
    if (!drawingStyleSelect) return;
    
    // Set initial value
    drawingStyleSelect.value = this.drawingStyleManager.getCurrentStyleName();
    
    // Handle style change
    drawingStyleSelect.addEventListener('change', (e) => {
      const styleName = e.target.value;
      if (this.drawingStyleManager.setStyle(styleName)) {
        this.draw();
        this.eventBus.emit('ui:update', { 
          id: 'status', 
          content: `Drawing style changed to ${this.drawingStyleManager.getStyle().name}` 
        });
        setTimeout(() => {
          this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
        }, 2000);
      }
    });
  }

  setupTextScalingToggle() {
    const toggleBtn = document.getElementById('textScalingToggle');
    const label = document.getElementById('textScalingLabel');
    
    if (!toggleBtn || !label) return;
    
    // Set initial state
    this.updateTextScalingUI();
    
    // Handle toggle
    toggleBtn.addEventListener('click', () => {
      this.textScalingMode = this.textScalingMode === 'fixed' ? 'scaled' : 'fixed';
      this.saveTextScalingMode();
      this.updateTextScalingUI();
      this.draw();
      
      const mode = this.textScalingMode === 'fixed' ? 'Fixed Size' : 'Scaled with Zoom';
      this.eventBus.emit('ui:update', { 
        id: 'status', 
        content: `Text scaling: ${mode}` 
      });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 2000);
    });
  }

  updateTextScalingUI() {
    const toggleBtn = document.getElementById('textScalingToggle');
    const label = document.getElementById('textScalingLabel');
    
    if (!toggleBtn || !label) return;
    
    if (this.textScalingMode === 'scaled') {
      toggleBtn.classList.add('scaled');
      label.textContent = 'Scaled';
      toggleBtn.title = 'Text scales with zoom (click for fixed size)';
    } else {
      toggleBtn.classList.remove('scaled');
      label.textContent = 'Fixed';
      toggleBtn.title = 'Text stays readable (click to scale with zoom)';
    }
  }

  loadTextScalingMode() {
    const saved = localStorage.getItem('schemagraph-text-scaling');
    if (saved === 'scaled' || saved === 'fixed') {
      this.textScalingMode = saved;
    }
  }

  saveTextScalingMode() {
    localStorage.setItem('schemagraph-text-scaling', this.textScalingMode);
  }

  getTextScale() {
    // Returns the scale factor for text
    // - 'fixed' mode: always 1 (text divided by camera scale to stay same size)
    // - 'scaled' mode: text scales naturally with zoom
    return this.textScalingMode === 'fixed' ? (1 / this.camera.scale) : 1;
  }

  updateAnalyticsDisplay() {
    if (!this.analytics) return;
    
    const metrics = this.analytics.getMetrics();
    const sessionMetrics = this.analytics.getSessionMetrics();
    
    document.getElementById('sessionId').textContent = sessionMetrics.sessionId.substring(0, 8);
    document.getElementById('sessionDuration').textContent = this.formatDuration(sessionMetrics.duration);
    document.getElementById('totalEvents').textContent = sessionMetrics.events;
    
    document.getElementById('nodesCreated').textContent = metrics.nodeCreated;
    document.getElementById('nodesDeleted').textContent = metrics.nodeDeleted;
    document.getElementById('linksCreated').textContent = metrics.linkCreated;
    document.getElementById('linksDeleted').textContent = metrics.linkDeleted;
    
    document.getElementById('schemasRegistered').textContent = metrics.schemaRegistered;
    document.getElementById('schemasRemoved').textContent = metrics.schemaRemoved;
    
    document.getElementById('graphsExported').textContent = metrics.graphExported;
    document.getElementById('graphsImported').textContent = metrics.graphImported;
    document.getElementById('configsExported').textContent = metrics.configExported;
    document.getElementById('configsImported').textContent = metrics.configImported;
    
    document.getElementById('totalInteractions').textContent = metrics.interactions;
    document.getElementById('layoutsApplied').textContent = metrics.layoutApplied;
    document.getElementById('errorCount').textContent = metrics.errors;
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  setupVoiceCommands() {
    this.eventBus.on('voice:result', (data) => {
      const transcript = data.transcript.toLowerCase().trim();
      console.log('Voice command received:', transcript);
      
      // Create node commands
      if (transcript.includes('create') || transcript.includes('add')) {
        if (transcript.includes('string')) {
          this.executeVoiceCommand('create', 'Native.String');
        } else if (transcript.includes('integer') || transcript.includes('number')) {
          this.executeVoiceCommand('create', 'Native.Integer');
        } else if (transcript.includes('boolean')) {
          this.executeVoiceCommand('create', 'Native.Boolean');
        } else if (transcript.includes('float')) {
          this.executeVoiceCommand('create', 'Native.Float');
        } else if (transcript.includes('list')) {
          this.executeVoiceCommand('create', 'Native.List');
        } else if (transcript.includes('dict') || transcript.includes('dictionary')) {
          this.executeVoiceCommand('create', 'Native.Dict');
        } else if (transcript.includes('node')) {
          this.showContextMenu(null, 0, 0, { clientX: this.canvas.width / 2, clientY: this.canvas.height / 2 });
        }
      }
      // Delete commands
      else if (transcript.includes('delete') || transcript.includes('remove')) {
        if (this.selectedNode) {
          this.executeVoiceCommand('delete');
        } else {
          this.showError('No node selected');
        }
      }
      // Export/Import commands
      else if (transcript.includes('export')) {
        if (transcript.includes('config')) {
          this.executeVoiceCommand('export-config');
        } else {
          this.executeVoiceCommand('export-graph');
        }
      }
      else if (transcript.includes('import')) {
        if (transcript.includes('config')) {
          this.executeVoiceCommand('import-config');
        } else {
          this.executeVoiceCommand('import-graph');
        }
      }
      // View commands
      else if (transcript.includes('center') || transcript.includes('focus')) {
        this.executeVoiceCommand('center-view');
      }
      else if (transcript.includes('zoom')) {
        if (transcript.includes('in')) {
          this.executeVoiceCommand('zoom-in');
        } else if (transcript.includes('out')) {
          this.executeVoiceCommand('zoom-out');
        } else if (transcript.includes('reset')) {
          this.executeVoiceCommand('reset-zoom');
        }
      }
      // Layout commands
      else if (transcript.includes('layout')) {
        if (transcript.includes('hierarchical') || transcript.includes('hierarchy')) {
          if (transcript.includes('horizontal')) {
            this.executeVoiceCommand('layout', 'hierarchical-horizontal');
          } else {
            this.executeVoiceCommand('layout', 'hierarchical-vertical');
          }
        } else if (transcript.includes('force')) {
          this.executeVoiceCommand('layout', 'force-directed');
        } else if (transcript.includes('grid')) {
          this.executeVoiceCommand('layout', 'grid');
        } else if (transcript.includes('circular') || transcript.includes('circle')) {
          this.executeVoiceCommand('layout', 'circular');
        }
      }
      // Theme commands
      else if (transcript.includes('theme') || transcript.includes('color')) {
        this.executeVoiceCommand('cycle-theme');
      }
      // Help command
      else if (transcript.includes('help') || transcript.includes('commands')) {
        this.showVoiceHelp();
      }
      // Layout commands
      else if (transcript.includes('layout')) {
        if (transcript.includes('hierarchical') || transcript.includes('hierarchy')) {
          if (transcript.includes('horizontal')) {
            this.executeVoiceCommand('layout', 'hierarchical-horizontal');
          } else {
            this.executeVoiceCommand('layout', 'hierarchical-vertical');
          }
        } else if (transcript.includes('force')) {
          this.executeVoiceCommand('layout', 'force-directed');
        } else if (transcript.includes('grid')) {
          this.executeVoiceCommand('layout', 'grid');
        } else if (transcript.includes('circular') || transcript.includes('circle')) {
          this.executeVoiceCommand('layout', 'circular');
        }
      }
      // Unknown command
      else {
        this.showError('Unknown voice command: ' + transcript);
      }
    });
  }

  executeVoiceCommand(command, param = null) {
    console.log('Executing voice command:', command, param);
    
    switch (command) {
      case 'create':
        if (param && this.graph.nodeTypes[param]) {
          const node = this.graph.createNode(param);
          const centerX = (-this.camera.x + this.canvas.width / 2) / this.camera.scale;
          const centerY = (-this.camera.y + this.canvas.height / 2) / this.camera.scale;
          node.pos = [centerX - 90, centerY - 40];
          this.draw();
          this.eventBus.emit('ui:update', { id: 'status', content: 'Created ' + param + ' node' });
        }
        break;
        
      case 'delete':
        if (this.selectedNode) {
          const nodeName = this.selectedNode.title;
          this.removeNode(this.selectedNode);
          this.eventBus.emit('ui:update', { id: 'status', content: 'Deleted ' + nodeName });
        }
        break;
        
      case 'export-graph':
        this.exportGraph();
        break;
        
      case 'export-config':
        this.exportConfig();
        break;
        
      case 'import-graph':
        this.uiController.get('importFile').click();
        break;
        
      case 'import-config':
        this.uiController.get('importConfigFile').click();
        break;
        
      case 'center-view':
        this.centerView();
        this.eventBus.emit('ui:update', { id: 'status', content: 'Centered view' });
        break;
        
      case 'zoom-in':
        const beforeIn = this.screenToWorld(this.canvas.width / 2, this.canvas.height / 2);
        this.camera.scale *= 1.2;
        this.camera.scale = Math.min(5, this.camera.scale);
        const afterIn = this.screenToWorld(this.canvas.width / 2, this.canvas.height / 2);
        this.camera.x += (afterIn[0] - beforeIn[0]) * this.camera.scale;
        this.camera.y += (afterIn[1] - beforeIn[1]) * this.camera.scale;
        this.eventBus.emit('ui:update', { id: 'zoomLevel', content: Math.round(this.camera.scale * 100) + '%' });
        this.draw();
        break;
        
      case 'zoom-out':
        const beforeOut = this.screenToWorld(this.canvas.width / 2, this.canvas.height / 2);
        this.camera.scale *= 0.8;
        this.camera.scale = Math.max(0.1, this.camera.scale);
        const afterOut = this.screenToWorld(this.canvas.width / 2, this.canvas.height / 2);
        this.camera.x += (afterOut[0] - beforeOut[0]) * this.camera.scale;
        this.camera.y += (afterOut[1] - beforeOut[1]) * this.camera.scale;
        this.eventBus.emit('ui:update', { id: 'zoomLevel', content: Math.round(this.camera.scale * 100) + '%' });
        this.draw();
        break;
        
      case 'reset-zoom':
        this.resetZoom();
        this.eventBus.emit('ui:update', { id: 'status', content: 'Reset zoom to 100%' });
        break;
        
      case 'layout':
        if (param) {
          this.applyLayout(param);
          this.eventBus.emit('ui:update', { id: 'status', content: 'Applied ' + param + ' layout' });
        }
        break;
        
      case 'cycle-theme':
        this.cycleTheme();
        this.eventBus.emit('ui:update', { id: 'status', content: 'Changed theme' });
        break;
        
      default:
        console.warn('Unknown command:', command);
    }
  }

  showVoiceHelp() {
    const helpMessage = `Voice Commands:
  - "Create [string/integer/boolean/float/list/dict]" - Create native node
  - "Delete" - Delete selected node
  - "Export [graph/config]" - Export graph or config
  - "Center" or "Focus" - Center view
  - "Zoom [in/out/reset]" - Control zoom
  - "Layout [hierarchical/grid/circular/force]" - Apply layout
  - "Theme" - Change theme
  - "Help" - Show this message`;
    
    alert(helpMessage);
  }

  loadTheme() {
    const saved = localStorage.getItem('schemagraph-theme') || 'dark';
    this.currentThemeIndex = this.themes.indexOf(saved);
    if (this.currentThemeIndex === -1) this.currentThemeIndex = 0;
    this.applyTheme(this.themes[this.currentThemeIndex]);
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  cycleTheme() {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
    const newTheme = this.themes[this.currentThemeIndex];
    this.applyTheme(newTheme);
    localStorage.setItem('schemagraph-theme', newTheme);
    this.draw();
  }

  registerNativeNodes() {
    const nativeNodes = [
      { name: 'String', type: 'str', defaultValue: '', parser: (v) => v },
      { name: 'Integer', type: 'int', defaultValue: 0, parser: (v) => parseInt(v) || 0 },
      { name: 'Boolean', type: 'bool', defaultValue: false, parser: (v) => v === true || v === 'true' },
      { name: 'Float', type: 'float', defaultValue: 0.0, parser: (v) => parseFloat(v) || 0.0 },
      { name: 'List', type: 'List[Any]', defaultValue: '[]', parser: (v) => {
        try { return JSON.parse(v); } catch (e) { return []; }
      }},
      { name: 'Dict', type: 'Dict[str,Any]', defaultValue: '{}', parser: (v) => {
        try { return JSON.parse(v); } catch (e) { return {}; }
      }},
    ];

    for (const nodeSpec of nativeNodes) {
      class NativeNode extends LNode {
        constructor() {
          super(nodeSpec.name);
          this.addOutput('value', nodeSpec.type);
          this.properties.value = nodeSpec.defaultValue;
          this.size = [180, 80];
          this.isNative = true;
        }

        onExecute() {
          this.setOutputData(0, nodeSpec.parser(this.properties.value));
        }
      }

      this.graph.nodeTypes['Native.' + nodeSpec.name] = NativeNode;
    }
  }

  selectNode(node, addToSelection = false) {
    if (!addToSelection) {
      this.selectedNodes.clear();
    }
    
    if (node) {
      this.selectedNodes.add(node);
      this.selectedNode = node; // Keep last selected for compatibility
    }
    
    this.draw();
  }

  deselectNode(node) {
    this.selectedNodes.delete(node);
    if (this.selectedNode === node) {
      this.selectedNode = this.selectedNodes.size > 0 ? 
        Array.from(this.selectedNodes)[this.selectedNodes.size - 1] : null;
    }
    this.draw();
  }

  toggleNodeSelection(node) {
    if (this.selectedNodes.has(node)) {
      this.deselectNode(node);
    } else {
      this.selectNode(node, true);
    }
  }

  clearSelection() {
    this.selectedNodes.clear();
    this.selectedNode = null;
    this.draw();
  }

  isNodeSelected(node) {
    return this.selectedNodes.has(node);
  }

  deleteSelectedNodes() {
    const nodesToDelete = Array.from(this.selectedNodes);
    for (const node of nodesToDelete) {
      this.removeNode(node);
    }
    this.clearSelection();
  }

  // Mouse/Touch handlers
  handleMouseDown(data) {
    this.isMouseDown = true;
    this.uiController.get('contextMenu').classList.remove('show');
    
    const [wx, wy] = this.screenToWorld(data.coords.screenX, data.coords.screenY);
    
    if (data.button === 1 || (data.button === 0 && this.spacePressed)) {
      data.event.preventDefault();
      this.isPanning = true;
      this.panStart = [data.coords.screenX - this.camera.x, data.coords.screenY - this.camera.y];
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    
    if (data.button !== 0 || this.spacePressed) return;
    
    // Check for output slot drag
    for (const node of this.graph.nodes) {
      for (let j = 0; j < node.outputs.length; j++) {
        const slotY = node.pos[1] + 30 + j * 25;
        const dist = Math.sqrt(Math.pow(wx - (node.pos[0] + node.size[0]), 2) + Math.pow(wy - slotY, 2));
        if (dist < 10) {
          this.connecting = { node, slot: j, isOutput: true };
          this.canvas.classList.add('connecting');
          return;
        }
      }
    }
    
    // Check for input slot drag
    for (const node of this.graph.nodes) {
      for (let j = 0; j < node.inputs.length; j++) {
        const slotY = node.pos[1] + 30 + j * 25;
        const dist = Math.sqrt(Math.pow(wx - node.pos[0], 2) + Math.pow(wy - slotY, 2));
        if (dist < 10) {
          if (!node.multiInputs || !node.multiInputs[j]) {
            if (node.inputs[j].link) {
              this.removeLink(node.inputs[j].link, node, j);
            }
          }
          this.connecting = { node, slot: j, isOutput: false };
          this.canvas.classList.add('connecting');
          return;
        }
      }
    }
    
    // Check for node selection/drag
    let clickedNode = null;
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i];
      if (wx >= node.pos[0] && wx <= node.pos[0] + node.size[0] &&
          wy >= node.pos[1] && wy <= node.pos[1] + node.size[1]) {
        clickedNode = node;
        break;
      }
    }
    
    if (clickedNode) {
      // Multi-select with Ctrl/Cmd key
      if (data.event.ctrlKey || data.event.metaKey) {
        this.toggleNodeSelection(clickedNode);
      } else {
        // If clicking an already selected node, prepare to drag all selected
        if (!this.selectedNodes.has(clickedNode)) {
          this.selectNode(clickedNode, false);
        }
        this.dragNode = clickedNode;
        this.dragOffset = [wx - clickedNode.pos[0], wy - clickedNode.pos[1]];
        this.canvas.classList.add('dragging');
      }
      return;
    }
    
    // Clicked on empty space - prepare for selection rectangle or clear selection
    if (!data.event.ctrlKey && !data.event.metaKey) {
      this.clearSelection();
    }
    // Store potential selection start (will only create rect if mouse moves)
    this.selectionStart = [wx, wy];
  }

  handleMouseMove(data) {
    this.mousePos = [data.coords.screenX, data.coords.screenY];
    
    if (this.isPanning) {
      this.camera.x = data.coords.screenX - this.panStart[0];
      this.camera.y = data.coords.screenY - this.panStart[1];
      this.draw();
    } else if (this.dragNode && !this.connecting) {
      const [wx, wy] = this.screenToWorld(data.coords.screenX, data.coords.screenY);
      const dx = wx - this.dragOffset[0] - this.dragNode.pos[0];
      const dy = wy - this.dragOffset[1] - this.dragNode.pos[1];
      
      // Move all selected nodes together
      for (const node of this.selectedNodes) {
        node.pos[0] += dx;
        node.pos[1] += dy;
      }
      
      this.draw();
    } else if (this.connecting) {
      this.draw();
    } else if (this.selectionStart && this.isMouseDown) {
      // Draw selection rectangle only if mouse is down and dragging
      const [wx, wy] = this.screenToWorld(data.coords.screenX, data.coords.screenY);
      const dx = Math.abs(wx - this.selectionStart[0]);
      const dy = Math.abs(wy - this.selectionStart[1]);
      
      // Only show selection rect if moved at least 5 pixels (prevents accidental rect on click)
      if (dx > 5 || dy > 5) {
        this.selectionRect = {
          x: Math.min(this.selectionStart[0], wx),
          y: Math.min(this.selectionStart[1], wy),
          w: dx,
          h: dy
        };
      }
      this.draw();
    } else {
      // Redraw to update hover effects on editable fields
      this.draw();
    }
  }

  handleMouseUp(data) {
    this.isMouseDown = false;
    const [wx, wy] = this.screenToWorld(data.coords.screenX, data.coords.screenY);
    
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spacePressed ? 'grab' : 'default';
      return;
    }
    
    if (this.connecting) {
      // Handle connection logic
      for (const node of this.graph.nodes) {
        if (this.connecting.isOutput) {
          // Connecting from output to input
          for (let j = 0; j < node.inputs.length; j++) {
            const slotY = node.pos[1] + 30 + j * 25;
            const dist = Math.sqrt(Math.pow(wx - node.pos[0], 2) + Math.pow(wy - slotY, 2));
            if (dist < 15 && node !== this.connecting.node) {
              if (!this.isSlotCompatible(node, j, false)) {
                this.showError('Type mismatch');
                break;
              }
              
              if (node.multiInputs && node.multiInputs[j]) {
                const linkId = ++this.graph.last_link_id;
                const link = new LLink(
                  linkId,
                  this.connecting.node.id,
                  this.connecting.slot,
                  node.id,
                  j,
                  this.connecting.node.outputs[this.connecting.slot].type
                );
                this.graph.links[linkId] = link;
                this.connecting.node.outputs[this.connecting.slot].links.push(linkId);
                node.multiInputs[j].links.push(linkId);
                this.eventBus.emit('link:created', { linkId });
              } else {
                if (node.inputs[j].link) {
                  this.removeLink(node.inputs[j].link, node, j);
                }
                const link = this.graph.connect(this.connecting.node, this.connecting.slot, node, j);
                if (link) this.eventBus.emit('link:created', { linkId: link.id });
              }
              break;
            }
          }
        } else {
          // Connecting from input to output
          for (let j = 0; j < node.outputs.length; j++) {
            const slotY = node.pos[1] + 30 + j * 25;
            const dist = Math.sqrt(Math.pow(wx - (node.pos[0] + node.size[0]), 2) + Math.pow(wy - slotY, 2));
            if (dist < 15 && node !== this.connecting.node) {
              if (!this.isSlotCompatible(node, j, true)) {
                this.showError('Type mismatch');
                break;
              }
              
              if (this.connecting.node.multiInputs && this.connecting.node.multiInputs[this.connecting.slot]) {
                const linkId = ++this.graph.last_link_id;
                const link = new LLink(
                  linkId,
                  node.id,
                  j,
                  this.connecting.node.id,
                  this.connecting.slot,
                  node.outputs[j].type
                );
                this.graph.links[linkId] = link;
                node.outputs[j].links.push(linkId);
                this.connecting.node.multiInputs[this.connecting.slot].links.push(linkId);
                this.eventBus.emit('link:created', { linkId });
              } else {
                if (this.connecting.node.inputs[this.connecting.slot].link) {
                  this.removeLink(this.connecting.node.inputs[this.connecting.slot].link, 
                                  this.connecting.node, this.connecting.slot);
                }
                const link = this.graph.connect(node, j, this.connecting.node, this.connecting.slot);
                if (link) this.eventBus.emit('link:created', { linkId: link.id });
              }
              break;
            }
          }
        }
      }
      
      this.connecting = null;
      this.canvas.classList.remove('connecting');
      this.draw();
      return;
    }
    
// Handle selection rectangle
    if (this.selectionStart && this.selectionRect) {
      const rect = this.selectionRect;
      
      // Don't clear existing selection if Ctrl/Cmd is held
      if (!data.event.ctrlKey && !data.event.metaKey) {
        this.clearSelection();
      }
      
      // Select all nodes within rectangle (always add to selection)
      for (const node of this.graph.nodes) {
        const nodeRect = {
          x: node.pos[0],
          y: node.pos[1],
          w: node.size[0],
          h: node.size[1]
        };
        
        // Check if node intersects with selection rectangle
        if (!(nodeRect.x > rect.x + rect.w ||
              nodeRect.x + nodeRect.w < rect.x ||
              nodeRect.y > rect.y + rect.h ||
              nodeRect.y + nodeRect.h < rect.y)) {
          this.selectNode(node, true); // Always ADD to selection when in rect
        }
      }
    }
    
    // Always clear selection rectangle state on mouse up
    this.selectionStart = null;
    this.selectionRect = null;
    
    // Clear drag state
    this.dragNode = null;
    this.canvas.classList.remove('dragging');
    
    this.draw();
  }

  handleDoubleClick(data) {
    const [wx, wy] = this.screenToWorld(data.coords.screenX, data.coords.screenY);
    
    // Check for native input editing
    for (const node of this.graph.nodes) {
      if (node.nativeInputs) {
        for (let j = 0; j < node.inputs.length; j++) {
          if (!node.inputs[j].link && node.nativeInputs[j] !== undefined) {
            const slotY = node.pos[1] + 30 + j * 25;
            const boxX = node.pos[0] + node.size[0] - 70;
            const boxY = slotY - 8;
            const boxW = 65;
            const boxH = 16;
            
            if (wx >= boxX && wx <= boxX + boxW && wy >= boxY && wy <= boxY + boxH) {
              if (node.nativeInputs[j].type === 'bool') {
                node.nativeInputs[j].value = !node.nativeInputs[j].value;
                this.draw();
                return;
              }
              
              this.showInputOverlay(node, j, boxX, boxY, data.coords.rect);
              return;
            }
          }
        }
      }
    }
    
    // Check for native node value editing
    for (const node of this.graph.nodes) {
      if (!node.isNative) continue;
      const valueY = node.pos[1] + node.size[1] - 18;
      const valueHeight = 20;
      
      if (wx >= node.pos[0] + 8 && wx <= node.pos[0] + node.size[0] - 8 &&
          wy >= valueY && wy <= valueY + valueHeight) {
        if (node.title === 'Boolean') {
          node.properties.value = !node.properties.value;
          this.draw();
        } else {
          this.showInputOverlay(node, null, node.pos[0] + 8, valueY, data.coords.rect);
        }
        return;
      }
    }
  }

  showInputOverlay(node, slot, x, y, rect) {
    const valueScreen = this.worldToScreen(x, y);
    this.editingNode = node;
    this.editingNode.editingSlot = slot;
    
    const nodeInput = this.uiController.get('nodeInput');
    if (slot !== null) {
      nodeInput.value = String(node.nativeInputs[slot].value);
    } else {
      nodeInput.value = String(node.properties.value);
    }
    
    nodeInput.style.left = (valueScreen[0] * rect.width / this.canvas.width + rect.left) + 'px';
    nodeInput.style.top = (valueScreen[1] * rect.height / this.canvas.height + rect.top) + 'px';
    nodeInput.style.width = (slot !== null ? '75px' : '160px');
    nodeInput.classList.add('show');
    nodeInput.focus();
    nodeInput.select();
  }

  handleWheel(data) {
    const before = this.screenToWorld(data.coords.screenX, data.coords.screenY);
    this.camera.scale *= data.delta > 0 ? 0.9 : 1.1;
    this.camera.scale = Math.max(0.1, Math.min(5, this.camera.scale));
    const after = this.screenToWorld(data.coords.screenX, data.coords.screenY);
    this.camera.x += (after[0] - before[0]) * this.camera.scale;
    this.camera.y += (after[1] - before[1]) * this.camera.scale;
    
    this.eventBus.emit('ui:update', { 
      id: 'zoomLevel', 
      content: Math.round(this.camera.scale * 100) + '%' 
    });
    this.draw();
  }

  handleContextMenu(data) {
    const [wx, wy] = this.screenToWorld(data.coords.screenX, data.coords.screenY);
    
    let clickedNode = null;
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i];
      if (wx >= node.pos[0] && wx <= node.pos[0] + node.size[0] &&
          wy >= node.pos[1] && wy <= node.pos[1] + node.size[1]) {
        clickedNode = node;
        break;
      }
    }
    
    this.showContextMenu(clickedNode, wx, wy, data.coords);
  }

  showContextMenu(node, wx, wy, coords) {
    const contextMenu = this.uiController.get('contextMenu');
    let html = '';
    
    if (node) {
      console.log('📋 Opening context menu for node:', node.title);
      const selectionCount = this.selectedNodes.size;
      
      html += '<div class="context-menu-category">Node Actions</div>';
      
      if (selectionCount > 1) {
        html += '<div class="context-menu-item context-menu-delete" data-action="delete-all">❌ Delete ' + selectionCount + ' Nodes</div>';
      } else {
        html += '<div class="context-menu-item context-menu-delete" data-action="delete">❌ Delete Node</div>';
      }
      
      // Check if node has multi-input slots with connections
      let hasMultiInputs = false;
      let multiInputCount = 0;
      if (node.multiInputs) {
        console.log('   Checking multiInputs:', Object.keys(node.multiInputs));
        for (const slotIdx in node.multiInputs) {
          if (node.multiInputs.hasOwnProperty(slotIdx)) {
            const links = node.multiInputs[slotIdx].links;
            console.log(`   Slot ${slotIdx} (${node.inputs[slotIdx]?.name}):`, links ? links.length : 0, 'links');
            if (links && links.length > 0) {
              hasMultiInputs = true;
              multiInputCount += links.length;
            }
          }
        }
      } else {
        console.log('   No multiInputs property on this node');
      }
      
      console.log('   hasMultiInputs:', hasMultiInputs, 'total count:', multiInputCount);
      
      if (hasMultiInputs) {
        html += '<div class="context-menu-item" data-action="clear-multi-inputs">🗑️ Clear ' + multiInputCount + ' Multi-Input Link(s)</div>';
      }
      
      contextMenu.innerHTML = html;
      contextMenu.style.left = coords.clientX + 'px';
      contextMenu.style.top = coords.clientY + 'px';
      contextMenu.classList.add('show');
      
      const deleteBtn = contextMenu.querySelector('.context-menu-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (this.selectedNodes.size > 1) {
            this.deleteSelectedNodes();
          } else {
            this.removeNode(node);
          }
          contextMenu.classList.remove('show');
        });
      }
      
      if (hasMultiInputs) {
        const clearBtn = contextMenu.querySelector('[data-action="clear-multi-inputs"]');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            console.log('🗑️ Clear multi-inputs clicked');
            this.clearAllMultiInputLinks(node);
            contextMenu.classList.remove('show');
          });
        }
      }
    } else {
      // Canvas context menu (rest remains the same)
      html += '<div class="context-menu-category">Native Types</div>';
      const natives = ['Native.String', 'Native.Integer', 'Native.Boolean', 'Native.Float', 'Native.List', 'Native.Dict'];
      for (const nativeType of natives) {
        const name = nativeType.split('.')[1];
        html += '<div class="context-menu-item" data-type="' + nativeType + '">' + name + '</div>';
      }
      
      const registeredSchemas = Object.keys(this.graph.schemas);
      for (const schemaName of registeredSchemas) {
        const schemaTypes = [];
        const schemaInfo = this.graph.schemas[schemaName];
        let rootNodeType = null;
        
        for (const type in this.graph.nodeTypes) {
          if (type.indexOf(schemaName + '.') === 0) {
            schemaTypes.push(type);
            if (schemaInfo.rootType && type === schemaName + '.' + schemaInfo.rootType) {
              rootNodeType = type;
            }
          }
        }
        
        if (schemaTypes.length > 0) {
          html += '<div class="context-menu-category">' + schemaName + ' Schema</div>';
          
          if (rootNodeType) {
            const name = rootNodeType.split('.')[1];
            html += '<div class="context-menu-item" data-type="' + rootNodeType + '" style="font-weight: bold; color: var(--accent-orange);">★ ' + name + ' (Root)</div>';
          }
          
          for (const schemaType of schemaTypes) {
            if (schemaType !== rootNodeType) {
              const name = schemaType.split('.')[1];
              html += '<div class="context-menu-item" data-type="' + schemaType + '">' + name + '</div>';
            }
          }
        }
      }
      
      contextMenu.innerHTML = html;
      contextMenu.style.left = coords.clientX + 'px';
      contextMenu.style.top = coords.clientY + 'px';
      contextMenu.classList.add('show');
      contextMenu.dataset.worldX = wx;
      contextMenu.dataset.worldY = wy;
      
      const items = contextMenu.querySelectorAll('.context-menu-item');
      for (const item of items) {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-type');
          const wx = parseFloat(contextMenu.dataset.worldX);
          const wy = parseFloat(contextMenu.dataset.worldY);
          const node = this.graph.createNode(type);
          node.pos = [wx - 90, wy - 40];
          contextMenu.classList.remove('show');
          this.draw();
        });
      }
    }
  }

  // Keyboard handlers
  handleKeyDown(data) {
    if (data.code === 'Space' && !this.spacePressed && !this.editingNode) {
      data.event.preventDefault();
      this.spacePressed = true;
      this.canvas.style.cursor = 'grab';
    }
    
    if ((data.key === 'Delete' || data.key === 'Backspace') && this.selectedNodes.size > 0 && !this.editingNode) {
      data.event.preventDefault();
      this.deleteSelectedNodes();
    }
    
    // Select all with Ctrl+A
    if ((data.event.ctrlKey || data.event.metaKey) && data.key === 'a' && !this.editingNode) {
      data.event.preventDefault();
      this.clearSelection();
      for (const node of this.graph.nodes) {
        this.selectNode(node, true);
      }
    }
    
    // Escape to clear selection
    if (data.key === 'Escape' && !this.editingNode) {
      this.clearSelection();
    }
    
    if ((data.event.ctrlKey || data.event.metaKey) && data.key === 's') {
      data.event.preventDefault();
      this.eventBus.emit('ui:export-graph', {});
    }
    
    if ((data.event.ctrlKey || data.event.metaKey) && data.key === 'o') {
      data.event.preventDefault();
      this.eventBus.emit('ui:import-graph', {});
    }
  }

  handleKeyUp(data) {
    if (data.code === 'Space') {
      this.spacePressed = false;
      this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'default';
    }
  }

  handleInputBlur() {
    if (this.editingNode) {
      const nodeInput = this.uiController.get('nodeInput');
      const val = nodeInput.value;
      
      if (this.editingNode.editingSlot !== null && this.editingNode.editingSlot !== undefined) {
        const slot = this.editingNode.editingSlot;
        const inputType = this.editingNode.nativeInputs[slot].type;
        
        if (inputType === 'int') {
          this.editingNode.nativeInputs[slot].value = parseInt(val) || 0;
        } else if (inputType === 'float') {
          this.editingNode.nativeInputs[slot].value = parseFloat(val) || 0.0;
        } else if (inputType === 'bool') {
          this.editingNode.nativeInputs[slot].value = val === 'true' || val === true;
        } else {
          this.editingNode.nativeInputs[slot].value = val;
        }
        
        this.editingNode.editingSlot = null;
      } else {
        if (this.editingNode.title === 'Integer') {
          this.editingNode.properties.value = parseInt(val) || 0;
        } else if (this.editingNode.title === 'Float') {
          this.editingNode.properties.value = parseFloat(val) || 0.0;
        } else if (this.editingNode.title === 'Boolean') {
          this.editingNode.properties.value = val === 'true' || val === true;
        } else {
          this.editingNode.properties.value = val;
        }
      }
      
      this.draw();
    }
    this.uiController.get('nodeInput').classList.remove('show');
    this.editingNode = null;
  }

  handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      this.uiController.get('nodeInput').blur();
    } else if (e.key === 'Escape') {
      this.uiController.get('nodeInput').classList.remove('show');
      this.editingNode = null;
    }
  }

  // File handlers
  handleSchemaFileUpload(data) {
    const reader = new FileReader();
    reader.onload = (event) => {
      this.pendingSchemaCode = event.target.result;

      const fileName = data.file.name.replace(/\.py$/, '');
      const suggestedName = fileName.charAt(0).toUpperCase() + fileName.slice(1);

      const rootTypeRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let reMatch = null;
      let rootTypeMatch = null;
      while ((reMatch = rootTypeRegex.exec(this.pendingSchemaCode)) !== null) {
        rootTypeMatch = reMatch;
      }

      const suggestedRootType = rootTypeMatch ? rootTypeMatch[1] : '';

      this.uiController.get('schemaNameInput').value = suggestedName;
      this.uiController.get('schemaIndexTypeInput').value = 'Index';
      this.uiController.get('schemaRootTypeInput').value = suggestedRootType;

      this.eventBus.emit('ui:show', { id: 'schemaDialog' });
      this.uiController.get('schemaNameInput').focus();
      this.uiController.get('schemaNameInput').select();
    };
    reader.readAsText(data.file);
    data.element.value = '';
  }

  handleImportGraph(data) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        this.graph.deserialize(jsonData, true, this.camera);
        this.updateSchemaList();
        this.updateNodeTypesList();
        this.eventBus.emit('ui:update', { 
          id: 'zoomLevel', 
          content: Math.round(this.camera.scale * 100) + '%' 
        });
        this.draw();
        this.eventBus.emit('graph:imported', {});
        this.eventBus.emit('ui:update', { id: 'status', content: 'Graph imported successfully!' });
        setTimeout(() => {
          this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
        }, 2000);
      } catch (e) {
        this.showError('Import failed: ' + e.message);
      }
    };
    reader.readAsText(data.file);
    data.element.value = '';
  }

  handleImportConfig(data) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const configData = JSON.parse(event.target.result);
        this.importConfigData(configData);
        this.eventBus.emit('config:imported', {});
      } catch (e) {
        this.showError('Import config failed: ' + e.message);
      }
    };
    reader.readAsText(data.file);
    data.element.value = '';
  }

  confirmSchemaRegistration() {
    if (!this.pendingSchemaCode) return;
    
    const schemaName = this.uiController.get('schemaNameInput').value.trim();
    const indexType = this.uiController.get('schemaIndexTypeInput').value.trim() || 'int';
    const rootType = this.uiController.get('schemaRootTypeInput').value.trim() || null;
    
    if (!schemaName) {
      this.showError('Schema name is required');
      return;
    }
    
    if (this.graph.schemas[schemaName]) {
      if (!confirm(`Schema "${schemaName}" already exists. Replace it?`)) return;
      this.graph.removeSchema(schemaName);
    }
    
    if (this.graph.registerSchema(schemaName, this.pendingSchemaCode, indexType, rootType)) {
      this.eventBus.emit('ui:hide', { id: 'schemaDialog' });
      this.pendingSchemaCode = null;
      
      if (false && rootType) {
        const rootNodeType = schemaName + '.' + rootType;
        if (this.graph.nodeTypes[rootNodeType]) {
          const createRootNode = confirm(`Schema registered! Create root node (${rootType})?`);
          if (createRootNode) {
            const node = this.graph.createNode(rootNodeType);
            node.pos = [100, 100];
            this.draw();
          }
        }
      }
      
      this.eventBus.emit('ui:update', { 
        id: 'status', 
        content: `Schema "${schemaName}" registered successfully!` 
      });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 3000);
    } else {
      this.showError('Failed to register schema. Check console.');
    }
  }

  cancelSchemaRegistration() {
    this.eventBus.emit('ui:hide', { id: 'schemaDialog' });
    this.pendingSchemaCode = null;
  }

  confirmSchemaRemoval() {
    const schemaName = this.uiController.get('schemaRemovalNameInput').value;
    if (!schemaName) {
      this.showError('Please select a schema');
      return;
    }
    
    if (this.graph.removeSchema(schemaName)) {
      this.eventBus.emit('ui:hide', { id: 'schemaRemovalDialog' });
      this.eventBus.emit('ui:update', { 
        id: 'status', 
        content: `Schema "${schemaName}" removed successfully` 
      });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 2000);
    } else {
      this.showError('Failed to remove schema: ' + schemaName);
    }
  }

  cancelSchemaRemoval() {
    this.eventBus.emit('ui:hide', { id: 'schemaRemovalDialog' });
  }

  // Export/Import
  exportGraph() {
    try {
      const data = this.graph.serialize(true, this.camera);
      const jsonString = JSON.stringify(data, null, 2);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schemagraph-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.eventBus.emit('graph:exported', {});
      this.eventBus.emit('ui:update', { id: 'status', content: 'Graph exported successfully!' });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 2000);
    } catch (e) {
      this.showError('Export failed: ' + e.message);
    }
  }

  exportConfig() {
    try {
      const schemas = Object.keys(this.graph.schemas);
      if (schemas.length === 0) {
        this.showError('No schemas registered');
        return;
      }

      let targetSchema = null;
      for (const schemaName of schemas) {
        const info = this.graph.schemas[schemaName];
        if (info && info.rootType) {
          targetSchema = schemaName;
          break;
        }
      }

      if (!targetSchema) targetSchema = schemas[0];

      const config = this.buildConfig(targetSchema);
      const jsonString = JSON.stringify(config, null, 2);

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'config-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.eventBus.emit('config:exported', {});
      this.eventBus.emit('ui:update', { id: 'status', content: 'Config exported successfully!' });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 2000);
    } catch (e) {
      this.showError('Export config failed: ' + e.message);
    }
  }

  buildConfig(schemaName) {
    const schemaInfo = this.graph.schemas[schemaName];
    const config = {};
    const nodesByType = {};
    const nodeToIndex = new Map();
    
    let fieldMapping = schemaInfo.fieldMapping;
  
    for (const node of this.graph.nodes) {
      if (node.schemaName !== schemaName) continue;
      if (!nodesByType[node.modelName]) {
        nodesByType[node.modelName] = [];
      }
      const index = nodesByType[node.modelName].length;
      nodesByType[node.modelName].push(node);
      nodeToIndex.set(node, { modelName: node.modelName, index });
    }
  
    for (const modelName in nodesByType) {
      const nodes = nodesByType[modelName];
      const fieldName = fieldMapping.modelToField[modelName];
      
      config[fieldName] = [];
      for (const node of nodes) {
        node.onExecute();
        const nodeData = node.outputs[0].value || {};
        const processedData = this.processNodeDataWithIndices(nodeData, nodeToIndex, fieldMapping);
        config[fieldName].push(processedData);
      }
    }
  
    return config;
  }

  processNodeDataWithIndices(data, nodeToIndex, fieldMapping) {
    const result = {};
    
    for (const key in data) {
      if (!data.hasOwnProperty(key)) continue;
      const value = data[key];
  
      if (Array.isArray(value)) {
        result[key] = value.map(v => this.valueToIndexOrData(v, nodeToIndex));
      } else {
        result[key] = this.valueToIndexOrData(value, nodeToIndex);
      }
    }
    
    return result;
  }

  valueToIndexOrData(value, nodeToIndex) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value;
    
    for (const [node, info] of nodeToIndex.entries()) {
      if (node.outputs && node.outputs[0] && node.outputs[0].value === value) {
        return info.index;
      }
    }
    
    if (typeof value === 'string') {
      if ((value.startsWith('{') && value.endsWith('}')) || 
          (value.startsWith('[') && value.endsWith(']'))) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    }
    
    const processed = {};
    for (const k in value) {
      if (value.hasOwnProperty(k)) {
        processed[k] = this.valueToIndexOrData(value[k], nodeToIndex);
      }
    }
    
    return processed;
  }

  importConfigData(configData, schemaName = null) {
    console.log('=== IMPORT CONFIG STARTED ===');
    console.log('Config data:', configData);
    
    const schemas = this.graph.getRegisteredSchemas();
    if (schemas.length === 0) {
      this.showError('No schemas registered. Upload a schema first.');
      return;
    }

    let targetSchema = schemaName;
    if (!targetSchema) {
      for (const schema of schemas) {
        const info = this.graph.getSchemaInfo(schema);
        if (info && info.rootType) {
          targetSchema = schema;
          break;
        }
      }
    }

    if (!targetSchema) {
      targetSchema = schemas[0];
    }

    console.log('Target schema:', targetSchema);
    const schemaInfo = this.graph.schemas[targetSchema];
    
    let fieldMapping = schemaInfo.fieldMapping;
    if (!fieldMapping) {
      console.log('Generating field mapping for schema:', targetSchema);
      fieldMapping = this.graph._createFieldMappingFromSchema(schemaInfo.code, schemaInfo.parsed, schemaInfo.rootType);
      schemaInfo.fieldMapping = fieldMapping;
    }

    console.log('Field mapping:', fieldMapping);

    this.graph.nodes = [];
    this.graph.links = {};
    this.graph._nodes_by_id = {};
    this.graph.last_link_id = 0;

    const createdNodes = {};
    const allNodesForField = {}; // Track ALL nodes for each field, including embedded
    let xOffset = 50;
    const yOffset = 100;
    const xSpacing = 250;

    // First pass: create top-level nodes
    for (const fieldName in configData) {
      if (!configData.hasOwnProperty(fieldName)) continue;
      const items = configData[fieldName];
      
      const modelName = fieldMapping.fieldToModel[fieldName];
      console.log('📦 Field:', fieldName, '→ Model:', modelName);
      
      if (!modelName) {
        console.warn('⚠️ Unknown field name:', fieldName, '- cannot map to model type');
        continue;
      }
      
      const nodeType = targetSchema + '.' + modelName;
      console.log('   Node type:', nodeType);

      if (!this.graph.nodeTypes[nodeType]) {
        console.warn('⚠️ Node type not found:', nodeType);
        continue;
      }

      if (!createdNodes[fieldName]) {
        createdNodes[fieldName] = [];
      }
      
      if (!allNodesForField[fieldName]) {
        allNodesForField[fieldName] = [];
      }

      const isListField = Array.isArray(items);
      
      if (isListField) {
        console.log('   Creating', items.length, 'nodes for list field');
        for (let i = 0; i < items.length; i++) {
          const node = this.graph.createNode(nodeType);
          node.pos = [xOffset, yOffset + i * 150];
          createdNodes[fieldName].push(node);
          allNodesForField[fieldName].push(node);
          console.log('   ✓ Created', nodeType, 'at index', i, '- node ID:', node.id);
        }
      } else {
        console.log('   Creating 1 node for single field');
        const node = this.graph.createNode(nodeType);
        node.pos = [xOffset, yOffset];
        createdNodes[fieldName].push(node);
        allNodesForField[fieldName].push(node);
        console.log('   ✓ Created', nodeType, '- node ID:', node.id);
      }

      xOffset += xSpacing;
    }
    
    console.log('📦 Top-level node creation complete');
    console.log('   Created nodes for fields:', Object.keys(createdNodes).join(', '));
    for (const fieldName in allNodesForField) {
      if (allNodesForField.hasOwnProperty(fieldName)) {
        const nodeIds = allNodesForField[fieldName].map(n => n.id).join(', ');
        console.log('   ', fieldName + ':', allNodesForField[fieldName].length, 'nodes - IDs:', nodeIds);
      }
    }

    // Second pass: populate nodes with data (this may create embedded nodes)
    const nodesBefore = this.graph.nodes.length;
    
    for (const fieldName in configData) {
      if (!configData.hasOwnProperty(fieldName)) continue;
      const items = configData[fieldName];
      const isListField = Array.isArray(items);
      
      if (isListField) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const node = createdNodes[fieldName][i];
          this.populateNodeFromConfig(node, item, createdNodes, fieldMapping);
        }
      } else {
        if (createdNodes[fieldName] && createdNodes[fieldName][0]) {
          const node = createdNodes[fieldName][0];
          if (typeof items === 'number') {
            console.log('Single field with index reference:', fieldName, '→', items);
          } else if (typeof items === 'object' && items !== null) {
            this.populateNodeFromConfig(node, items, createdNodes, fieldMapping);
          }
        }
      }
    }
    
    const nodesAfter = this.graph.nodes.length;
    console.log('Nodes created during population:', nodesAfter - nodesBefore, '(embedded nodes)');

    // Third pass: create root type node if applicable
    if (schemaInfo && schemaInfo.rootType) {
      const rootNodeType = targetSchema + '.' + schemaInfo.rootType;
      if (this.graph.nodeTypes[rootNodeType]) {
        const rootNode = this.graph.createNode(rootNodeType);
        rootNode.pos = [-300, yOffset];
        console.log('Created root node:', rootNodeType, 'at', rootNode.pos);
        
        // Connect root node to all field nodes
        console.log('🔗 Connecting root node to field nodes...');
        console.log('   Root node has', rootNode.inputs.length, 'inputs');
        console.log('   Config has', Object.keys(configData).length, 'fields');
        
        for (const fieldName in configData) {
          if (!configData.hasOwnProperty(fieldName)) continue;
          
          console.log('');
          console.log('🔌 Processing field:', fieldName);
          
          // Find the input slot for this field
          const inputIdx = rootNode.inputs.findIndex(inp => inp.name === fieldName);
          if (inputIdx === -1) {
            console.warn('⚠️ No input slot found on root node for field:', fieldName);
            console.warn('   Available inputs:', rootNode.inputs.map(inp => inp.name).join(', '));
            continue;
          }
          
          console.log('   ✓ Found input slot:', inputIdx, '(type:', rootNode.inputs[inputIdx].type + ')');
          
          const items = configData[fieldName];
          const isListField = Array.isArray(items);
          
          console.log('   Value is', isListField ? 'array with ' + items.length + ' items' : typeof items);
          
          // Get all nodes for this field (only the top-level ones we created)
          const fieldNodes = allNodesForField[fieldName] || [];
          
          console.log('   Looking for nodes in allNodesForField["' + fieldName + '"]');
          console.log('   Found:', fieldNodes.length, 'nodes');
          
          if (fieldNodes.length === 0) {
            console.warn('⚠️ No nodes in allNodesForField for:', fieldName);
            console.warn('   Available field keys:', Object.keys(allNodesForField).join(', '));
            // Check if this field even needs nodes (might be a primitive value)
            if (rootNode.nativeInputs && rootNode.nativeInputs[inputIdx] !== undefined) {
              console.log('   → Field is a native input, setting value directly');
              if (typeof items === 'object') {
                rootNode.nativeInputs[inputIdx].value = JSON.stringify(items);
              } else {
                rootNode.nativeInputs[inputIdx].value = items;
              }
              console.log('   ✅ Set native value:', items);
            }
            continue;
          }
          
          const nodeInfo = fieldNodes.map(n => n.id + ':' + n.title).join(', ');
          console.log('   Node details:', nodeInfo);
          
          if (isListField) {
            // Connect all nodes to multi-input
            if (rootNode.multiInputs && rootNode.multiInputs[inputIdx]) {
              console.log('   ✓ Field is multi-input (list field)');
              for (const node of fieldNodes) {
                const linkId = ++this.graph.last_link_id;
                const link = new LLink(
                  linkId,
                  node.id,
                  0,
                  rootNode.id,
                  inputIdx,
                  node.outputs[0].type
                );
                this.graph.links[linkId] = link;
                node.outputs[0].links.push(linkId);
                rootNode.multiInputs[inputIdx].links.push(linkId);
                console.log('   ✅ Connected', node.title, 'to root at slot', inputIdx);
              }
            } else {
              console.warn('   ⚠️ Expected multi-input but not found for field:', fieldName);
              console.warn('   Input type:', rootNode.inputs[inputIdx].type);
              console.warn('   Has multiInputs?', !!rootNode.multiInputs);
              if (rootNode.multiInputs) {
                console.warn('   multiInputs[' + inputIdx + ']?', !!rootNode.multiInputs[inputIdx]);
              }
            }
          } else {
            // Connect single node or set native value
            console.log('   ✓ Field is single-input');
            if (typeof items === 'number') {
              // This is an index reference to another node
              console.log('   → Value is an index reference:', items);
              const modelName = fieldMapping.fieldToModel[fieldName];
              const refNode = this.findNodeByTypeAndIndex(modelName, items, createdNodes, fieldMapping);
              if (refNode) {
                this.graph.connect(refNode, 0, rootNode, inputIdx);
                console.log('   ✅ Connected indexed node', refNode.title, 'to root');
              } else {
                console.warn('   ⚠️ Could not find referenced node at index', items);
              }
            } else if (fieldNodes[0]) {
              this.graph.connect(fieldNodes[0], 0, rootNode, inputIdx);
              console.log('   ✅ Connected', fieldNodes[0].title, 'to root at slot', inputIdx);
            } else if (rootNode.nativeInputs && rootNode.nativeInputs[inputIdx] !== undefined) {
              // Set native value
              console.log('   → Setting native value');
              if (typeof items === 'object') {
                rootNode.nativeInputs[inputIdx].value = JSON.stringify(items);
              } else {
                rootNode.nativeInputs[inputIdx].value = items;
              }
              console.log('   ✅ Set native value');
            }
          }
        }
        
        console.log('🎯 Root node connection summary:');
        console.log('   Total inputs:', rootNode.inputs.length);
        console.log('   Config fields:', Object.keys(configData).join(', '));
        console.log('   Root node input names:', rootNode.inputs.map(inp => inp.name).join(', '));
        
        let connectedCount = 0;
        for (let i = 0; i < rootNode.inputs.length; i++) {
          const input = rootNode.inputs[i];
          const fieldName = input.name;
          const isInConfig = configData.hasOwnProperty(fieldName);
          
          if (rootNode.multiInputs && rootNode.multiInputs[i]) {
            const links = rootNode.multiInputs[i].links.length;
            if (links > 0) {
              console.log('   ✓', fieldName, '(multi):', links, 'connections', isInConfig ? '' : '⚠️ NOT IN CONFIG');
              connectedCount++;
            } else {
              console.log('   ✗', fieldName, '(multi): no connections', isInConfig ? '❌ WAS IN CONFIG!' : '(not in config)');
            }
          } else if (input.link) {
            console.log('   ✓', fieldName, ': connected', isInConfig ? '' : '⚠️ NOT IN CONFIG');
            connectedCount++;
          } else if (rootNode.nativeInputs && rootNode.nativeInputs[i]) {
            const val = rootNode.nativeInputs[i].value;
            // Check if value is truly empty (not false, not 0)
            const isEmpty = val === null || val === undefined || val === '';
            const hasValue = !isEmpty || typeof val === 'boolean' || typeof val === 'number';
            
            if (hasValue) {
              console.log('   ✓', fieldName, '(native):', JSON.stringify(val), '(type: ' + typeof val + ')', isInConfig ? '' : '⚠️ NOT IN CONFIG');
              connectedCount++;
            } else {
              console.log('   ○', fieldName, '(native): empty', rootNode.nativeInputs[i].optional ? '(optional)' : '❌ REQUIRED!', isInConfig ? '❌ WAS IN CONFIG!' : '');
            }
          } else {
            console.log('   ✗', fieldName, ': not connected', isInConfig ? '❌ WAS IN CONFIG!' : '(not in config)');
          }
        }
        console.log('   Connected:', connectedCount, '/', rootNode.inputs.length);
      }
    }

    // Execute all nodes
    for (const node of this.graph.nodes) {
      node.onExecute();
    }

    this.updateSchemaList();
    this.updateNodeTypesList();
    this.draw();

    console.log('=== IMPORT CONFIG COMPLETE ===');
    const statusEl = this.uiController.get('status');
    statusEl.textContent = 'Config imported successfully!';
    setTimeout(() => {
      statusEl.textContent = 'Right-click to add nodes.';
    }, 2000);
  }

  populateNodeFromConfig(node, configItem, createdNodes, fieldMapping) {
    for (let i = 0; i < node.inputs.length; i++) {
      const input = node.inputs[i];
      const fieldName = input.name;
      const value = configItem[fieldName];
  
      if ((value === undefined || value === null) && node.nativeInputs && node.nativeInputs[i]) {
        if (node.nativeInputs[i].optional) {
          node.nativeInputs[i].value = '';
          continue;
        }
      }
  
      if (value === undefined || value === null) continue;
  
      const expectedType = input.type;
      const isDictType = expectedType && (expectedType.indexOf('Dict[') === 0 || expectedType.indexOf('dict[') === 0);
  
      if (typeof value === 'number' && !Array.isArray(value)) {
        const refNode = this.findNodeByTypeAndIndex(expectedType, value, createdNodes, fieldMapping);
        if (refNode) {
          this.graph.connect(refNode, 0, node, i);
        } else {
          if (node.nativeInputs && node.nativeInputs[i] !== undefined) {
            node.nativeInputs[i].value = value;
          }
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'number') {
            const refNode = this.findNodeByTypeAndIndex(expectedType, item, createdNodes, fieldMapping);
            if (refNode) {
              if (node.multiInputs && node.multiInputs[i]) {
                const linkId = ++this.graph.last_link_id;
                const link = new LLink(
                  linkId,
                  refNode.id,
                  0,
                  node.id,
                  i,
                  refNode.outputs[0].type
                );
                this.graph.links[linkId] = link;
                refNode.outputs[0].links.push(linkId);
                node.multiInputs[i].links.push(linkId);
              } else {
                this.graph.connect(refNode, 0, node, i);
              }
            }
          } else if (typeof item === 'object' && item !== null) {
            const embeddedNode = this.createEmbeddedNode(item, node.schemaName, createdNodes, fieldMapping, expectedType);
            if (embeddedNode) {
              if (node.multiInputs && node.multiInputs[i]) {
                const linkId = ++this.graph.last_link_id;
                const link = new LLink(
                  linkId,
                  embeddedNode.id,
                  0,
                  node.id,
                  i,
                  embeddedNode.outputs[0].type
                );
                this.graph.links[linkId] = link;
                embeddedNode.outputs[0].links.push(linkId);
                node.multiInputs[i].links.push(linkId);
              } else {
                this.graph.connect(embeddedNode, 0, node, i);
              }
            }
          }
        }
      } else if (typeof value === 'object' && value !== null && !isDictType) {
        const embeddedNode = this.createEmbeddedNode(value, node.schemaName, createdNodes, fieldMapping, expectedType);
        if (embeddedNode) {
          this.graph.connect(embeddedNode, 0, node, i);
        }
      } else {
        if (node.nativeInputs && node.nativeInputs[i] !== undefined) {
          if (typeof value === 'object') {
            node.nativeInputs[i].value = JSON.stringify(value);
          } else if (typeof value === 'boolean') {
            // Handle boolean explicitly - false is a valid value!
            node.nativeInputs[i].value = value;
          } else {
            node.nativeInputs[i].value = value;
          }
        }
      }
    }
  }

  findNodeByTypeAndIndex(expectedType, index, createdNodes, fieldMapping) {
    let targetType = expectedType;
    
    const listMatch = targetType.match(/List\[(.+)\]/);
    if (listMatch) {
      targetType = listMatch[1];
    }
    
    const optionalMatch = targetType.match(/Optional\[(.+)\]/);
    if (optionalMatch) {
      targetType = optionalMatch[1];
    }
    
    const unionMatch = targetType.match(/Union\[([^\]]+)\]/);
    if (unionMatch) {
      const types = unionMatch[1].split(',').map(t => t.trim());
      for (const t of types) {
        if (t.endsWith('Config') || (!t.includes('Index') && t !== 'int')) {
          targetType = t;
          break;
        }
      }
    }
    
    const modelName = targetType;
    console.log('Finding node by index:', { originalType: expectedType, extractedModel: modelName, index });
    
    if (!fieldMapping || !fieldMapping.modelToField) {
      console.warn('Field mapping not available for', modelName);
      return null;
    }
    
    const fieldName = fieldMapping.modelToField[modelName] || this.graph.modelNameToFieldName(modelName);
    console.log('  Mapped to field:', fieldName);
    
    if (createdNodes[fieldName] && index >= 0 && index < createdNodes[fieldName].length) {
      console.log('  ✓ Found node at', fieldName + '[' + index + ']');
      return createdNodes[fieldName][index];
    }
    
    for (const field in createdNodes) {
      if (!createdNodes.hasOwnProperty(field)) continue;
      const nodes = createdNodes[field];
      if (nodes.length > 0 && nodes[0].modelName === modelName) {
        if (index >= 0 && index < nodes.length) {
          console.log('  ✓ Found node via fallback at', field + '[' + index + ']');
          return nodes[index];
        }
      }
    }
    
    console.warn('  ✗ Node not found for', modelName, 'at index', index);
    return null;
  }

  isNativeCollectionType(typeString) {
    if (!typeString) return false;
    
    // Check for Dict[str, Any], List[str], Set[int], Tuple[str, ...], etc.
    const collectionMatch = typeString.match(/^(Optional\[)?(List|Set|Tuple|Dict|dict)\[(.+)\]$/);
    if (!collectionMatch) return false;
    
    const innerType = collectionMatch[3];
    
    // For Dict, check if it's Dict[primitive, primitive] or Dict[str, Any]
    if (collectionMatch[2] === 'Dict' || collectionMatch[2] === 'dict') {
      // If it contains 'Union[' with a model type, it's not a native collection
      if (innerType.indexOf('Union[') !== -1 && innerType.match(/[A-Z][a-zA-Z]*Config/)) {
        return false;
      }
      // Dict[str, Any], Dict[str, int], etc. are native
      return true;
    }
    
    // For List/Set/Tuple, check if the inner type is primitive
    const primitives = ['str', 'int', 'bool', 'float', 'Any', 'string', 'integer'];
    
    // Strip Optional if present
    let checkType = innerType;
    const optMatch = checkType.match(/^Optional\[(.+)\]$/);
    if (optMatch) checkType = optMatch[1];
    
    // Check if it's a primitive
    if (primitives.indexOf(checkType) !== -1) {
      return true;
    }
    
    // Check if it's a Union that doesn't contain model types
    const unionMatch = checkType.match(/^Union\[(.+)\]$/);
    if (unionMatch) {
      // If it contains a Config type, it's not a native collection
      if (unionMatch[1].match(/[A-Z][a-zA-Z]*Config/)) {
        return false;
      }
      return true;
    }
    
    return false;
  }

  extractModelTypeFromUnionOrOptional(typeString) {
    if (!typeString) return null;
    
    let workingType = typeString.trim();
    console.log('          Extracting model type from:', workingType);
    
    // Strip Optional wrapper
    const optionalMatch = workingType.match(/^Optional\[(.+)\]$/);
    if (optionalMatch) {
      workingType = optionalMatch[1].trim();
      console.log('          After stripping Optional:', workingType);
    }
    
    // Strip List/Set/Dict/Tuple wrapper to get the inner type
    const listMatch = workingType.match(/^(List|Set|Tuple)\[(.+)\]$/);
    if (listMatch) {
      workingType = listMatch[2].trim();
      console.log('          After stripping ' + listMatch[1] + ':', workingType);
    }
    
    const dictMatch = workingType.match(/^(Dict|dict)\[(.+)\]$/);
    if (dictMatch) {
      // For Dict, extract the value type (second parameter)
      const dictContent = dictMatch[2];
      const parts = this.splitTypeParameters(dictContent);
      if (parts.length >= 2) {
        workingType = parts[1].trim();
        console.log('          After stripping Dict, got value type:', workingType);
      }
    }
    
    // Now extract from Union if present
    const unionMatch = workingType.match(/^Union\[(.+)\]$/);
    if (unionMatch) {
      const unionContent = unionMatch[1];
      const types = this.splitTypeParameters(unionContent);
      console.log('          Union contains types:', types);
      
      // Find the non-Index type (the actual model type)
      for (const t of types) {
        const trimmed = t.trim();
        if (trimmed !== 'Index' && trimmed !== 'int' && !trimmed.startsWith('int ')) {
          console.log('          ✅ Selected model type from union:', trimmed);
          return trimmed;
        }
      }
      console.warn('          ⚠️ No model type found in union, only Index/int');
      return null;
    }
    
    // If no Union, return the working type if it's not a primitive
    const primitives = ['str', 'int', 'bool', 'float', 'Any', 'Index', 'string', 'integer'];
    if (primitives.indexOf(workingType) === -1) {
      console.log('          ✅ Direct model type:', workingType);
      return workingType;
    }
    
    console.log('          → Type is primitive:', workingType);
    return null;
  }

  splitTypeParameters(str) {
    // Split by comma, but respect nested brackets
    const result = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '[') depth++;
      if (char === ']') depth--;
      
      if (char === ',' && depth === 0) {
        if (current.trim()) result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) result.push(current.trim());
    return result;
  }

  createEmbeddedNode(configItem, schemaName, createdNodes, fieldMapping, expectedType) {
    console.log('      🔨 Creating embedded node');
    console.log('         Expected type from schema:', expectedType);
    console.log('         Config item keys:', Object.keys(configItem).join(', '));
    
    // CHECK: If this is a native collection type, don't create a node
    if (this.isNativeCollectionType(expectedType)) {
      console.log('         ℹ️ Skipping node creation - native collection type:', expectedType);
      return null;
    }
    
    // Use the proper type extraction method
    const targetModelType = this.extractModelTypeFromUnionOrOptional(expectedType);
    
    if (targetModelType) {
      const nodeType = schemaName + '.' + targetModelType;
      console.log('         Attempting to create:', nodeType);
      
      if (this.graph.nodeTypes[nodeType]) {
        const node = this.graph.createNode(nodeType);
        node.pos = [Math.random() * 400 + 100, Math.random() * 400 + 100];
        console.log('         ✅ Created:', nodeType);
        this.populateNodeFromConfig(node, configItem, createdNodes, fieldMapping);
        return node;
      } else {
        console.error('         ❌ Node type does not exist:', nodeType);
        console.error('         Available types:', Object.keys(this.graph.nodeTypes).filter(t => t.indexOf(schemaName) === 0).join(', '));
      }
    } else {
      console.warn('         ⚠️ Could not extract model type from:', expectedType);
    }
    
    // Fallback: try to match by fields (but warn it's ambiguous)
    console.log('         ⚠️ FALLBACK: Trying field matching (ambiguous!)');
    let bestMatch = null;
    let bestMatchScore = 0;
    const itemKeys = Object.keys(configItem);
    
    for (const nodeType in this.graph.nodeTypes) {
      if (!this.graph.nodeTypes.hasOwnProperty(nodeType)) continue;
      if (nodeType.indexOf(schemaName + '.') !== 0) continue;
      
      const tempNode = new (this.graph.nodeTypes[nodeType])();
      const tempInputNames = tempNode.inputs.map(inp => inp.name);
      
      let matchScore = 0;
      for (const key of itemKeys) {
        if (tempInputNames.indexOf(key) !== -1) {
          matchScore++;
        }
      }
      
      if (matchScore === itemKeys.length && matchScore > bestMatchScore) {
        bestMatch = nodeType;
        bestMatchScore = matchScore;
      }
    }
    
    if (bestMatch) {
      console.log('         ⚠️ Using best field match:', bestMatch, '(score:', bestMatchScore + ')');
      const node = this.graph.createNode(bestMatch);
      node.pos = [Math.random() * 400 + 100, Math.random() * 400 + 100];
      this.populateNodeFromConfig(node, configItem, createdNodes, fieldMapping);
      return node;
    }

    console.error('         ❌ Complete failure - could not create node!');
    return null;
  }

  // Utility methods
  removeLink(linkId, targetNode, targetSlot) {
    const link = this.graph.links[linkId];
    if (link) {
      const originNode = this.graph.getNodeById(link.origin_id);
      if (originNode) {
        const idx = originNode.outputs[link.origin_slot].links.indexOf(linkId);
        if (idx > -1) originNode.outputs[link.origin_slot].links.splice(idx, 1);
      }
      delete this.graph.links[linkId];
      targetNode.inputs[targetSlot].link = null;
      this.eventBus.emit('link:deleted', { linkId });
    }
  }

  disconnectLink(linkId) {
    const link = this.graph.links[linkId];
    if (!link) {
      console.warn('❌ Link not found:', linkId);
      return false;
    }

    const originNode = this.graph.getNodeById(link.origin_id);
    const targetNode = this.graph.getNodeById(link.target_id);

    console.log(`🔗 Disconnecting link ${linkId}: ${originNode?.title} → ${targetNode?.title}`);

    if (originNode) {
      const idx = originNode.outputs[link.origin_slot].links.indexOf(linkId);
      if (idx > -1) {
        originNode.outputs[link.origin_slot].links.splice(idx, 1);
      }
    }

    if (targetNode) {
      if (targetNode.multiInputs && targetNode.multiInputs[link.target_slot]) {
        const multiIdx = targetNode.multiInputs[link.target_slot].links.indexOf(linkId);
        if (multiIdx > -1) {
          targetNode.multiInputs[link.target_slot].links.splice(multiIdx, 1);
        }
      } else {
        targetNode.inputs[link.target_slot].link = null;
      }
    }

    delete this.graph.links[linkId];
    this.eventBus.emit('link:deleted', { linkId });
    return true;
  }

  clearMultiInputLinks(node, slotIdx) {
    if (!node || !node.multiInputs || !node.multiInputs[slotIdx]) {
      console.warn('❌ Not a multi-input slot');
      return false;
    }

    const links = node.multiInputs[slotIdx].links.slice();
    const slotName = node.inputs[slotIdx] ? node.inputs[slotIdx].name : 'slot' + slotIdx;
    let cleared = 0;

    for (const linkId of links) {
      if (this.disconnectLink(linkId)) {
        cleared++;
      }
    }

    console.log(`✅ Cleared ${cleared} links from slot "${slotName}" on node "${node.title}"`);
    
    if (cleared > 0) {
      this.eventBus.emit('ui:update', { 
        id: 'status', 
        content: `Cleared ${cleared} link(s) from ${slotName}` 
      });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 2000);
    }
    
    this.draw();
    return cleared > 0;
  }

  clearAllMultiInputLinks(node) {
    if (!node || !node.multiInputs) {
      console.warn('❌ Node has no multi-input slots', node);
      return false;
    }

    let totalCleared = 0;
    const slotInfo = [];
    
    for (const slotIdx in node.multiInputs) {
      if (node.multiInputs.hasOwnProperty(slotIdx)) {
        const links = node.multiInputs[slotIdx].links.slice();
        const slotName = node.inputs[slotIdx] ? node.inputs[slotIdx].name : 'slot' + slotIdx;
        slotInfo.push(`${slotName}: ${links.length} links`);
        
        for (const linkId of links) {
          if (this.disconnectLink(linkId)) {
            totalCleared++;
          }
        }
      }
    }

    console.log(`✅ Cleared ${totalCleared} total links from node "${node.title}"`, slotInfo);
    
    if (totalCleared > 0) {
      this.eventBus.emit('ui:update', { 
        id: 'status', 
        content: `Cleared ${totalCleared} multi-input link(s) from ${node.title}` 
      });
      setTimeout(() => {
        this.eventBus.emit('ui:update', { id: 'status', content: 'Right-click to add nodes.' });
      }, 2000);
    }
    
    this.draw();
    return totalCleared > 0;
  }

  removeNode(node) {
    if (!node) return;
    
    for (let j = 0; j < node.inputs.length; j++) {
      if (node.multiInputs && node.multiInputs[j]) {
        const links = node.multiInputs[j].links.slice();
        for (const linkId of links) {
          this.removeLink(linkId, node, j);
        }
      } else if (node.inputs[j].link) {
        this.removeLink(node.inputs[j].link, node, j);
      }
    }
    
    for (let j = 0; j < node.outputs.length; j++) {
      const links = node.outputs[j].links.slice();
      for (const linkId of links) {
        const link = this.graph.links[linkId];
        if (link) {
          const targetNode = this.graph.getNodeById(link.target_id);
          if (targetNode) {
            if (targetNode.multiInputs && targetNode.multiInputs[link.target_slot]) {
              const idx = targetNode.multiInputs[link.target_slot].links.indexOf(linkId);
              if (idx > -1) targetNode.multiInputs[link.target_slot].links.splice(idx, 1);
            } else {
              targetNode.inputs[link.target_slot].link = null;
            }
          }
          delete this.graph.links[linkId];
        }
      }
    }
    
    const idx = this.graph.nodes.indexOf(node);
    if (idx > -1) {
      this.graph.nodes.splice(idx, 1);
      delete this.graph._nodes_by_id[node.id];
    }
    
    if (this.selectedNode === node) {
      this.selectedNode = null;
    }
    
    this.eventBus.emit('node:deleted', { nodeId: node.id });
  }

  isSlotCompatible(node, slotIdx, isOutput) {
    if (!this.connecting || node === this.connecting.node) return false;
    if (this.connecting.isOutput && !isOutput) {
      const outType = this.connecting.node.outputs[this.connecting.slot].type;
      const inType = node.inputs[slotIdx].type;
      return this.graph._areTypesCompatible(outType, inType);
    }
    if (!this.connecting.isOutput && isOutput) {
      const inType = this.connecting.node.inputs[this.connecting.slot].type;
      const outType = node.outputs[slotIdx].type;
      return this.graph._areTypesCompatible(outType, inType);
    }
    return false;
  }

  showError(text) {
    const errorEl = this.uiController.get('errorBanner');
    errorEl.textContent = '⚠️ ' + text;
    errorEl.style.display = 'block';
    setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
    this.eventBus.emit('error', { message: text });
  }

  updateNodeTypesList() {
    const types = Object.keys(this.graph.nodeTypes);
    const listEl = this.uiController.get('nodeTypesList');
    listEl.textContent = types.length > 0 ? types.join(', ') : 'None';
  }

  updateSchemaList() {
    const schemas = Object.keys(this.graph.schemas);
    const listEl = this.uiController.get('schemaList');
    
    if (schemas.length === 0) {
      listEl.innerHTML = '<div style="color: var(--text-tertiary); font-size: 11px; padding: 8px;">No schemas registered</div>';
      return;
    }
    
    let html = '';
    for (const schemaName of schemas) {
      let nodeCount = 0;
      for (const node of this.graph.nodes) {
        if (node.schemaName === schemaName) nodeCount++;
      }
      
      let typeCount = 0;
      for (const type in this.graph.nodeTypes) {
        if (type.indexOf(schemaName + '.') === 0) typeCount++;
      }
      
      html += '<div class="schema-item">';
      html += '<div><span class="schema-item-name">' + schemaName + '</span>';
      html += '<span class="schema-item-count">(' + typeCount + ' types, ' + nodeCount + ' nodes)</span></div>';
      html += '<button class="schema-remove-btn" data-schema="' + schemaName + '">Remove</button>';
      html += '</div>';
    }
    
    listEl.innerHTML = html;
    
    const removeButtons = listEl.querySelectorAll('.schema-remove-btn');
    for (const button of removeButtons) {
      button.addEventListener('click', () => {
        this.openSchemaRemovalDialog();
      });
    }
  }

  openSchemaRemovalDialog() {
    const schemas = Object.keys(this.graph.schemas);
    if (schemas.length === 0) {
      this.showError('No schemas to remove');
      return;
    }
    
    let options = '';
    for (const schemaName of schemas) {
      options += '<option value="' + schemaName + '">' + schemaName + '</option>';
    }
    this.uiController.get('schemaRemovalNameInput').innerHTML = options;
    
    this.eventBus.emit('ui:show', { id: 'schemaRemovalDialog' });
    this.uiController.get('schemaRemovalNameInput').focus();
  }

  screenToWorld(sx, sy) {
    return [(sx - this.camera.x) / this.camera.scale, (sy - this.camera.y) / this.camera.scale];
  }

  worldToScreen(wx, wy) {
    return [wx * this.camera.scale + this.camera.x, wy * this.camera.scale + this.camera.y];
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  centerView() {
    if (this.graph.nodes.length === 0) return;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const node of this.graph.nodes) {
      minX = Math.min(minX, node.pos[0]);
      minY = Math.min(minY, node.pos[1]);
      maxX = Math.max(maxX, node.pos[0] + node.size[0]);
      maxY = Math.max(maxY, node.pos[1] + node.size[1]);
    }
    
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const graphCenterX = minX + graphWidth / 2;
    const graphCenterY = minY + graphHeight / 2;
    
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    
    const padding = 100;
    const scaleX = (this.canvas.width - padding * 2) / graphWidth;
    const scaleY = (this.canvas.height - padding * 2) / graphHeight;
    const targetScale = Math.min(scaleX, scaleY, 1.5);
    
    this.camera.scale = Math.max(0.1, Math.min(5, targetScale));
    this.camera.x = canvasCenterX - graphCenterX * this.camera.scale;
    this.camera.y = canvasCenterY - graphCenterY * this.camera.scale;
    
    this.eventBus.emit('ui:update', { 
      id: 'zoomLevel', 
      content: Math.round(this.camera.scale * 100) + '%' 
    });
    this.draw();
  }

  resetZoom() {
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    const worldCenter = this.screenToWorld(canvasCenterX, canvasCenterY);
    
    this.camera.scale = 1.0;
    this.camera.x = canvasCenterX - worldCenter[0] * this.camera.scale;
    this.camera.y = canvasCenterY - worldCenter[1] * this.camera.scale;
    
    this.eventBus.emit('ui:update', { id: 'zoomLevel', content: '100%' });
    this.draw();
  }

  applyLayout(layoutType) {
    if (this.graph.nodes.length === 0) {
      this.showError('No nodes to layout');
      return;
    }
    
    console.log('Applying layout:', layoutType);
    
    switch (layoutType) {
      case 'hierarchical-vertical':
        this.applyHierarchicalLayout(true);
        break;
      case 'hierarchical-horizontal':
        this.applyHierarchicalLayout(false);
        break;
      case 'force-directed':
        this.applyForceDirectedLayout();
        break;
      case 'grid':
        this.applyGridLayout();
        break;
      case 'circular':
        this.applyCircularLayout();
        break;
      default:
        this.showError('Unknown layout type: ' + layoutType);
        return;
    }
    
    this.eventBus.emit('layout:applied', { layoutType });
    this.draw();
    this.centerView();
  }

  applyHierarchicalLayout(vertical = false) {
    // Find root nodes (nodes with no inputs connected or nodes marked as root)
    const rootNodes = [];
    const processedNodes = new Set();
    
    for (const node of this.graph.nodes) {
      let hasInputConnection = false;
      for (const input of node.inputs) {
        if (input.link !== null && input.link !== undefined) {
          hasInputConnection = true;
          break;
        }
      }
      if (!hasInputConnection || node.isRootType) {
        rootNodes.push(node);
      }
    }
    
    // If no root nodes found, use all nodes as roots
    if (rootNodes.length === 0) {
      rootNodes.push(...this.graph.nodes);
    }
    
    const layers = [];
    const nodeToLayer = new Map();
    
    // Build layers using BFS
    const queue = [];
    for (const root of rootNodes) {
      queue.push({ node: root, layer: 0 });
      processedNodes.add(root);
    }
    
    while (queue.length > 0) {
      const { node, layer } = queue.shift();
      
      if (!layers[layer]) {
        layers[layer] = [];
      }
      layers[layer].push(node);
      nodeToLayer.set(node, layer);
      
      // Find connected nodes through outputs
      for (const output of node.outputs) {
        for (const linkId of output.links) {
          const link = this.graph.links[linkId];
          if (link) {
            const targetNode = this.graph.getNodeById(link.target_id);
            if (targetNode && !processedNodes.has(targetNode)) {
              processedNodes.add(targetNode);
              queue.push({ node: targetNode, layer: layer + 1 });
            }
          }
        }
      }
    }
    
    // Add any unconnected nodes to the last layer
    for (const node of this.graph.nodes) {
      if (!processedNodes.has(node)) {
        const lastLayer = layers.length;
        if (!layers[lastLayer]) {
          layers[lastLayer] = [];
        }
        layers[lastLayer].push(node);
      }
    }
    
    // Position nodes
    const layerSpacing = vertical ? 300 : 200;
    const nodeSpacing = vertical ? 150 : 250;
    const startX = 100;
    const startY = 100;
    
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const layerHeight = layer.length * nodeSpacing;
      
      for (let j = 0; j < layer.length; j++) {
        const node = layer[j];
        if (vertical) {
          node.pos[0] = startX + i * layerSpacing;
          node.pos[1] = startY + j * nodeSpacing - layerHeight / 2;
        } else {
          node.pos[0] = startX + j * nodeSpacing - layerHeight / 2;
          node.pos[1] = startY + i * layerSpacing;
        }
      }
    }
  }

  applyForceDirectedLayout() {
    // Simple force-directed layout using spring forces
    const iterations = 100;
    const repulsionStrength = 50000;
    const attractionStrength = 0.01;
    const damping = 0.9;
    const minDistance = 200;
    
    // Initialize velocities
    const velocities = new Map();
    for (const node of this.graph.nodes) {
      velocities.set(node, { x: 0, y: 0 });
    }
    
    // Initial random positions if nodes are clustered
    const spread = 400;
    for (const node of this.graph.nodes) {
      if (node.pos[0] === 0 && node.pos[1] === 0) {
        node.pos[0] = Math.random() * spread;
        node.pos[1] = Math.random() * spread;
      }
    }
    
    // Run simulation
    for (let iter = 0; iter < iterations; iter++) {
      // Calculate repulsion forces between all nodes
      for (let i = 0; i < this.graph.nodes.length; i++) {
        const nodeA = this.graph.nodes[i];
        const vel = velocities.get(nodeA);
        
        for (let j = i + 1; j < this.graph.nodes.length; j++) {
          const nodeB = this.graph.nodes[j];
          const dx = nodeB.pos[0] - nodeA.pos[0];
          const dy = nodeB.pos[1] - nodeA.pos[1];
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);
          
          if (dist < 0.1) continue;
          
          const force = repulsionStrength / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          vel.x -= fx;
          vel.y -= fy;
          
          const velB = velocities.get(nodeB);
          velB.x += fx;
          velB.y += fy;
        }
      }
      
      // Calculate attraction forces for connected nodes
      for (const linkId in this.graph.links) {
        const link = this.graph.links[linkId];
        const nodeA = this.graph.getNodeById(link.origin_id);
        const nodeB = this.graph.getNodeById(link.target_id);
        
        if (!nodeA || !nodeB) continue;
        
        const dx = nodeB.pos[0] - nodeA.pos[0];
        const dy = nodeB.pos[1] - nodeA.pos[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.1) continue;
        
        const force = (dist - minDistance) * attractionStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        const velA = velocities.get(nodeA);
        const velB = velocities.get(nodeB);
        
        velA.x += fx;
        velA.y += fy;
        velB.x -= fx;
        velB.y -= fy;
      }
      
      // Update positions and apply damping
      for (const node of this.graph.nodes) {
        const vel = velocities.get(node);
        node.pos[0] += vel.x;
        node.pos[1] += vel.y;
        vel.x *= damping;
        vel.y *= damping;
      }
    }
  }

  applyGridLayout() {
    const cols = Math.ceil(Math.sqrt(this.graph.nodes.length));
    const cellWidth = 250;
    const cellHeight = 200;
    const startX = 100;
    const startY = 100;
    
    for (let i = 0; i < this.graph.nodes.length; i++) {
      const node = this.graph.nodes[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      node.pos[0] = startX + col * cellWidth;
      node.pos[1] = startY + row * cellHeight;
    }
  }

  applyCircularLayout() {
    const centerX = 0;
    const centerY = 0;
    const radius = Math.max(300, this.graph.nodes.length * 30);
    const angleStep = (2 * Math.PI) / this.graph.nodes.length;
    
    // Separate root nodes and regular nodes
    const rootNodes = [];
    const regularNodes = [];
    
    for (const node of this.graph.nodes) {
      if (node.isRootType) {
        rootNodes.push(node);
      } else {
        regularNodes.push(node);
      }
    }
    
    // Place root nodes in the center
    if (rootNodes.length > 0) {
      const rootRadius = 100;
      const rootAngleStep = (2 * Math.PI) / rootNodes.length;
      for (let i = 0; i < rootNodes.length; i++) {
        const angle = i * rootAngleStep;
        rootNodes[i].pos[0] = centerX + Math.cos(angle) * rootRadius;
        rootNodes[i].pos[1] = centerY + Math.sin(angle) * rootRadius;
      }
    }
    
    // Place regular nodes in a circle
    for (let i = 0; i < regularNodes.length; i++) {
      const angle = i * angleStep;
      regularNodes[i].pos[0] = centerX + Math.cos(angle) * radius;
      regularNodes[i].pos[1] = centerY + Math.sin(angle) * radius;
    }
  }

  // Drawing
  getCanvasColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      canvasBg: style.getPropertyValue('--canvas-bg').trim(),
      nodeBg: style.getPropertyValue('--node-bg').trim(),
      nodeBgSelected: style.getPropertyValue('--node-bg-selected').trim(),
      nodeHeader: style.getPropertyValue('--node-header').trim(),
      nodeShadow: style.getPropertyValue('--node-shadow').trim(),
      borderColor: style.getPropertyValue('--border-color').trim(),
      borderHighlight: style.getPropertyValue('--border-highlight').trim(),
      textPrimary: style.getPropertyValue('--text-primary').trim(),
      textSecondary: style.getPropertyValue('--text-secondary').trim(),
      textTertiary: style.getPropertyValue('--text-tertiary').trim(),
      accentPurple: style.getPropertyValue('--accent-purple').trim(),
      accentOrange: style.getPropertyValue('--accent-orange').trim(),
      accentGreen: style.getPropertyValue('--accent-green').trim(),
      accentRed: style.getPropertyValue('--accent-red').trim(),
      slotInput: style.getPropertyValue('--slot-input').trim(),
      slotOutput: style.getPropertyValue('--slot-output').trim(),
      slotConnected: style.getPropertyValue('--slot-connected').trim(),
      linkColor: style.getPropertyValue('--link-color').trim(),
      gridColor: style.getPropertyValue('--grid-color').trim()
    };
  }

  draw() {
    const colors = this.getCanvasColors();
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = colors.canvasBg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.scale(this.camera.scale, this.camera.scale);
    
    // Reset cursor at start of draw
    if (!this.connecting && !this.dragNode && !this.isPanning) {
      this.canvas.style.cursor = 'default';
    }
    
    this.drawGrid(colors);
    this.drawLinks(colors);
    this.drawNodes(colors);
    
    if (this.connecting) {
      this.drawConnecting(colors);
    }
    
    // Draw selection rectangle
    if (this.selectionRect) {
      this.ctx.strokeStyle = colors.borderHighlight;
      this.ctx.fillStyle = 'rgba(70, 162, 218, 0.1)';
      this.ctx.lineWidth = 1 / this.camera.scale;
      this.ctx.setLineDash([5 / this.camera.scale, 5 / this.camera.scale]);
      this.ctx.fillRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
      this.ctx.strokeRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.w, this.selectionRect.h);
      this.ctx.setLineDash([]);
    }
    
    this.ctx.restore();
  }

  drawGrid(colors) {
    const style = this.drawingStyleManager.getStyle();
    const gridSize = 50;
    const worldRect = {
      x: -this.camera.x / this.camera.scale,
      y: -this.camera.y / this.camera.scale,
      width: this.canvas.width / this.camera.scale,
      height: this.canvas.height / this.camera.scale
    };
    
    const startX = Math.floor(worldRect.x / gridSize) * gridSize;
    const startY = Math.floor(worldRect.y / gridSize) * gridSize;
    const endX = worldRect.x + worldRect.width;
    const endY = worldRect.y + worldRect.height;
    
    this.ctx.strokeStyle = colors.gridColor;
    this.ctx.globalAlpha = style.gridOpacity;
    this.ctx.lineWidth = 1 / this.camera.scale;
    
    if (style.useDashed && style.currentStyle === 'blueprint') {
      this.ctx.setLineDash([4 / this.camera.scale, 4 / this.camera.scale]);
    }
    
    this.ctx.beginPath();
    
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, worldRect.y);
      this.ctx.lineTo(x, endY);
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.moveTo(worldRect.x, y);
      this.ctx.lineTo(endX, y);
    }
    
    this.ctx.stroke();
    
    if (style.useDashed && style.currentStyle === 'blueprint') {
      this.ctx.setLineDash([]);
    }
    
    this.ctx.globalAlpha = 1.0;
  }

  drawLinks(colors) {
    const style = this.drawingStyleManager.getStyle();
    
    for (const linkId in this.graph.links) {
      const link = this.graph.links[linkId];
      const orig = this.graph.getNodeById(link.origin_id);
      const targ = this.graph.getNodeById(link.target_id);
      if (orig && targ) {
        const x1 = orig.pos[0] + orig.size[0];
        const y1 = orig.pos[1] + 33 + link.origin_slot * 25;
        const x2 = targ.pos[0];
        const y2 = targ.pos[1] + 33 + link.target_slot * 25;
        
        // Better curve calculation - limit control point distance
        const distance = Math.abs(x2 - x1);
        const maxControlDistance = 400; // Maximum control point offset
        const controlOffset = Math.min(distance * style.linkCurve, maxControlDistance);
        const cx1 = x1 + controlOffset;
        const cx2 = x2 - controlOffset;
        
        // Shadow layer
        if (style.linkShadowBlur > 0) {
          this.ctx.strokeStyle = colors.linkColor;
          this.ctx.lineWidth = (style.linkWidth + 3) / this.camera.scale;
          this.ctx.globalAlpha = 0.15;
          
          if (style.useGlow) {
            this.ctx.shadowColor = colors.linkColor;
            this.ctx.shadowBlur = style.linkShadowBlur / this.camera.scale;
          }
          
          this.ctx.beginPath();
          if (style.linkCurve > 0) {
            this.ctx.moveTo(x1, y1);
            this.ctx.bezierCurveTo(cx1, y1, cx2, y2, x2, y2);
          } else {
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
          }
          this.ctx.stroke();
        }
        
        // Main line
        this.ctx.strokeStyle = colors.linkColor;
        this.ctx.lineWidth = style.linkWidth / this.camera.scale;
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;
        
        if (style.useDashed) {
          this.ctx.setLineDash([8 / this.camera.scale, 4 / this.camera.scale]);
        }
        
        this.ctx.beginPath();
        if (style.linkCurve > 0) {
          this.ctx.moveTo(x1, y1);
          this.ctx.bezierCurveTo(cx1, y1, cx2, y2, x2, y2);
        } else {
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
        }
        this.ctx.stroke();
        
        if (style.useDashed) {
          this.ctx.setLineDash([]);
        }
      }
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
  }

  drawNodes(colors) {
    for (const node of this.graph.nodes) {
      this.drawNode(node, colors);
    }
  }

  drawNode(node, colors) {
    const style = this.drawingStyleManager.getStyle();
    const x = node.pos[0];
    const y = node.pos[1];
    const w = node.size[0];
    const h = node.size[1];
    const radius = style.nodeCornerRadius;
    const textScale = this.getTextScale();
    
    // Shadow
    if (style.nodeShadowBlur > 0) {
      this.ctx.shadowColor = colors.nodeShadow;
      this.ctx.shadowBlur = style.nodeShadowBlur / this.camera.scale;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = style.nodeShadowOffset / this.camera.scale;
    }
    
    // Body with adjustable corner radius
    const isSelected = this.isNodeSelected(node);
    const bodyColor = isSelected ? colors.nodeBgSelected : colors.nodeBg;
    
    if (style.useGradient && style.currentStyle !== 'wireframe') {
      const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, bodyColor);
      gradient.addColorStop(1, this.adjustColorBrightness(bodyColor, -20));
      this.ctx.fillStyle = gradient;
    } else {
      this.ctx.fillStyle = style.currentStyle === 'wireframe' ? 'transparent' : bodyColor;
    }
    
    this.ctx.beginPath();
    if (radius > 0) {
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + w - radius, y);
      this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.ctx.lineTo(x + w, y + h - radius);
      this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.ctx.lineTo(x + radius, y + h);
      this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
      this.ctx.closePath();
    } else {
      this.ctx.rect(x, y, w, h);
    }
    
    if (style.currentStyle !== 'wireframe') {
      this.ctx.fill();
    }
    
    this.ctx.strokeStyle = isSelected ? colors.borderHighlight : colors.borderColor;
    this.ctx.lineWidth = (isSelected ? 2 : 1) / this.camera.scale;
    
    if (style.useGlow && isSelected) {
      this.ctx.shadowColor = colors.borderHighlight;
      this.ctx.shadowBlur = 15 / this.camera.scale;
    } else {
      this.ctx.shadowBlur = 0;
    }
    
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.stroke();
    
    // Header
    const headerColor = node.isNative ? colors.accentPurple : 
                        (node.isRootType ? colors.accentOrange : colors.nodeHeader);
    
    if (style.useGradient && style.currentStyle !== 'wireframe') {
      const headerGradient = this.ctx.createLinearGradient(x, y, x, y + 26);
      headerGradient.addColorStop(0, headerColor);
      headerGradient.addColorStop(1, this.adjustColorBrightness(headerColor, -30));
      this.ctx.fillStyle = headerGradient;
    } else {
      this.ctx.fillStyle = style.currentStyle === 'wireframe' ? 'transparent' : headerColor;
    }
    
    this.ctx.beginPath();
    if (radius > 0) {
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + w - radius, y);
      this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.ctx.lineTo(x + w, y + 26);
      this.ctx.lineTo(x, y + 26);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
    } else {
      this.ctx.rect(x, y, w, 26);
    }
    this.ctx.closePath();
    
    if (style.currentStyle !== 'wireframe') {
      this.ctx.fill();
    }
    
    if (style.currentStyle === 'wireframe' || style.currentStyle === 'blueprint') {
      this.ctx.stroke();
    }
    
    // Title with text scaling
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x + 4, y, w - 8, 26);
    this.ctx.clip();
    
    this.ctx.fillStyle = colors.textPrimary;
    this.ctx.font = (11 * textScale) + 'px ' + style.textFont;
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'left';
    
    if (style.useGlow && (node.isRootType || node.isNative)) {
      this.ctx.shadowColor = headerColor;
      this.ctx.shadowBlur = (8 * textScale);
    }
    
    let titleText = node.title;
    if (node.isRootType) titleText = '★ ' + titleText;
    
    const maxWidth = w - 16;
    let displayTitle = titleText;
    const textWidth = this.ctx.measureText(displayTitle).width;
    
    if (textWidth > maxWidth) {
      let left = 0;
      let right = displayTitle.length;
      while (left < right) {
        const mid = Math.floor((left + right + 1) / 2);
        const testText = displayTitle.substring(0, mid) + '...';
        if (this.ctx.measureText(testText).width <= maxWidth) {
          left = mid;
        } else {
          right = mid - 1;
        }
      }
      displayTitle = displayTitle.substring(0, left) + '...';
    }
    
    this.ctx.fillText(displayTitle, x + 8, y + 13);
    this.ctx.restore();
    
    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    
    // Slots
    const worldMouse = this.screenToWorld(this.mousePos[0], this.mousePos[1]);
    for (let j = 0; j < node.inputs.length; j++) {
      this.drawInputSlot(node, j, x, y, w, worldMouse, colors);
    }
    for (let j = 0; j < node.outputs.length; j++) {
      this.drawOutputSlot(node, j, x, y, w, worldMouse, colors);
    }
    
    // Native value display with rounded corners
    if (node.isNative && node.properties.value !== undefined) {
      const valueY = y + h - 18;
      const valueX = x + 8;
      const valueW = w - 16;
      const valueH = 18;
      const valueRadius = 4;
      
      // Check if mouse is hovering over the value box
      const isValueHovered = !this.connecting && 
        worldMouse[0] >= valueX && worldMouse[0] <= valueX + valueW &&
        worldMouse[1] >= valueY - 10 && worldMouse[1] <= valueY - 10 + valueH;
      
      // Background with rounded corners
      if (style.currentStyle !== 'wireframe') {
        this.ctx.fillStyle = isValueHovered ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.ctx.moveTo(valueX + valueRadius, valueY - 10);
        this.ctx.lineTo(valueX + valueW - valueRadius, valueY - 10);
        this.ctx.quadraticCurveTo(valueX + valueW, valueY - 10, valueX + valueW, valueY - 10 + valueRadius);
        this.ctx.lineTo(valueX + valueW, valueY - 10 + valueH - valueRadius);
        this.ctx.quadraticCurveTo(valueX + valueW, valueY - 10 + valueH, valueX + valueW - valueRadius, valueY - 10 + valueH);
        this.ctx.lineTo(valueX + valueRadius, valueY - 10 + valueH);
        this.ctx.quadraticCurveTo(valueX, valueY - 10 + valueH, valueX, valueY - 10 + valueH - valueRadius);
        this.ctx.lineTo(valueX, valueY - 10 + valueRadius);
        this.ctx.quadraticCurveTo(valueX, valueY - 10, valueX + valueRadius, valueY - 10);
        this.ctx.closePath();
        this.ctx.fill();
      }
      
      // Border with rounded corners
      this.ctx.strokeStyle = isValueHovered ? colors.borderHighlight : colors.borderColor;
      this.ctx.lineWidth = (isValueHovered ? 2 : 1.5) / this.camera.scale;
      this.ctx.stroke();
      
      // Inner highlight
      if (isValueHovered) {
        this.ctx.strokeStyle = 'rgba(70, 162, 218, 0.3)';
        this.ctx.lineWidth = 2.5 / this.camera.scale;
        this.ctx.stroke();
      } else {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1 / this.camera.scale;
        this.ctx.stroke();
      }
      
      // Value text
      this.ctx.fillStyle = colors.textPrimary;
      this.ctx.font = (10 * textScale) + 'px ' + style.textFont;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      let displayValue = String(node.properties.value);
      if (displayValue.length > 20) displayValue = displayValue.substring(0, 20) + '...';
      this.ctx.fillText(displayValue, valueX + valueW / 2, valueY);
      
      // Edit cursor hint
      if (isValueHovered) {
        this.canvas.style.cursor = 'text';
      }
    }
  }

  drawInputSlot(node, j, x, y, w, worldMouse, colors) {
    const style = this.drawingStyleManager.getStyle();
    const textScale = this.getTextScale();
    const inp = node.inputs[j];
    const sy = y + 38 + j * 25;
    const hovered = this.connecting && !this.connecting.isOutput && 
      Math.abs(worldMouse[0] - x) < 10 && Math.abs(worldMouse[1] - sy) < 10;
    const compat = this.isSlotCompatible(node, j, false);
    
    const isMulti = node.multiInputs && node.multiInputs[j];
    const hasConnections = isMulti ? node.multiInputs[j].links.length > 0 : inp.link;
    
    let color;
    if (hovered && compat) color = colors.accentGreen;
    else if (hovered && !compat) color = colors.accentRed;
    else if (hasConnections) color = colors.slotConnected;
    else color = colors.slotInput;
    
    if (this.connecting && compat) {
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.arc(x - 1, sy, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    }
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x - 1, sy, style.slotRadius || 4, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.beginPath();
    this.ctx.arc(x - 2, sy - 1, 1.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    if (isMulti) {
      this.ctx.strokeStyle = colors.accentPurple || '#9370db';
      this.ctx.lineWidth = 1.5 / this.camera.scale;
      this.ctx.beginPath();
      this.ctx.arc(x - 1, sy, 6, 0, Math.PI * 2);
      this.ctx.stroke();
      
      if (node.multiInputs[j].links.length > 0) {
        this.ctx.fillStyle = colors.accentPurple || '#9370db';
        this.ctx.font = 'bold ' + (8 * textScale) + 'px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(node.multiInputs[j].links.length, x + 10, sy - 10);
      }
    }
    
    // Field name with text scaling
    this.ctx.fillStyle = colors.textSecondary;
    this.ctx.font = (10 * textScale) + 'px Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(inp.name, x + 10, sy);
    
    // Field type with text scaling and rounded box
    if (!node.isNative || node.nativeInputs[j] === undefined) {
      const compactType = this.graph.compactType(inp.type);
      let typeText = compactType.length > 20 ? compactType.substring(0, 20) + '...' : compactType;
      
      // Measure text to create properly sized box
      this.ctx.font = (8 * textScale) + 'px "Courier New", monospace';
      const textWidth = this.ctx.measureText(typeText).width;
      const typeBoxX = x + 10;
      const typeBoxY = sy + 10 - 5;
      const typeBoxW = textWidth + 8;
      const typeBoxH = 10;
      const typeBoxRadius = 2;
      
      // Background with rounded corners
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.moveTo(typeBoxX + typeBoxRadius, typeBoxY);
      this.ctx.lineTo(typeBoxX + typeBoxW - typeBoxRadius, typeBoxY);
      this.ctx.quadraticCurveTo(typeBoxX + typeBoxW, typeBoxY, typeBoxX + typeBoxW, typeBoxY + typeBoxRadius);
      this.ctx.lineTo(typeBoxX + typeBoxW, typeBoxY + typeBoxH - typeBoxRadius);
      this.ctx.quadraticCurveTo(typeBoxX + typeBoxW, typeBoxY + typeBoxH, typeBoxX + typeBoxW - typeBoxRadius, typeBoxY + typeBoxH);
      this.ctx.lineTo(typeBoxX + typeBoxRadius, typeBoxY + typeBoxH);
      this.ctx.quadraticCurveTo(typeBoxX, typeBoxY + typeBoxH, typeBoxX, typeBoxY + typeBoxH - typeBoxRadius);
      this.ctx.lineTo(typeBoxX, typeBoxY + typeBoxRadius);
      this.ctx.quadraticCurveTo(typeBoxX, typeBoxY, typeBoxX + typeBoxRadius, typeBoxY);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Border
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.lineWidth = 0.5 / this.camera.scale;
      this.ctx.stroke();
      
      // Type text
      this.ctx.fillStyle = colors.textTertiary;
      this.ctx.textAlign = 'left';
      this.ctx.fillText(typeText, typeBoxX + 4, sy + 10);
    }
    
    // Native input value box with rounded corners
    if (!isMulti && !inp.link && node.nativeInputs && node.nativeInputs[j] !== undefined) {
      const boxX = x + w - 70;
      const boxY = sy - 8;
      const boxW = 65;
      const boxH = 16;
      const boxRadius = 4;
      const isOptional = node.nativeInputs[j].optional;
      
      // Check if mouse is hovering over the box
      const isBoxHovered = !this.connecting && 
        worldMouse[0] >= boxX && worldMouse[0] <= boxX + boxW &&
        worldMouse[1] >= boxY && worldMouse[1] <= boxY + boxH;
      
      // Background with rounded corners
      this.ctx.fillStyle = isBoxHovered 
        ? (isOptional ? 'rgba(0, 120, 180, 0.35)' : 'rgba(0, 0, 0, 0.6)')
        : (isOptional ? 'rgba(0, 100, 150, 0.25)' : 'rgba(0, 0, 0, 0.5)');
      this.ctx.beginPath();
      this.ctx.moveTo(boxX + boxRadius, boxY);
      this.ctx.lineTo(boxX + boxW - boxRadius, boxY);
      this.ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + boxRadius);
      this.ctx.lineTo(boxX + boxW, boxY + boxH - boxRadius);
      this.ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - boxRadius, boxY + boxH);
      this.ctx.lineTo(boxX + boxRadius, boxY + boxH);
      this.ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - boxRadius);
      this.ctx.lineTo(boxX, boxY + boxRadius);
      this.ctx.quadraticCurveTo(boxX, boxY, boxX + boxRadius, boxY);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Border with rounded corners
      this.ctx.strokeStyle = isBoxHovered
        ? (isOptional ? 'rgba(100, 180, 230, 0.8)' : colors.borderHighlight)
        : (isOptional ? 'rgba(70, 162, 218, 0.6)' : (colors.borderColor || '#1a1a1a'));
      this.ctx.lineWidth = (isBoxHovered ? 2 : 1.5) / this.camera.scale;
      this.ctx.stroke();
      
      // Inner glow for optional fields
      if (isOptional && isBoxHovered) {
        this.ctx.strokeStyle = 'rgba(70, 162, 218, 0.4)';
        this.ctx.lineWidth = 3 / this.camera.scale;
        this.ctx.stroke();
      }
      
      const displayVal = node.nativeInputs[j].value;
      const isEmpty = displayVal === '' || displayVal === null || displayVal === undefined;
      
      if (isEmpty) {
        if (isOptional) {
          this.ctx.fillStyle = colors.textTertiary;
          this.ctx.font = 'italic ' + (8 * textScale) + 'px Arial, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('null', boxX + boxW / 2, sy);
        } else {
          this.ctx.fillStyle = colors.textSecondary;
          this.ctx.font = 'italic ' + (8 * textScale) + 'px Arial, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('empty', boxX + boxW / 2, sy);
        }
      } else {
        this.ctx.fillStyle = colors.textPrimary;
        this.ctx.font = (9 * textScale) + 'px "Courier New", monospace';
        this.ctx.textAlign = 'left';
        let displayValue = String(displayVal);
        if (displayValue.length > 8) {
          displayValue = displayValue.substring(0, 8) + '...';
        }
        this.ctx.fillText(displayValue, boxX + 6, sy);
      }
      
      // Optional indicator badge
      if (isOptional) {
        const badgeSize = 10;
        const badgeX = boxX + boxW - badgeSize / 2;
        const badgeY = boxY - badgeSize / 2;
        
        // Badge circle
        this.ctx.fillStyle = isBoxHovered ? 'rgba(100, 180, 230, 1.0)' : 'rgba(70, 162, 218, 0.9)';
        this.ctx.beginPath();
        this.ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Badge border
        this.ctx.strokeStyle = colors.textPrimary;
        this.ctx.lineWidth = 1 / this.camera.scale;
        this.ctx.stroke();
        
        // Question mark
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold ' + (7 * textScale) + 'px Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('?', badgeX, badgeY);
      }
      
      // Edit cursor hint
      if (isBoxHovered) {
        this.canvas.style.cursor = 'text';
      }
    }
  }

  drawOutputSlot(node, j, x, y, w, worldMouse, colors) {
    const style = this.drawingStyleManager.getStyle();
    const textScale = this.getTextScale();
    const out = node.outputs[j];
    const sy = y + 38 + j * 25;  // Start slots 5px lower
    const hovered = this.connecting && this.connecting.isOutput && 
      Math.abs(worldMouse[0] - (x + w)) < 10 && Math.abs(worldMouse[1] - sy) < 10;
    const compat = this.isSlotCompatible(node, j, true);
    
    const hasConnections = out.links.length > 0;
    
    let color;
    if (hovered && compat) color = colors.accentGreen;
    else if (hovered && !compat) color = colors.accentRed;
    else if (hasConnections) color = colors.slotConnected;
    else color = colors.slotOutput;
    
    if (this.connecting && compat) {
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.arc(x + w + 1, sy, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    }
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x + w + 1, sy, style.slotRadius || 4, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.beginPath();
    this.ctx.arc(x + w, sy - 1, 1.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Output name with text scaling
    this.ctx.fillStyle = colors.textSecondary;
    this.ctx.font = (10 * textScale) + 'px Arial, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(out.name, x + w - 10, sy);
    
    // Output type with text scaling and rounded box
    if (!node.isNative) {
      const compactType = this.graph.compactType(out.type);
      let typeText = compactType.length > 15 ? compactType.substring(0, 15) + '...' : compactType;
      
      // Measure text to create properly sized box
      this.ctx.font = (8 * textScale) + 'px "Courier New", monospace';
      const textWidth = this.ctx.measureText(typeText).width;
      const typeBoxX = x + w - 10 - textWidth - 8;
      const typeBoxY = sy + 10 - 5;
      const typeBoxW = textWidth + 8;
      const typeBoxH = 10;
      const typeBoxRadius = 2;
      
      // Background with rounded corners
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.moveTo(typeBoxX + typeBoxRadius, typeBoxY);
      this.ctx.lineTo(typeBoxX + typeBoxW - typeBoxRadius, typeBoxY);
      this.ctx.quadraticCurveTo(typeBoxX + typeBoxW, typeBoxY, typeBoxX + typeBoxW, typeBoxY + typeBoxRadius);
      this.ctx.lineTo(typeBoxX + typeBoxW, typeBoxY + typeBoxH - typeBoxRadius);
      this.ctx.quadraticCurveTo(typeBoxX + typeBoxW, typeBoxY + typeBoxH, typeBoxX + typeBoxW - typeBoxRadius, typeBoxY + typeBoxH);
      this.ctx.lineTo(typeBoxX + typeBoxRadius, typeBoxY + typeBoxH);
      this.ctx.quadraticCurveTo(typeBoxX, typeBoxY + typeBoxH, typeBoxX, typeBoxY + typeBoxH - typeBoxRadius);
      this.ctx.lineTo(typeBoxX, typeBoxY + typeBoxRadius);
      this.ctx.quadraticCurveTo(typeBoxX, typeBoxY, typeBoxX + typeBoxRadius, typeBoxY);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Border
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.lineWidth = 0.5 / this.camera.scale;
      this.ctx.stroke();
      
      // Type text
      this.ctx.fillStyle = colors.textTertiary;
      this.ctx.textAlign = 'right';
      this.ctx.fillText(typeText, x + w - 10 - 4, sy + 10);
    }
  }

  drawConnecting(colors) {
    const node = this.connecting.node;
    const worldMouse = this.screenToWorld(this.mousePos[0], this.mousePos[1]);
    let x1, y1;
    
    if (this.connecting.isOutput) {
      x1 = node.pos[0] + node.size[0];
      y1 = node.pos[1] + 33 + this.connecting.slot * 25;
    } else {
      x1 = node.pos[0];
      y1 = node.pos[1] + 33 + this.connecting.slot * 25;
    }
    
    // Better curve calculation - limit control point distance
    const distance = Math.abs(worldMouse[0] - x1);
    const maxControlDistance = 400;
    const controlOffset = Math.min(distance * 0.5, maxControlDistance);
    const cx1 = x1 + (this.connecting.isOutput ? controlOffset : -controlOffset);
    const cx2 = worldMouse[0] + (this.connecting.isOutput ? -controlOffset : controlOffset);
    
    this.ctx.strokeStyle = colors.accentGreen;
    this.ctx.lineWidth = 2.5 / this.camera.scale;
    this.ctx.globalAlpha = 1.0;
    this.ctx.setLineDash([10 / this.camera.scale, 5 / this.camera.scale]);
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.bezierCurveTo(cx1, y1, cx2, worldMouse[1], worldMouse[0], worldMouse[1]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.globalAlpha = 1.0;
  }

  adjustColorBrightness(color, amount) {
    // Simple color brightness adjustment
    // This is a helper for gradient effects
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
}

// ========================================================================
// INITIALIZATION
// ========================================================================

let gApp = null;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    gApp = new SchemaGraphApp();
    window.graph = gApp.graph;
    window.app = gApp;
    window.eventBus = gApp.eventBus;
    window.analytics = gApp.analytics;
    
    // Export utility methods for console debugging
    window.disconnectLink = (linkId) => {
      const result = gApp.disconnectLink(linkId);
      gApp.draw();
      return result;
    };
    window.clearMultiInputLinks = (node, slotIdx) => gApp.clearMultiInputLinks(node, slotIdx);
    window.clearAllMultiInputLinks = (node) => gApp.clearAllMultiInputLinks(node);
    
    console.log('💡 Debugging utilities available:');
    console.log('   - disconnectLink(linkId)');
    console.log('   - clearMultiInputLinks(node, slotIdx)');
    console.log('   - clearAllMultiInputLinks(node)');
  });
} else {
  gApp = new SchemaGraphApp();
  window.graph = gApp.graph;
  window.app = gApp;
  window.eventBus = gApp.eventBus;
  window.analytics = gApp.analytics;
  
  // Export utility methods for console debugging
  window.disconnectLink = (linkId) => {
    const result = gApp.disconnectLink(linkId);
    gApp.draw();
    return result;
  };
  window.clearMultiInputLinks = (node, slotIdx) => gApp.clearMultiInputLinks(node, slotIdx);
  window.clearAllMultiInputLinks = (node) => gApp.clearAllMultiInputLinks(node);
  
  console.log('💡 Debugging utilities available:');
  console.log('   - disconnectLink(linkId)');
  console.log('   - clearMultiInputLinks(node, slotIdx)');
  console.log('   - clearAllMultiInputLinks(node)');
}
