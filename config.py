import json


from pydantic import BaseModel
from typing   import Any, Dict, List, Optional, Required


from constants import *


class ModelConfig(BaseModel):
	type : str = DEFAULT_MODEL_TYPE
	id   : str = DEFAULT_MODEL_ID


class KnowledgeDBConfig(BaseModel):
	type        : str = DEFAULT_KNOWLEDGE_DB_TYPE
	table_name  : str = DEFAULT_KNOWLEDGE_DB_TABLE_NAME
	db_url      : str = DEFAULT_KNOWLEDGE_DB_URL
	search_type : str = DEFAULT_KNOWLEDGE_DB_SEARCH_TYPE


class KnowledgeBase(BaseModel):
	type      : str = DEFAULT_KNOWLEDGE_BASE_TYPE
	vector_db : KnowledgeDBConfig = KnowledgeDBConfig()
	urls      : Optional[List[str]]


class MemoryDBConfig(BaseModel):
	type       : str = DEFAULT_MEMORY_DB_TYPE
	table_name : str = DEFAULT_MEMORY_DB_TABLE_NAME
	db_url     : str = DEFAULT_MEMORY_DB_URL


class MemoryConfig(BaseModel):
	db         : MemoryDBConfig = MemoryDBConfig()
	model      : Optional[ModelConfig]
	summarizer : Optional[ModelConfig]


class StorageDBConfig(BaseModel):
	type       : str = DEFAULT_STORAGE_DB_TYPE
	table_name : str = DEFAULT_STORAGE_DB_TABLE_NAME
	db_url     : str = DEFAULT_STORAGE_DB_URL


class ToolConfig(BaseModel):
	type : str = Required
	args : Optional[Dict[str, Any]]


class OptionsConfig(BaseModel):
	markdown                         : bool = DEFAULT_MARKDOWN
	search_knowledge                 : bool = DEFAULT_SEARCH_KNOWLEDGE
	enable_agentic_memory            : bool = DEFAULT_ENABLE_AGENTIC_MEMORY
	add_history_to_messages          : bool = DEFAULT_ADD_HISTORY_TO_MESSAGES
	num_history_runs                 : int  = DEFAULT_NUM_HISTORY_RUNS
	enable_session_summaries         : bool = DEFAULT_ENABLE_SESSION_SUMMARIES
	search_previous_sessions_history : bool = DEFAULT_SEARCH_PREVIOUS_SESSIONS_HISTORY
	num_history_sessions             : int  = DEFAULT_NUM_HISTORY_SESSIONS
	show_tool_calls                  : bool = DEFAULT_SHOW_TOOL_CALLS
	tool_call_limit                  : int  = DEFAULT_TOOL_CALL_LIMIT
	reasoning                        : bool = DEFAULT_REASONING
	stream_intermediate_steps        : bool = DEFAULT_STREAM_INTERMEDIATE_STEPS
	# response_model                   : Optional[BaseModel]
	# expected_output                  : Optional[str]


class AgentBackendConfig(BaseModel):
	type    : str = DEFAULT_AGENT_BACKEND_TYPE
	version : str = DEFAULT_AGENT_BACKEND_VERSION


class AgentConfig(BaseModel):
	version      : str                = Required
	author       : str                = Required
	name         : str                = Required
	backend      : AgentBackendConfig = AgentBackendConfig()
	model        : ModelConfig        = ModelConfig()
	options      : OptionsConfig      = OptionsConfig()
	description  : Optional[str]
	instructions : Optional[List[str]]
	knowledge    : Optional[List[KnowledgeBase]]
	memory       : Optional[MemoryConfig]
	storage      : Optional[StorageDBConfig]
	tools        : Optional[List[ToolConfig]]
	data         : Optional[Any]


def validate_config(config: AgentConfig) -> bool:
	# TODO: Implement validation logic for the AgentConfig
	if config is None or not config.version or not config.author or not config.name:
		return False
	return True


def load_config(file_path: str) -> AgentConfig:
	with open(file_path, "r") as f:
		data = json.load(f)
	return AgentConfig(**data)
