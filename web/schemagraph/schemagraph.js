console.log('=== SCHEMAGRAPH LOADING ===');

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
  constructor() {
    super();
    this.schemas   = {};
    this.nodeTypes = {};
  }

  registerSchema(schemaName, schemaCode, indexType = 'int', rootType = null) {
    try {
      console.log('=== REGISTERING SCHEMA:', schemaName, '===');
      console.log('Root type:', rootType);
      console.log('Index type:', indexType);
      
      const parsed = this._parseSchema(schemaCode);
      console.log('Parsed models:', Object.keys(parsed));
      
      const fieldMapping = this._createFieldMappingFromSchema(schemaCode, parsed, rootType);
      console.log('Field mapping created:', fieldMapping);
      
      this.schemas[schemaName] = { 
        code: schemaCode, 
        parsed, 
        indexType,
        rootType,
        fieldMapping
      };
      this._generateNodes(schemaName, parsed, indexType);
      console.log('=== SCHEMA REGISTRATION COMPLETE ===');
      return true;
    } catch (e) {
      console.error('Schema error:', e);
      return false;
    }
  }

  _createFieldMappingFromSchema(schemaCode, parsedModels, rootType) {
    console.log('=== BUILDING FIELD MAPPING FROM SCHEMA ===');
    console.log('Root type:', rootType);
    console.log('Available models:', Object.keys(parsedModels));
    
    const mapping = {
      modelToField: {},
      fieldToModel: {}
    };
    
    if (!rootType) {
      console.warn('⚠ No root type specified - using fallback');
      return this._createFallbackMapping(parsedModels);
    }
    
    if (!parsedModels[rootType]) {
      console.warn('⚠ Root type not found in parsed models:', rootType);
      return this._createFallbackMapping(parsedModels);
    }
    
    const rootFields = parsedModels[rootType];
    console.log('📋 Root config has', rootFields.length, 'fields');
    
    for (const field of rootFields) {
      const fieldName = field.name;
      const fieldType = field.type;
      
      console.log('  Analyzing field:', fieldName);
      console.log('    Raw type:', field.rawType);
      console.log('    Parsed type kind:', fieldType.kind);
      
      const modelType = this._extractModelTypeFromField(fieldType);
      
      if (modelType && parsedModels[modelType]) {
        mapping.modelToField[modelType] = fieldName;
        mapping.fieldToModel[fieldName] = modelType;
        console.log('    ✅ MAPPED:', modelType, '↔', fieldName);
      } else if (modelType) {
        console.log('    ⚠️ Model type', modelType, 'not in parsed models');
        console.log('    Available models:', Object.keys(parsedModels).join(', '));
      } else {
        console.log('    ℹ️ Not a model reference (primitive or complex type)');
      }
    }
    
    console.log('=== MAPPING SUMMARY ===');
    console.log('Total mappings:', Object.keys(mapping.modelToField).length);
    console.log('Model → Field:', mapping.modelToField);
    console.log('Field → Model:', mapping.fieldToModel);
    console.log('======================');
    
    return mapping;
  }
  
  _extractModelTypeFromField(fieldType) {
    let current = fieldType;
    
    if (current.kind === 'optional') {
      current = current.inner;
    }
    
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
            if (type.endsWith('Config')) {
              return type;
            }
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
      if (current.name && current.name.endsWith('Config')) {
        return current.name;
      }
      return null;
    }
    
    return null;
  }
  
  _createFallbackMapping(parsedModels) {
    console.warn('⚠️ Using fallback mapping - field names may be incorrect!');
    
    const mapping = {
      modelToField: {},
      fieldToModel: {}
    };
    
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
        } else if (fieldName.endsWith('x') || fieldName.endsWith('ch') || fieldName.endsWith('sh')) {
          fieldName = fieldName + 'es';
        } else {
          fieldName = fieldName + 's';
        }
      }
      
      mapping.modelToField[modelName] = fieldName;
      mapping.fieldToModel[fieldName] = modelName;
      console.warn('  Fallback:', modelName, '→', fieldName);
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
      
      if (isRootType) {
        console.log('🌟 Generating ROOT TYPE node:', schemaName + '.' + modelName);
      }
      
      class GeneratedNode extends LNode {
        constructor() {
          super(schemaName + '.' + modelName);
          this.schemaName = schemaName;
          this.modelName = modelName;
          this.isRootType = isRootType;
          this.addOutput('self', modelName);
          
          if (this.isRootType) {
            console.log('✨ Created ROOT TYPE node instance:', this.title);
          }
          
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
              this.multiInputs[i] = {
                type: compactType,
                links: []
              };
            } else {
              this.addInput(f.name, compactType);
              
              const isNative = self._isNativeType(compactType);
              if (isNative) {
                this.nativeInputs[i] = {
                  type: self._getNativeBaseType(compactType),
                  value: '',
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
                
                // Check if value is truly empty (not false, not 0)
                const isEmpty = val === null || val === undefined || val === '';
                
                if (isOptional && isEmpty) {
                  continue;
                }
                
                if (!isEmpty || typeof val === 'boolean' || typeof val === 'number') {
                  if (this.nativeInputs[i].type === 'dict') {
                    try {
                      data[this.inputs[i].name] = JSON.parse(val);
                    } catch (e) {
                      console.warn('Failed to parse dict value:', val);
                      data[this.inputs[i].name] = {};
                    }
                  } else if (this.nativeInputs[i].type === 'list') {
                    try {
                      data[this.inputs[i].name] = JSON.parse(val);
                    } catch (e) {
                      console.warn('Failed to parse list value:', val);
                      data[this.inputs[i].name] = [];
                    }
                  } else if (this.nativeInputs[i].type === 'set') {
                    try {
                      data[this.inputs[i].name] = JSON.parse(val);
                    } catch (e) {
                      console.warn('Failed to parse set value:', val);
                      data[this.inputs[i].name] = [];
                    }
                  } else if (this.nativeInputs[i].type === 'tuple') {
                    try {
                      data[this.inputs[i].name] = JSON.parse(val);
                    } catch (e) {
                      console.warn('Failed to parse tuple value:', val);
                      data[this.inputs[i].name] = [];
                    }
                  } else if (this.nativeInputs[i].type === 'int') {
                    data[this.inputs[i].name] = parseInt(val) || 0;
                  } else if (this.nativeInputs[i].type === 'float') {
                    data[this.inputs[i].name] = parseFloat(val) || 0.0;
                  } else if (this.nativeInputs[i].type === 'bool') {
                    data[this.inputs[i].name] = val === true || val === 'true';
                  } else {
                    data[this.inputs[i].name] = val;
                  }
                } else if (!isOptional) {
                  if (this.nativeInputs[i].type === 'int') {
                    data[this.inputs[i].name] = 0;
                  } else if (this.nativeInputs[i].type === 'float') {
                    data[this.inputs[i].name] = 0.0;
                  } else if (this.nativeInputs[i].type === 'bool') {
                    data[this.inputs[i].name] = false;
                  } else if (this.nativeInputs[i].type === 'dict') {
                    data[this.inputs[i].name] = {};
                  } else if (this.nativeInputs[i].type === 'list') {
                    data[this.inputs[i].name] = [];
                  } else if (this.nativeInputs[i].type === 'set') {
                    data[this.inputs[i].name] = [];
                  } else if (this.nativeInputs[i].type === 'tuple') {
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
    
    if (current.kind === 'optional') {
      current = current.inner;
    }
    
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
    
    if (current.kind === 'optional') {
      current = current.inner;
    }
    
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

  _getDefaultValue(typeStr) {
    const base = this._getNativeBaseType(typeStr);
    if (base === 'int') return 0;
    if (base === 'bool') return false;
    if (base === 'float') return 0.0;
    if (base === 'dict') return '{}';
    if (base === 'list') return '[]';
    if (base === 'set') return '[]';
    if (base === 'tuple') return '[]';
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
    return node;
  }

  removeSchema(schemaName) {
    if (!this.schemas[schemaName]) {
      console.warn('Schema not found:', schemaName);
      return false;
    }
    
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
    return true;
  }

  getRegisteredSchemas() {
    return Object.keys(this.schemas);
  }

  getAvailableNodeTypes() {
    return Object.keys(this.nodeTypes);
  }

  serialize(includeCamera = false) {
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
    
    if (includeCamera && window.graphCamera) {
      data.camera = {
        x: window.graphCamera.x,
        y: window.graphCamera.y,
        scale: window.graphCamera.scale
      };
    }
    
    return data;
  }

  deserialize(data, restoreCamera = false) {
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
        console.warn('Node type not found:', nodeTypeKey, '- Skipping node');
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
    
    if (restoreCamera && data.camera && window.graphCamera) {
      window.graphCamera.x = data.camera.x;
      window.graphCamera.y = data.camera.y;
      window.graphCamera.scale = data.camera.scale;
    }
    
    return true;
  }
}

// ========================================================================
// SCHEMAGRAPH APPLICATION
// ========================================================================

class SchemaGraphApp {
  constructor() {
    this.initializeElements();
    this.initializeState();
    this.initializeTheme();
    this.registerNativeNodes();
    this.setupEventListeners();
    this.resizeCanvas();
    this.updateSchemaList();
    // this.loadExampleSchema();
    this.setReady();
    this.draw();
    
    console.log('=== SCHEMAGRAPH READY ===');
  }

  initializeElements() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.statusEl = document.getElementById('status');
    this.errorEl = document.getElementById('errorBanner');
    this.nodeTypesListEl = document.getElementById('nodeTypesList');
    this.zoomEl = document.getElementById('zoomLevel');
    this.contextMenu = document.getElementById('contextMenu');
    this.nodeInput = document.getElementById('nodeInput');
    this.schemaListEl = document.getElementById('schemaList');
    this.themeBtn = document.getElementById('themeBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.importFile = document.getElementById('importFile');
    this.exportConfigBtn = document.getElementById('exportConfigBtn');
    this.importConfigBtn = document.getElementById('importConfigBtn');
    this.importConfigFile = document.getElementById('importConfigFile');
    this.uploadSchemaBtn = document.getElementById('uploadSchemaBtn');
    this.uploadSchemaFile = document.getElementById('uploadSchemaFile');
    this.schemaDialog = document.getElementById('schemaDialog');
    this.schemaNameInput = document.getElementById('schemaNameInput');
    this.schemaIndexTypeInput = document.getElementById('schemaIndexTypeInput');
    this.schemaRootTypeInput = document.getElementById('schemaRootTypeInput');
    this.schemaDialogConfirm = document.getElementById('schemaDialogConfirm');
    this.schemaDialogCancel = document.getElementById('schemaDialogCancel');
    this.schemaRemovalDialog = document.getElementById('schemaRemovalDialog');
    this.schemaRemovalNameInput = document.getElementById('schemaRemovalNameInput');
    this.schemaRemovalConfirm = document.getElementById('schemaRemovalConfirm');
    this.schemaRemovalCancel = document.getElementById('schemaRemovalCancel');
    this.centerViewBtn = document.getElementById('centerViewBtn');
    this.layoutSelect = document.getElementById('layoutSelect');
    this.resetZoomBtn = document.getElementById('resetZoomBtn');
  }

  initializeState() {
    this.graph = new SchemaGraph();
    this.camera = { x: 0, y: 0, scale: 1.0 };
    window.graphCamera = this.camera;
    
    this.selectedNode = null;
    this.dragNode = null;
    this.dragOffset = [0, 0];
    this.connecting = null;
    this.mousePos = [0, 0];
    this.isPanning = false;
    this.panStart = [0, 0];
    this.spacePressed = false;
    this.editingNode = null;
    this.pendingSchemaCode = null;
  }

  initializeTheme() {
    this.themes = ['dark', 'light', 'ocean'];
    this.currentThemeIndex = 0;
    this.loadTheme();
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('schemagraph-theme') || 'dark';
    this.currentThemeIndex = this.themes.indexOf(savedTheme);
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
  }

  registerNativeNodes() {
    const nativeNodes = [
      { name: 'String', type: 'str', defaultValue: '', parser: (v) => v },
      { name: 'Integer', type: 'int', defaultValue: 0, parser: (v) => parseInt(v) || 0 },
      { name: 'Boolean', type: 'bool', defaultValue: false, parser: (v) => v },
      { name: 'Float', type: 'float', defaultValue: 0.0, parser: (v) => parseFloat(v) || 0.0 },
      { name: 'List', type: 'List[Any]', defaultValue: '[]', parser: (v) => {
        try { return JSON.parse(v); } catch (e) { return []; }
      }},
      { name: 'Dict', type: 'Dict[str,Any]', defaultValue: '{}', parser: (v) => {
        try { return JSON.parse(v); } catch (e) { return {}; }
      }},
      { name: 'Set', type: 'Set[Any]', defaultValue: '[]', parser: (v) => {
        try { return JSON.parse(v); } catch (e) { return []; }
      }},
      { name: 'Tuple', type: 'Tuple[Any,...]', defaultValue: '[]', parser: (v) => {
        try { return JSON.parse(v); } catch (e) { return []; }
      }}
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

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
    this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#contextMenu')) {
        this.contextMenu.classList.remove('show');
      }
    });
    
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    this.nodeInput.addEventListener('blur', () => this.handleInputBlur());
    this.nodeInput.addEventListener('keydown', (e) => this.handleInputKeyDown(e));
    
    this.themeBtn.addEventListener('click', () => {
      this.cycleTheme();
      this.draw();
    });
    
    this.exportBtn.addEventListener('click', () => this.exportGraph());
    this.importBtn.addEventListener('click', () => this.importFile.click());
    this.importFile.addEventListener('change', (e) => this.handleImportGraph(e));
    
    this.exportConfigBtn.addEventListener('click', () => this.exportConfig());
    this.importConfigBtn.addEventListener('click', () => this.importConfigFile.click());
    this.importConfigFile.addEventListener('change', (e) => this.handleImportConfig(e));
    
    this.uploadSchemaBtn.addEventListener('click', () => this.uploadSchemaFile.click());
    this.uploadSchemaFile.addEventListener('change', (e) => this.handleSchemaFileUpload(e));
    this.schemaDialogConfirm.addEventListener('click', () => this.confirmSchemaRegistration());
    this.schemaDialogCancel.addEventListener('click', () => this.cancelSchemaRegistration());
    this.schemaRemovalConfirm.addEventListener('click', () => this.confirmSchemaRemoval());
    this.schemaRemovalCancel.addEventListener('click', () => this.cancelSchemaRemoval());
    
    this.schemaDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmSchemaRegistration();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelSchemaRegistration();
      }
    });
    
    this.schemaRemovalDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmSchemaRemoval();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelSchemaRemoval();
      }
    });
    
    this.centerViewBtn.addEventListener('click', () => this.centerView());
    this.layoutSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        this.applyLayout(e.target.value);
        e.target.value = '';
      }
    });
    this.resetZoomBtn.addEventListener('click', () => this.resetZoom());
    
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  getCanvasCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return [(sx / rect.width) * this.canvas.width, (sy / rect.height) * this.canvas.height];
  }

  screenToWorld(sx, sy) {
    return [(sx - this.camera.x) / this.camera.scale, (sy - this.camera.y) / this.camera.scale];
  }

  worldToScreen(wx, wy) {
    return [wx * this.camera.scale + this.camera.x, wy * this.camera.scale + this.camera.y];
  }

  handleMouseDown(e) {
    this.contextMenu.classList.remove('show');
    
    const [canvasX, canvasY] = this.getCanvasCoordinates(e);
    const [wx, wy] = this.screenToWorld(canvasX, canvasY);
    
    if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
      e.preventDefault();
      this.isPanning = true;
      this.panStart = [canvasX - this.camera.x, canvasY - this.camera.y];
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    
    if (e.button !== 0 || this.spacePressed) return;
    
    for (const node of this.graph.nodes) {
      const nx = node.pos[0];
      const ny = node.pos[1];
      const nw = node.size[0];
      
      for (let j = 0; j < node.outputs.length; j++) {
        const slotY = ny + 30 + j * 25;
        const dist = Math.sqrt(Math.pow(wx - (nx + nw), 2) + Math.pow(wy - slotY, 2));
        if (dist < 10) {
          this.connecting = { node, slot: j, isOutput: true };
          this.canvas.classList.add('connecting');
          return;
        }
      }
      
      for (let j = 0; j < node.inputs.length; j++) {
        const slotY = ny + 30 + j * 25;
        const dist = Math.sqrt(Math.pow(wx - nx, 2) + Math.pow(wy - slotY, 2));
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
    
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i];
      const nx = node.pos[0];
      const ny = node.pos[1];
      const nw = node.size[0];
      const nh = node.size[1];
      if (wx >= nx && wx <= nx + nw && wy >= ny && wy <= ny + nh) {
        this.selectedNode = node;
        this.dragNode = node;
        this.dragOffset = [wx - nx, wy - ny];
        this.canvas.classList.add('dragging');
        this.draw();
        return;
      }
    }
    
    this.selectedNode = null;
    this.draw();
  }

  handleMouseMove(e) {
    const [canvasX, canvasY] = this.getCanvasCoordinates(e);
    this.mousePos = [canvasX, canvasY];
    
    if (this.isPanning) {
      this.camera.x = canvasX - this.panStart[0];
      this.camera.y = canvasY - this.panStart[1];
      this.draw();
    } else if (this.dragNode && !this.connecting) {
      const [wx, wy] = this.screenToWorld(canvasX, canvasY);
      this.dragNode.pos = [wx - this.dragOffset[0], wy - this.dragOffset[1]];
      this.draw();
    } else if (this.connecting) {
      this.draw();
    }
  }

  handleMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spacePressed ? 'grab' : 'default';
      return;
    }
    
    if (this.connecting) {
      const [canvasX, canvasY] = this.getCanvasCoordinates(e);
      const [wx, wy] = this.screenToWorld(canvasX, canvasY);
      
      for (const node of this.graph.nodes) {
        const nx = node.pos[0];
        const ny = node.pos[1];
        const nw = node.size[0];
        
        if (this.connecting.isOutput) {
          for (let j = 0; j < node.inputs.length; j++) {
            const slotY = ny + 30 + j * 25;
            const dist = Math.sqrt(Math.pow(wx - nx, 2) + Math.pow(wy - slotY, 2));
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
              } else {
                if (node.inputs[j].link) {
                  this.removeLink(node.inputs[j].link, node, j);
                }
                this.graph.connect(this.connecting.node, this.connecting.slot, node, j);
              }
              break;
            }
          }
        } else {
          for (let j = 0; j < node.outputs.length; j++) {
            const slotY = ny + 30 + j * 25;
            const dist = Math.sqrt(Math.pow(wx - (nx + nw), 2) + Math.pow(wy - slotY, 2));
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
              } else {
                if (this.connecting.node.inputs[this.connecting.slot].link) {
                  this.removeLink(this.connecting.node.inputs[this.connecting.slot].link, this.connecting.node, this.connecting.slot);
                }
                this.graph.connect(node, j, this.connecting.node, this.connecting.slot);
              }
              break;
            }
          }
        }
      }
      
      this.connecting = null;
      this.canvas.classList.remove('connecting');
      this.draw();
    }
    
    this.dragNode = null;
    this.canvas.classList.remove('dragging');
  }

  handleDoubleClick(e) {
    const [canvasX, canvasY] = this.getCanvasCoordinates(e);
    const [wx, wy] = this.screenToWorld(canvasX, canvasY);
    const rect = this.canvas.getBoundingClientRect();
    
    for (const node of this.graph.nodes) {
      if (node.nativeInputs) {
        const nx = node.pos[0];
        const ny = node.pos[1];
        const nw = node.size[0];
        
        for (let j = 0; j < node.inputs.length; j++) {
          if (!node.inputs[j].link && node.nativeInputs[j] !== undefined) {
            const slotY = ny + 30 + j * 25;
            const boxX = nx + nw - 85;
            const boxY = slotY - 10;
            const boxW = 80;
            const boxH = 18;
            
            if (wx >= boxX && wx <= boxX + boxW && wy >= boxY && wy <= boxY + boxH) {
              if (node.nativeInputs[j].type === 'bool') {
                node.nativeInputs[j].value = !node.nativeInputs[j].value;
                this.draw();
                return;
              }
              
              const valueScreen = this.worldToScreen(boxX, boxY);
              this.editingNode = node;
              this.editingNode.editingSlot = j;
              this.nodeInput.value = String(node.nativeInputs[j].value);
              this.nodeInput.style.left = (valueScreen[0] * rect.width / this.canvas.width + rect.left) + 'px';
              this.nodeInput.style.top = (valueScreen[1] * rect.height / this.canvas.height + rect.top) + 'px';
              this.nodeInput.style.width = '75px';
              this.nodeInput.classList.add('show');
              this.nodeInput.focus();
              this.nodeInput.select();
              return;
            }
          }
        }
      }
    }
    
    for (const node of this.graph.nodes) {
      if (!node.isNative) continue;
      const nx = node.pos[0];
      const ny = node.pos[1];
      const nw = node.size[0];
      const nh = node.size[1];
      const valueY = ny + nh - 27;
      const valueHeight = 20;
      
      if (wx >= nx + 5 && wx <= nx + nw - 5 && wy >= valueY && wy <= valueY + valueHeight) {
        if (node.title === 'Boolean') {
          node.properties.value = !node.properties.value;
          this.draw();
        } else {
          const valueScreen = this.worldToScreen(nx + 5, valueY);
          this.editingNode = node;
          this.editingNode.editingSlot = null;
          this.nodeInput.value = String(node.properties.value);
          this.nodeInput.style.left = (valueScreen[0] * rect.width / this.canvas.width + rect.left) + 'px';
          this.nodeInput.style.top = (valueScreen[1] * rect.height / this.canvas.height + rect.top) + 'px';
          this.nodeInput.style.width = '160px';
          this.nodeInput.classList.add('show');
          this.nodeInput.focus();
          this.nodeInput.select();
        }
        return;
      }
    }
  }

  handleWheel(e) {
    e.preventDefault();
    const [canvasX, canvasY] = this.getCanvasCoordinates(e);
    const before = this.screenToWorld(canvasX, canvasY);
    this.camera.scale *= e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.scale = Math.max(0.1, Math.min(5, this.camera.scale));
    const after = this.screenToWorld(canvasX, canvasY);
    this.camera.x += (after[0] - before[0]) * this.camera.scale;
    this.camera.y += (after[1] - before[1]) * this.camera.scale;
    this.zoomEl.textContent = Math.round(this.camera.scale * 100) + '%';
    this.draw();
  }

  handleContextMenu(e) {
    e.preventDefault();
    const [canvasX, canvasY] = this.getCanvasCoordinates(e);
    const [wx, wy] = this.screenToWorld(canvasX, canvasY);
    const rect = this.canvas.getBoundingClientRect();
    
    let clickedNode = null;
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i];
      const nx = node.pos[0];
      const ny = node.pos[1];
      const nw = node.size[0];
      const nh = node.size[1];
      if (wx >= nx && wx <= nx + nw && wy >= ny && wy <= ny + nh) {
        clickedNode = node;
        break;
      }
    }
    
    let html = '';
    
    if (clickedNode) {
      html += '<div class="context-menu-category">Node Actions</div>';
      html += '<div class="context-menu-item context-menu-delete" data-action="delete">Delete Node</div>';
      
      this.contextMenu.innerHTML = html;
      this.contextMenu.style.left = (rect.left + canvasX * rect.width / this.canvas.width) + 'px';
      this.contextMenu.style.top = (rect.top + canvasY * rect.height / this.canvas.height) + 'px';
      this.contextMenu.classList.add('show');
      
      const deleteItem = this.contextMenu.querySelector('.context-menu-delete');
      deleteItem.addEventListener('click', () => {
        this.removeNode(clickedNode);
        this.contextMenu.classList.remove('show');
      });
    } else {
      html += '<div class="context-menu-category">Native Types</div>';
      const natives = ['Native.String', 'Native.Integer', 'Native.Boolean', 'Native.Float', 'Native.List', 'Native.Dict', 'Native.Set', 'Native.Tuple'];
      for (const nativeType of natives) {
        const name = nativeType.split('.')[1];
        html += '<div class="context-menu-item" data-type="' + nativeType + '">' + name + '</div>';
      }
      
      const registeredSchemas = this.graph.getRegisteredSchemas();
      for (const schemaName of registeredSchemas) {
        const schemaTypes = [];
        const schemaInfo = this.graph.getSchemaInfo(schemaName);
        let rootNodeType = null;
        
        for (const type in this.graph.nodeTypes) {
          if (this.graph.nodeTypes.hasOwnProperty(type) && type.indexOf(schemaName + '.') === 0) {
            schemaTypes.push(type);
            if (schemaInfo && schemaInfo.rootType && type === schemaName + '.' + schemaInfo.rootType) {
              rootNodeType = type;
            }
          }
        }
        
        if (schemaTypes.length > 0) {
          html += '<div class="context-menu-category">' + schemaName + ' Schema</div>';
          
          // Show root node first with special marker
          if (rootNodeType) {
            const name = rootNodeType.split('.')[1];
            html += '<div class="context-menu-item" data-type="' + rootNodeType + '" style="font-weight: bold; color: var(--accent-orange);">★ ' + name + ' (Root)</div>';
          }
          
          // Show other nodes
          for (const schemaType of schemaTypes) {
            if (schemaType !== rootNodeType) {
              const name = schemaType.split('.')[1];
              html += '<div class="context-menu-item" data-type="' + schemaType + '">' + name + '</div>';
            }
          }
        }
      }
      
      this.contextMenu.innerHTML = html;
      this.contextMenu.style.left = (rect.left + canvasX * rect.width / this.canvas.width) + 'px';
      this.contextMenu.style.top = (rect.top + canvasY * rect.height / this.canvas.height) + 'px';
      this.contextMenu.classList.add('show');
      this.contextMenu.dataset.worldX = wx;
      this.contextMenu.dataset.worldY = wy;
      
      const items = this.contextMenu.querySelectorAll('.context-menu-item');
      for (const item of items) {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-type');
          const wx = parseFloat(this.contextMenu.dataset.worldX);
          const wy = parseFloat(this.contextMenu.dataset.worldY);
          const node = this.graph.createNode(type);
          node.pos = [wx - 90, wy - 40];
          this.contextMenu.classList.remove('show');
          this.draw();
        });
      }
    }
  }

  handleKeyDown(e) {
    if (e.code === 'Space' && !this.spacePressed && !this.editingNode) {
      e.preventDefault();
      this.spacePressed = true;
      this.canvas.style.cursor = 'grab';
    }
    
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNode && !this.editingNode) {
      e.preventDefault();
      this.removeNode(this.selectedNode);
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.exportBtn.click();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      this.importBtn.click();
    }
  }

  handleKeyUp(e) {
    if (e.code === 'Space') {
      this.spacePressed = false;
      this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'default';
    }
  }

  handleInputBlur() {
    if (this.editingNode) {
      const val = this.nodeInput.value;
      
      if (this.editingNode.editingSlot !== null && this.editingNode.editingSlot !== undefined) {
        const slot = this.editingNode.editingSlot;
        const inputType = this.editingNode.nativeInputs[slot].type;
        
        if (inputType === 'int') {
          this.editingNode.nativeInputs[slot].value = parseInt(val) || 0;
        } else if (inputType === 'float') {
          this.editingNode.nativeInputs[slot].value = parseFloat(val) || 0.0;
        } else {
          this.editingNode.nativeInputs[slot].value = val;
        }
        
        this.editingNode.editingSlot = null;
      } else {
        if (this.editingNode.title === 'Integer') {
          this.editingNode.properties.value = parseInt(val) || 0;
        } else if (this.editingNode.title === 'Float') {
          this.editingNode.properties.value = parseFloat(val) || 0.0;
        } else {
          this.editingNode.properties.value = val;
        }
      }
      
      this.draw();
    }
    this.nodeInput.classList.remove('show');
    this.editingNode = null;
  }

  handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      this.nodeInput.blur();
    } else if (e.key === 'Escape') {
      this.nodeInput.classList.remove('show');
      this.editingNode = null;
    }
  }

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
      this.draw();
    }
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
    
    this.updateSchemaList();
    this.draw();
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

  getCanvasColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      bgPrimary: style.getPropertyValue('--bg-primary').trim(),
      bgSecondary: style.getPropertyValue('--bg-secondary').trim(),
      canvasBg: style.getPropertyValue('--canvas-bg').trim(),
      borderColor: style.getPropertyValue('--border-color').trim(),
      borderHighlight: style.getPropertyValue('--border-highlight').trim(),
      textPrimary: style.getPropertyValue('--text-primary').trim(),
      textSecondary: style.getPropertyValue('--text-secondary').trim(),
      textTertiary: style.getPropertyValue('--text-tertiary').trim(),
      nodeBg: style.getPropertyValue('--node-bg').trim(),
      nodeBgSelected: style.getPropertyValue('--node-bg-selected').trim(),
      nodeHeader: style.getPropertyValue('--node-header').trim(),
      nodeShadow: style.getPropertyValue('--node-shadow').trim(),
      accentBlue: style.getPropertyValue('--accent-blue').trim(),
      accentBlueLight: style.getPropertyValue('--accent-blue-light').trim(),
      accentPurple: style.getPropertyValue('--accent-purple').trim(),
      accentPurpleLight: style.getPropertyValue('--accent-purple-light').trim(),
      accentGreen: style.getPropertyValue('--accent-green').trim(),
      accentRed: style.getPropertyValue('--accent-red').trim(),
      accentOrange: style.getPropertyValue('--accent-orange').trim(),
      accentYellow: style.getPropertyValue('--accent-yellow').trim(),
      slotInput: style.getPropertyValue('--slot-input').trim(),
      slotOutput: style.getPropertyValue('--slot-output').trim(),
      slotDefault: style.getPropertyValue('--slot-default').trim(),
      slotConnected: style.getPropertyValue('--slot-connected').trim(),
      linkColor: style.getPropertyValue('--link-color').trim(),
      linkSelected: style.getPropertyValue('--link-selected').trim(),
      gridColor: style.getPropertyValue('--grid-color').trim()
    };
  }

  draw() {
    const colors = this.getCanvasColors();
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = colors.canvasBg || '#212121';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.scale(this.camera.scale, this.camera.scale);
    
    this.drawGrid(colors);
    
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    for (const linkId in this.graph.links) {
      if (!this.graph.links.hasOwnProperty(linkId)) continue;
      const link = this.graph.links[linkId];
      const orig = this.graph.getNodeById(link.origin_id);
      const targ = this.graph.getNodeById(link.target_id);
      if (orig && targ) {
        const x1 = orig.pos[0] + orig.size[0];
        const y1 = orig.pos[1] + 33 + link.origin_slot * 25;
        const x2 = targ.pos[0];
        const y2 = targ.pos[1] + 33 + link.target_slot * 25;
        
        const cx = x1 + (x2 - x1) * 0.5;
        
        this.ctx.strokeStyle = colors.linkColor || '#9a9';
        this.ctx.lineWidth = 6 / this.camera.scale;
        this.ctx.globalAlpha = 0.15;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = colors.linkColor || '#9a9';
        this.ctx.lineWidth = 2.5 / this.camera.scale;
        this.ctx.globalAlpha = 1.0;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2);
        this.ctx.stroke();
      }
    }
    
    this.ctx.globalAlpha = 1.0;
    
    if (this.connecting) {
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
      
      const cx = x1 + (worldMouse[0] - x1) * 0.5;
      
      this.ctx.strokeStyle = colors.accentGreen || '#4ade80';
      this.ctx.lineWidth = 6 / this.camera.scale;
      this.ctx.globalAlpha = 0.3;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.bezierCurveTo(cx, y1, cx, worldMouse[1], worldMouse[0], worldMouse[1]);
      this.ctx.stroke();
      
      this.ctx.strokeStyle = colors.accentGreen || '#4ade80';
      this.ctx.lineWidth = 2.5 / this.camera.scale;
      this.ctx.globalAlpha = 1.0;
      this.ctx.setLineDash([10 / this.camera.scale, 5 / this.camera.scale]);
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.bezierCurveTo(cx, y1, cx, worldMouse[1], worldMouse[0], worldMouse[1]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    for (const node of this.graph.nodes) {
      this.drawNode(node, colors);
    }
    
    this.ctx.restore();
  }

  drawGrid(colors) {
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
    
    this.ctx.strokeStyle = colors.gridColor || 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1 / this.camera.scale;
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
  }

  drawNode(node, colors) {
    const x = node.pos[0];
    const y = node.pos[1];
    const w = node.size[0];
    const h = node.size[1];
    const radius = 6;
    
    this.ctx.shadowColor = colors.nodeShadow;
    this.ctx.shadowBlur = 10 / this.camera.scale;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 2 / this.camera.scale;
    
    this.ctx.fillStyle = node === this.selectedNode ? colors.nodeBgSelected : colors.nodeBg;
    this.ctx.beginPath();
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
    this.ctx.fill();
    
    this.ctx.strokeStyle = node === this.selectedNode ? colors.borderHighlight : colors.borderColor;
    this.ctx.lineWidth = (node === this.selectedNode ? 2 : 1) / this.camera.scale;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.stroke();
    
    // if (node.isRootType) {
    //   this.ctx.strokeStyle = colors.accentYellow || '#ffd700';
    //   this.ctx.lineWidth = 3 / this.camera.scale;
    //   this.ctx.setLineDash([10 / this.camera.scale, 5 / this.camera.scale]);
    //   this.ctx.stroke();
    //   this.ctx.setLineDash([]);
    // }
    
    const headerColor = node.isNative ? colors.accentPurple : (node.isRootType ? colors.accentOrange : colors.nodeHeader);
    this.ctx.fillStyle = headerColor;
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + w - radius, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.ctx.lineTo(x + w, y + 26);
    this.ctx.lineTo(x, y + 26);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.fillStyle = colors.textPrimary;
    this.ctx.font = (11 / this.camera.scale) + 'px Arial, sans-serif';
    this.ctx.textBaseline = 'middle';
    let titleText = node.title.length > 20 ? node.title.substring(0, 20) + '...' : node.title;
    if (node.isRootType) {
      titleText = '★ ' + titleText;
    }
    this.ctx.fillText(titleText, x + 8, y + 13);
    
    const worldMouse = this.screenToWorld(this.mousePos[0], this.mousePos[1]);
    
    for (let j = 0; j < node.inputs.length; j++) {
      this.drawInputSlot(node, j, x, y, w, worldMouse, colors);
    }
    
    for (let j = 0; j < node.outputs.length; j++) {
      this.drawOutputSlot(node, j, x, y, w, worldMouse, colors);
    }
    
    if (node.isNative && node.properties.value !== undefined) {
      const valueY = y + h - 18;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(x + 8, valueY - 10, w - 16, 18);
      this.ctx.strokeStyle = colors.borderColor;
      this.ctx.lineWidth = 1 / this.camera.scale;
      this.ctx.strokeRect(x + 8, valueY - 10, w - 16, 18);
      
      this.ctx.fillStyle = colors.textPrimary;
      this.ctx.font = (10 / this.camera.scale) + 'px "Courier New", monospace';
      let displayValue = String(node.properties.value);
      if (displayValue.length > 20) {
        displayValue = displayValue.substring(0, 20) + '...';
      }
      this.ctx.fillText(displayValue, x + 12, valueY);
    }
  }

  drawInputSlot(node, j, x, y, w, worldMouse, colors) {
    const inp = node.inputs[j];
    const sy = y + 33 + j * 25;
    const hovered = this.connecting && !this.connecting.isOutput && 
      Math.abs(worldMouse[0] - x) < 10 && Math.abs(worldMouse[1] - sy) < 10;
    const compat = this.isSlotCompatible(node, j, false);
    
    const isMulti = node.multiInputs && node.multiInputs[j];
    const hasConnections = isMulti ? node.multiInputs[j].links.length > 0 : inp.link;
    
    let color;
    if (hovered && compat) color = colors.accentGreen || '#4ade80';
    else if (hovered && !compat) color = colors.accentRed || '#ef4444';
    else if (hasConnections) color = colors.slotConnected || '#afa';
    else color = colors.slotInput || '#7a7';
    
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
    this.ctx.arc(x - 1, sy, 4, 0, Math.PI * 2);
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
        this.ctx.font = 'bold ' + (8 / this.camera.scale) + 'px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(node.multiInputs[j].links.length, x + 10, sy - 10);
      }
    }
    
    this.ctx.fillStyle = colors.textSecondary || '#aaa';
    this.ctx.font = (10 / this.camera.scale) + 'px Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(inp.name, x + 10, sy);
    
    this.ctx.fillStyle = colors.textTertiary || '#707070';
    this.ctx.font = (8 / this.camera.scale) + 'px "Courier New", monospace';
    const compactType = this.graph.compactType(inp.type);
    const typeText = compactType.length > 15 ? compactType.substring(0, 15) + '...' : compactType;
    this.ctx.fillText(typeText, x + 10, sy + 10);
    
    if (!isMulti && !inp.link && node.nativeInputs && node.nativeInputs[j] !== undefined) {
      const boxX = x + w - 70;
      const boxY = sy - 8;
      const boxW = 65;
      const boxH = 16;
      
      const isOptional = node.nativeInputs[j].optional;
      
      if (isOptional) {
        this.ctx.fillStyle = 'rgba(0, 100, 150, 0.2)';
      } else {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      }
      this.ctx.fillRect(boxX, boxY, boxW, boxH);
      
      this.ctx.strokeStyle = isOptional ? 'rgba(70, 162, 218, 0.5)' : (colors.borderColor || '#1a1a1a');
      this.ctx.lineWidth = 1 / this.camera.scale;
      this.ctx.strokeRect(boxX, boxY, boxW, boxH);
      
      const displayVal = node.nativeInputs[j].value;
      const isEmpty = displayVal === '' || displayVal === null || displayVal === undefined;
      
      if (isEmpty) {
        if (isOptional) {
          this.ctx.fillStyle = colors.textTertiary || '#707070';
          this.ctx.font = 'italic ' + (8 / this.camera.scale) + 'px Arial, sans-serif';
          this.ctx.textAlign = 'left';
          this.ctx.fillText('null', boxX + 4, sy);
        } else {
          this.ctx.fillStyle = colors.textPrimary || '#fff';
          this.ctx.font = (9 / this.camera.scale) + 'px "Courier New", monospace';
          this.ctx.textAlign = 'left';
          this.ctx.fillText('empty', boxX + 4, sy);
        }
      } else {
        this.ctx.fillStyle = colors.textPrimary || '#fff';
        this.ctx.font = (9 / this.camera.scale) + 'px "Courier New", monospace';
        this.ctx.textAlign = 'left';
        let displayValue = String(displayVal);
        if (displayValue.length > 8) {
          displayValue = displayValue.substring(0, 8) + '...';
        }
        this.ctx.fillText(displayValue, boxX + 4, sy);
      }
      
      if (isOptional) {
        this.ctx.fillStyle = 'rgba(70, 162, 218, 0.8)';
        this.ctx.font = 'bold ' + (7 / this.camera.scale) + 'px Arial, sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('?', boxX + boxW - 2, boxY + 6);
      }
    }
  }

  drawOutputSlot(node, j, x, y, w, worldMouse, colors) {
    const out = node.outputs[j];
    const sy = y + 33 + j * 25;
    const hovered = this.connecting && this.connecting.isOutput && 
      Math.abs(worldMouse[0] - (x + w)) < 10 && Math.abs(worldMouse[1] - sy) < 10;
    const compat = this.isSlotCompatible(node, j, true);
    
    const hasConnections = out.links.length > 0;
    
    let color;
    if (hovered && compat) color = colors.accentGreen || '#4ade80';
    else if (hovered && !compat) color = colors.accentRed || '#ef4444';
    else if (hasConnections) color = colors.slotConnected || '#afa';
    else color = colors.slotOutput || '#66d';
    
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
    this.ctx.arc(x + w + 1, sy, 4, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.beginPath();
    this.ctx.arc(x + w, sy - 1, 1.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = colors.textSecondary || '#aaa';
    this.ctx.font = (10 / this.camera.scale) + 'px Arial, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(out.name, x + w - 10, sy);
    
    this.ctx.textAlign = 'left';
  }

  showError(text) {
    this.errorEl.textContent = '⚠️ ' + text;
    this.errorEl.style.display = 'block';
    setTimeout(() => { this.errorEl.style.display = 'none'; }, 3000);
  }

  updateNodeTypesList() {
    const types = this.graph.getAvailableNodeTypes();
    this.nodeTypesListEl.textContent = types.length > 0 ? types.join(', ') : 'None';
  }

  updateSchemaList() {
    const schemas = this.graph.getRegisteredSchemas();
    
    if (schemas.length === 0) {
      this.schemaListEl.innerHTML = '<div style="color: var(--text-tertiary); font-size: 11px; padding: 8px;">No schemas registered</div>';
      return;
    }
    
    let html = '';
    for (const schemaName of schemas) {
      let nodeCount = 0;
      for (const node of this.graph.nodes) {
        if (node.schemaName === schemaName) {
          nodeCount++;
        }
      }
      
      let typeCount = 0;
      for (const type in this.graph.nodeTypes) {
        if (this.graph.nodeTypes.hasOwnProperty(type) && type.indexOf(schemaName + '.') === 0) {
          typeCount++;
        }
      }
      
      html += '<div class="schema-item">';
      html += '<div><span class="schema-item-name">' + schemaName + '</span>';
      html += '<span class="schema-item-count">(' + typeCount + ' types, ' + nodeCount + ' nodes)</span></div>';
      html += '<button class="schema-remove-btn" data-schema="' + schemaName + '">Remove</button>';
      html += '</div>';
    }
    
    this.schemaListEl.innerHTML = html;
    
    const removeButtons = this.schemaListEl.querySelectorAll('.schema-remove-btn');
    for (const button of removeButtons) {
      button.addEventListener('click', () => {
        this.openSchemaRemovalDialog();
      });
    }
  }

  openSchemaRemovalDialog() {
    const schemas = this.graph.getRegisteredSchemas();
    if (schemas.length === 0) {
      this.showError('No schemas to remove');
      return;
    }
    
    let options = '';
    for (const schemaName of schemas) {
      options += '<option value="' + schemaName + '">' + schemaName + '</option>';
    }
    this.schemaRemovalNameInput.innerHTML = options;
    
    this.schemaRemovalDialog.classList.add('show');
    this.schemaRemovalNameInput.focus();
  }

  confirmSchemaRemoval() {
    const schemaName = this.schemaRemovalNameInput.value;
    if (!schemaName) {
      this.showError('Please select a schema');
      return;
    }
    
    if (this.graph.removeSchema(schemaName)) {
      console.log('Removed schema:', schemaName);
      this.schemaRemovalDialog.classList.remove('show');
      this.updateSchemaList();
      this.updateNodeTypesList();
      this.draw();
      this.statusEl.textContent = `Schema "${schemaName}" removed successfully`;
      setTimeout(() => {
        this.statusEl.textContent = 'Right-click to add nodes.';
      }, 2000);
    } else {
      this.showError('Failed to remove schema: ' + schemaName);
    }
  }

  cancelSchemaRemoval() {
    this.schemaRemovalDialog.classList.remove('show');
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  exportGraph() {
    try {
      const data = this.graph.serialize(true);
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
      
      this.statusEl.textContent = 'Graph exported successfully!';
      setTimeout(() => {
        this.statusEl.textContent = 'Right-click to add nodes.';
      }, 2000);
    } catch (e) {
      this.showError('Export failed: ' + e.message);
      console.error('Export error:', e);
    }
  }

  handleImportGraph(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        this.graph.deserialize(jsonData, true);
        this.updateSchemaList();
        this.updateNodeTypesList();
        this.zoomEl.textContent = Math.round(this.camera.scale * 100) + '%';
        this.draw();
        this.statusEl.textContent = 'Graph imported successfully!';
        setTimeout(() => {
          this.statusEl.textContent = 'Right-click to add nodes.';
        }, 2000);
      } catch (e) {
        this.showError('Import failed: ' + e.message);
        console.error('Import error:', e);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  handleSchemaFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      this.pendingSchemaCode = event.target.result;

      const fileName = file.name.replace(/\.py$/, '');
      const suggestedName = fileName.charAt(0).toUpperCase() + fileName.slice(1);

      const rootTypeRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let   reMatch       = null;
      let   rootTypeMatch = null;
      while ((reMatch = rootTypeRegex.exec(this.pendingSchemaCode)) !== null) {
          rootTypeMatch = reMatch;
      }

      const suggestedRootType = rootTypeMatch ? rootTypeMatch[1] : '';

      this.schemaNameInput.value = suggestedName;
      this.schemaIndexTypeInput.value = 'Index';
      this.schemaRootTypeInput.value = suggestedRootType;

      this.schemaDialog.classList.add('show');
      this.schemaNameInput.focus();
      this.schemaNameInput.select();
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  confirmSchemaRegistration() {
    if (!this.pendingSchemaCode) return;
    
    const schemaName = this.schemaNameInput.value.trim();
    const indexType = this.schemaIndexTypeInput.value.trim() || 'int';
    const rootType = this.schemaRootTypeInput.value.trim() || null;
    
    if (!schemaName) {
      this.showError('Schema name is required');
      return;
    }
    
    if (this.graph.schemas[schemaName]) {
      if (!confirm(`Schema "${schemaName}" already exists. Replace it?`)) {
        return;
      }
      this.graph.removeSchema(schemaName);
    }
    
    if (this.graph.registerSchema(schemaName, this.pendingSchemaCode, indexType, rootType)) {
      this.schemaDialog.classList.remove('show');
      this.pendingSchemaCode = null;
      this.updateSchemaList();
      this.updateNodeTypesList();
      this.draw();
      
      if (rootType) {
        const rootNodeType = schemaName + '.' + rootType;
        if (this.graph.nodeTypes[rootNodeType]) {
          const createRootNode = confirm(`Schema registered! Would you like to create the root node (${rootType}) now?`);
          if (createRootNode) {
            const node = this.graph.createNode(rootNodeType);
            node.pos = [100, 100];
            this.draw();
            this.statusEl.textContent = `Schema "${schemaName}" registered and root node created!`;
          } else {
            this.statusEl.textContent = `Schema "${schemaName}" registered! Right-click to create the ★ ${rootType} root node.`;
          }
        } else {
          this.statusEl.textContent = `Schema "${schemaName}" registered successfully!`;
        }
      } else {
        this.statusEl.textContent = `Schema "${schemaName}" registered successfully!`;
      }
      
      setTimeout(() => {
        this.statusEl.textContent = 'Right-click to add nodes.';
      }, 3000);
    } else {
      this.showError('Failed to register schema. Check console for details.');
    }
  }

  cancelSchemaRegistration() {
    this.schemaDialog.classList.remove('show');
    this.pendingSchemaCode = null;
  }

  exportConfig() {
    try {
      const schemas = this.graph.getRegisteredSchemas();
      if (schemas.length === 0) {
        this.showError('No schemas registered');
        return;
      }

      let targetSchema = null;
      for (const schemaName of schemas) {
        const info = this.graph.getSchemaInfo(schemaName);
        if (info && info.rootType) {
          targetSchema = schemaName;
          break;
        }
      }

      if (!targetSchema) {
        targetSchema = schemas[0];
      }

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

      this.statusEl.textContent = 'Config exported successfully!';
      setTimeout(() => {
        this.statusEl.textContent = 'Right-click to add nodes.';
      }, 2000);
    } catch (e) {
      this.showError('Export config failed: ' + e.message);
      console.error('Export config error:', e);
    }
  }

  buildConfig(schemaName) {
    const schemaInfo = this.graph.schemas[schemaName];
    
    let rootTypeNode = null;
    if (schemaInfo && schemaInfo.rootType) {
      for (const node of this.graph.nodes) {
        if (node.schemaName === schemaName && node.modelName === schemaInfo.rootType) {
          rootTypeNode = node;
          break;
        }
      }
    }
    
    if (rootTypeNode) {
      return this.buildConfigFromRootNode(rootTypeNode, schemaName);
    }
    
    const config = {};
    const nodesByType = {};
    const nodeToIndex = new Map();
    
    let fieldMapping = schemaInfo.fieldMapping;
    if (!fieldMapping) {
      console.log('Generating field mapping for schema:', schemaName);
      fieldMapping = this.graph._createFieldMappingFromSchema(schemaInfo.code, schemaInfo.parsed, schemaInfo.rootType);
      schemaInfo.fieldMapping = fieldMapping;
    }
  
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
      if (!nodesByType.hasOwnProperty(modelName)) continue;
      const nodes = nodesByType[modelName];
      
      const fieldName = fieldMapping.modelToField[modelName] || this.graph.modelNameToFieldName(modelName);
      
      const isListField = this.isListFieldInRoot(modelName, schemaInfo);
      
      if (isListField || !schemaInfo.rootType || modelName === schemaInfo.rootType) {
        config[fieldName] = [];
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          node.onExecute();
          const nodeData = node.outputs[0].value || {};
          const processedData = this.processNodeDataWithIndices(nodeData, nodeToIndex, fieldMapping);
          config[fieldName].push(processedData);
        }
      } else {
        if (nodes.length > 0) {
          config[fieldName] = 0;
        }
      }
    }
  
    return config;
  }

  buildConfigFromRootNode(rootNode, schemaName) {
    console.log('=== BUILDING CONFIG FROM ROOT NODE ===');
    const schemaInfo = this.graph.schemas[schemaName];
    const config = {};
    
    const nodesByType = {};
    const nodeToIndex = new Map();
    
    for (const node of this.graph.nodes) {
      if (node.schemaName !== schemaName) continue;
      if (node === rootNode) continue;
      
      if (!nodesByType[node.modelName]) {
        nodesByType[node.modelName] = [];
      }
      const index = nodesByType[node.modelName].length;
      nodesByType[node.modelName].push(node);
      nodeToIndex.set(node, { modelName: node.modelName, index });
    }
    
    let fieldMapping = schemaInfo.fieldMapping;
    if (!fieldMapping) {
      fieldMapping = this.graph._createFieldMappingFromSchema(schemaInfo.code, schemaInfo.parsed, schemaInfo.rootType);
      schemaInfo.fieldMapping = fieldMapping;
    }
    
    for (const node of this.graph.nodes) {
      if (node.schemaName === schemaName) {
        node.onExecute();
      }
    }
    
    for (let i = 0; i < rootNode.inputs.length; i++) {
      const input = rootNode.inputs[i];
      const fieldName = input.name;
      
      if (rootNode.multiInputs && rootNode.multiInputs[i]) {
        const connectedNodes = [];
        for (const linkId of rootNode.multiInputs[i].links) {
          const link = this.graph.links[linkId];
          if (link) {
            const sourceNode = this.graph.getNodeById(link.origin_id);
            if (sourceNode && nodeToIndex.has(sourceNode)) {
              connectedNodes.push(sourceNode);
            }
          }
        }
        
        if (connectedNodes.length > 0) {
          config[fieldName] = [];
          for (const node of connectedNodes) {
            const nodeData = node.outputs[0].value || {};
            const processedData = this.processNodeDataWithIndices(nodeData, nodeToIndex, fieldMapping);
            config[fieldName].push(processedData);
          }
        }
      } else {
        const connectedValue = rootNode.getInputData(i);
        if (connectedValue !== null && connectedValue !== undefined) {
          let isNodeReference = false;
          for (const [node, info] of nodeToIndex.entries()) {
            if (node.outputs && node.outputs[0] && node.outputs[0].value === connectedValue) {
              config[fieldName] = info.index;
              isNodeReference = true;
              break;
            }
          }
          
          if (!isNodeReference) {
            const processedData = this.processNodeDataWithIndices(connectedValue, nodeToIndex, fieldMapping);
            config[fieldName] = processedData;
          }
        } else if (rootNode.nativeInputs && rootNode.nativeInputs[i] !== undefined) {
          const val = rootNode.nativeInputs[i].value;
          const isOptional = rootNode.nativeInputs[i].optional;
          
          if (isOptional && (val === null || val === undefined || val === '')) {
            continue;
          }
          
          if (val !== null && val !== undefined && val !== '') {
            if (rootNode.nativeInputs[i].type === 'dict' || rootNode.nativeInputs[i].type === 'list') {
              try {
                config[fieldName] = JSON.parse(val);
              } catch (e) {
                config[fieldName] = val;
              }
            } else if (rootNode.nativeInputs[i].type === 'int') {
              config[fieldName] = parseInt(val) || 0;
            } else if (rootNode.nativeInputs[i].type === 'float') {
              config[fieldName] = parseFloat(val) || 0.0;
            } else if (rootNode.nativeInputs[i].type === 'bool') {
              config[fieldName] = val === true || val === 'true';
            } else {
              config[fieldName] = val;
            }
          }
        }
      }
    }
    
    console.log('=== CONFIG BUILT FROM ROOT NODE ===');
    return config;
  }

  isListFieldInRoot(modelName, schemaInfo) {
    if (!schemaInfo.rootType || !schemaInfo.parsed[schemaInfo.rootType]) {
      return true;
    }
    
    const rootFields = schemaInfo.parsed[schemaInfo.rootType];
    const fieldName = schemaInfo.fieldMapping.modelToField[modelName];
    
    if (!fieldName) return true;
    
    for (const field of rootFields) {
      if (field.name === fieldName) {
        const fieldType = field.type;
        if (fieldType.kind === 'optional') {
          return fieldType.inner.kind === 'list';
        }
        return fieldType.kind === 'list';
      }
    }
    
    return true;
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
    
    const hasData = Object.keys(processed).length > 0;
    if (!hasData) return null;
    
    return processed;
  }

  handleImportConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const configData = JSON.parse(event.target.result);
        this.importConfigData(configData);
      } catch (e) {
        this.showError('Import config failed: ' + e.message);
        console.error('Import config error:', e);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
    this.statusEl.textContent = 'Config imported successfully!';
    setTimeout(() => {
      this.statusEl.textContent = 'Right-click to add nodes.';
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

  fieldNameToModelName(fieldName) {
    let name = fieldName;
    
    if (name.endsWith('ies')) {
      name = name.slice(0, -3) + 'y';
    } else if (name.endsWith('es') && name.length > 2) {
      const beforeEs = name.slice(0, -2);
      if (beforeEs.endsWith('s') || beforeEs.endsWith('x') || beforeEs.endsWith('ch') || beforeEs.endsWith('sh')) {
        name = beforeEs;
      } else {
        name = name.slice(0, -1);
      }
    } else if (name.endsWith('s')) {
      name = name.slice(0, -1);
    }
    
    name = name.split('_').map(part => {
      if (!part) return '';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('');
    
    name = name
      .replace(/Db$/, 'DB')
      .replace(/Db([A-Z])/g, 'DB$1')
      .replace(/Api$/, 'API')
      .replace(/Api([A-Z])/g, 'API$1')
      .replace(/Url$/, 'URL')
      .replace(/Url([A-Z])/g, 'URL$1')
      .replace(/Html$/, 'HTML')
      .replace(/Html([A-Z])/g, 'HTML$1')
      .replace(/Http$/, 'HTTP')
      .replace(/Http([A-Z])/g, 'HTTP$1');
    
    if (!name.endsWith('Config')) {
      name = name + 'Config';
    }
    
    return name;
  }

  centerView() {
    if (this.graph.nodes.length === 0) {
      return;
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const node of this.graph.nodes) {
      const x1 = node.pos[0];
      const y1 = node.pos[1];
      const x2 = x1 + node.size[0];
      const y2 = y1 + node.size[1];
      
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
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
    
    this.zoomEl.textContent = Math.round(this.camera.scale * 100) + '%';
    this.draw();
  }

  resetZoom() {
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;
    const worldCenter = this.screenToWorld(canvasCenterX, canvasCenterY);
    
    this.camera.scale = 1.0;
    
    this.camera.x = canvasCenterX - worldCenter[0] * this.camera.scale;
    this.camera.y = canvasCenterY - worldCenter[1] * this.camera.scale;
    
    this.zoomEl.textContent = '100%';
    this.draw();
  }

  applyLayout(layoutType) {
    if (this.graph.nodes.length === 0) {
      this.showError('No nodes to layout');
      return;
    }
    
    switch (layoutType) {
      case 'hierarchical-vertical':
        this.layoutHierarchicalVertical();
        break;
      case 'hierarchical-horizontal':
        this.layoutHierarchicalHorizontal();
        break;
      case 'force-directed':
        this.layoutForceDirected();
        break;
      case 'grid':
        this.layoutGrid();
        break;
      case 'circular':
        this.layoutCircular();
        break;
      default:
        console.warn('Unknown layout type:', layoutType);
    }
    
    this.draw();
    this.centerView();
  }

  layoutHierarchicalVertical() {
    const layers = this.computeLayers();
    const nodeSpacingX = 250;
    const nodeSpacingY = 200;
    
    let maxLayerWidth = 0;
    for (const layer of layers) {
      maxLayerWidth = Math.max(maxLayerWidth, layer.length);
    }
    
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const layerWidth = layer.length * nodeSpacingX;
      const startX = -layerWidth / 2;
      
      for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
        const node = layer[nodeIdx];
        node.pos[0] = startX + nodeIdx * nodeSpacingX;
        node.pos[1] = layerIdx * nodeSpacingY;
      }
    }
    
    this.statusEl.textContent = 'Hierarchical (Vertical) layout applied';
    setTimeout(() => {
      this.statusEl.textContent = 'Right-click to add nodes.';
    }, 2000);
  }

  layoutHierarchicalHorizontal() {
    const layers = this.computeLayers();
    const nodeSpacingX = 300;
    const nodeSpacingY = 150;
    
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const layerHeight = layer.length * nodeSpacingY;
      const startY = -layerHeight / 2;
      
      for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
        const node = layer[nodeIdx];
        node.pos[0] = layerIdx * nodeSpacingX;
        node.pos[1] = startY + nodeIdx * nodeSpacingY;
      }
    }
    
    this.statusEl.textContent = 'Hierarchical (Horizontal) layout applied';
    setTimeout(() => {
      this.statusEl.textContent = 'Right-click to add nodes.';
    }, 2000);
  }

  computeLayers() {
    const layers = [];
    const nodeToLayer = new Map();
    const visited = new Set();
    
    const sourcesNodes = this.graph.nodes.filter(node => {
      return node.outputs.some(out => out.links.length > 0) &&
             node.inputs.every(inp => !inp.link && (!node.multiInputs || !node.multiInputs[node.inputs.indexOf(inp)]?.links.length));
    });
    
    if (sourcesNodes.length === 0) {
      const layer = [...this.graph.nodes];
      return [layer];
    }
    
    const assignLayer = (node, layer) => {
      if (!nodeToLayer.has(node.id)) {
        nodeToLayer.set(node.id, layer);
      } else {
        nodeToLayer.set(node.id, Math.max(nodeToLayer.get(node.id), layer));
      }
    };
    
    const queue = sourcesNodes.map(node => ({ node, layer: 0 }));
    
    for (const n of sourcesNodes) {
      assignLayer(n, 0);
      visited.add(n.id);
    }
    
    while (queue.length > 0) {
      const { node, layer } = queue.shift();
      
      for (const output of node.outputs) {
        for (const linkId of output.links) {
          const link = this.graph.links[linkId];
          if (link) {
            const targetNode = this.graph.getNodeById(link.target_id);
            if (targetNode) {
              assignLayer(targetNode, layer + 1);
              if (!visited.has(targetNode.id)) {
                visited.add(targetNode.id);
                queue.push({ node: targetNode, layer: layer + 1 });
              }
            }
          }
        }
      }
    }
    
    for (const node of this.graph.nodes) {
      if (!nodeToLayer.has(node.id)) {
        nodeToLayer.set(node.id, 0);
      }
    }
    
    const maxLayer = Math.max(...Array.from(nodeToLayer.values()));
    for (let i = 0; i <= maxLayer; i++) {
      layers.push([]);
    }
    
    for (const node of this.graph.nodes) {
      const layer = nodeToLayer.get(node.id);
      layers[layer].push(node);
    }
    
    return layers;
  }

  layoutForceDirected() {
    const iterations = 100;
    const k = 200;
    const maxDisplacement = 50;
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map();
      
      for (const node of this.graph.nodes) {
        forces.set(node.id, { x: 0, y: 0 });
      }
      
      for (let i = 0; i < this.graph.nodes.length; i++) {
        for (let j = i + 1; j < this.graph.nodes.length; j++) {
          const n1 = this.graph.nodes[i];
          const n2 = this.graph.nodes[j];
          
          const dx = n2.pos[0] - n1.pos[0];
          const dy = n2.pos[1] - n1.pos[1];
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const repulsion = (k * k) / dist;
          const fx = (dx / dist) * repulsion;
          const fy = (dy / dist) * repulsion;
          
          forces.get(n1.id).x -= fx;
          forces.get(n1.id).y -= fy;
          forces.get(n2.id).x += fx;
          forces.get(n2.id).y += fy;
        }
      }
      
      for (const linkId in this.graph.links) {
        if (!this.graph.links.hasOwnProperty(linkId)) continue;
        const link = this.graph.links[linkId];
        const n1 = this.graph.getNodeById(link.origin_id);
        const n2 = this.graph.getNodeById(link.target_id);
        
        if (n1 && n2) {
          const dx = n2.pos[0] - n1.pos[0];
          const dy = n2.pos[1] - n1.pos[1];
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const attraction = (dist * dist) / k;
          const fx = (dx / dist) * attraction;
          const fy = (dy / dist) * attraction;
          
          forces.get(n1.id).x += fx;
          forces.get(n1.id).y += fy;
          forces.get(n2.id).x -= fx;
          forces.get(n2.id).y -= fy;
        }
      }
      
      const temp = 1 - iter / iterations;
      
      for (const node of this.graph.nodes) {
        const force = forces.get(node.id);
        const displacement = Math.sqrt(force.x * force.x + force.y * force.y);
        
        if (displacement > 0) {
          const limitedDisp = Math.min(displacement, maxDisplacement * temp);
          node.pos[0] += (force.x / displacement) * limitedDisp;
          node.pos[1] += (force.y / displacement) * limitedDisp;
        }
      }
    }
    
    this.statusEl.textContent = 'Force-directed layout applied';
    setTimeout(() => {
      this.statusEl.textContent = 'Right-click to add nodes.';
    }, 2000);
  }

  layoutGrid() {
    const nodeSpacingX = 250;
    const nodeSpacingY = 180;
    const cols = Math.ceil(Math.sqrt(this.graph.nodes.length * 1.5));
    
    for (let i = 0; i < this.graph.nodes.length; i++) {
      const node = this.graph.nodes[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      node.pos[0] = col * nodeSpacingX;
      node.pos[1] = row * nodeSpacingY;
    }
    
    this.statusEl.textContent = 'Grid layout applied';
    setTimeout(() => {
      this.statusEl.textContent = 'Right-click to add nodes.';
    }, 2000);
  }

  layoutCircular() {
    const radius = Math.max(300, this.graph.nodes.length * 30);
    const angleStep = (2 * Math.PI) / this.graph.nodes.length;
    
    for (let i = 0; i < this.graph.nodes.length; i++) {
      const node = this.graph.nodes[i];
      const angle = i * angleStep - Math.PI / 2;
      node.pos[0] = Math.cos(angle) * radius;
      node.pos[1] = Math.sin(angle) * radius;
    }
    
    this.statusEl.textContent = 'Circular layout applied';
    setTimeout(() => {
      this.statusEl.textContent = 'Right-click to add nodes.';
    }, 2000);
  }

  setReady() {
    this.statusEl.textContent = 'Ready. Upload a schema to begin.';
  }

//   findRootNodeFromSchemaName(schemaName) {
//     if (!schemaName) {
//       const keys = Object.keys(this.graph.schemas);
//       if (keys && keys.length > 0) {
//         schemaName = keys[0];
//       }
//     }

//     if (!schemaName || !(schemaName in this.graph.schemas)) {
//       return null;
//     }

//     const schemaInfo   = this.graph.schemas[schemaName];
//     let   rootTypeNode = null;
//     if (schemaInfo.rootType) {
//       for (const node of this.graph.nodes) {
//         if (node.schemaName === schemaName && node.modelName === schemaInfo.rootType) {
//           rootTypeNode = node;
//           break;
//         }
//       }
//       return rootTypeNode;
//     }

//     return null;
//   }

//   unlinkReferenceListsFromRoot(schemaName) {
//     const rootNode = this.findRootNodeFromSchemaName(schemaName);
//     if (!rootNode || !rootNode.multiInputs) {
//       return;
//     }

// 	const links = [];
// 	for (let multiInput of rootNode.multiInputs) {
// 		links.push(...multiInput.links);
// 	}

// 	for (let link of links) {
//   removeLink(linkId, targetNode, targetSlot) {
//     const link = this.graph.links[linkId];
//     if (link) {
//       const originNode = this.graph.getNodeById(link.origin_id);
//       if (originNode) {
//         const idx = originNode.outputs[link.origin_slot].links.indexOf(linkId);
//         if (idx > -1) originNode.outputs[link.origin_slot].links.splice(idx, 1);
//       }
//       delete this.graph.links[linkId];
//       targetNode.inputs[targetSlot].link = null;
//       this.draw();
//     }
//   }
// 	}
//   }

  loadExampleSchema() {
    const exampleSchema = `from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Union

Index = int

class ToolConfig(BaseModel):
    type: str
    args: Optional[Dict[str, Any]] = None

class AppConfig(BaseModel):
    tools: Optional[List[Union[ToolConfig, Index]]] = []`;
    
    if (this.graph.registerSchema('ExampleSchema', exampleSchema, 'Index', 'AppConfig')) {
      // Create the root node automatically
      const rootNode = this.graph.createNode('ExampleSchema.AppConfig');
      rootNode.pos = [100, 100];
      
      this.statusEl.textContent = 'Example schema loaded with root node (★ AppConfig). Right-click to add more nodes.';
      this.updateNodeTypesList();
      this.updateSchemaList();
      this.draw();
    } else {
      this.setReady();
    }
  }
}

let gApp = null;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    gApp = new SchemaGraphApp();
    window.graph = gApp.graph;
    window.app = gApp;
  });
} else {
  gApp = new SchemaGraphApp();
  window.graph = gApp.graph;
  window.app = gApp;
}