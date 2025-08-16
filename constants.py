# DEFAULT_KNOWLEDGE_DB_URL                 : str  = "postgresql+psycopg://ai:ai@localhost:5532/ai"

DEFAULT_API_KEY                          : str  = None

DEFAULT_MODEL_TYPE                       : str  = "openai"
DEFAULT_MODEL_ID                         : str  = "gpt-4o"

DEFAULT_KNOWLEDGE_DB_TYPE                : str  = "lancedb"
DEFAULT_KNOWLEDGE_DB_TABLE_NAME          : str  = "knowledge"
DEFAULT_KNOWLEDGE_DB_URL                 : str  = "storage/knowledge"
DEFAULT_KNOWLEDGE_DB_SEARCH_TYPE         : str  = "hybrid"

DEFAULT_KNOWLEDGE_BASE_TYPE              : str  = "document"

DEFAULT_MEMORY_DB_TYPE                   : str  = "sqlite"
DEFAULT_MEMORY_DB_TABLE_NAME             : str  = "memory"
DEFAULT_MEMORY_DB_URL                    : str  = "storage/memory"

DEFAULT_STORAGE_DB_TYPE                  : str  = "sqlite"
DEFAULT_STORAGE_DB_TABLE_NAME            : str  = "session"
DEFAULT_STORAGE_DB_URL                   : str  = "storage/session"

DEFAULT_MARKDOWN                         : bool = True
DEFAULT_SEARCH_KNOWLEDGE                 : bool = True
DEFAULT_ENABLE_AGENTIC_MEMORY            : bool = True
DEFAULT_ADD_HISTORY_TO_MESSAGES          : bool = True
DEFAULT_NUM_HISTORY_RUNS                 : int  = 3
DEFAULT_ENABLE_SESSION_SUMMARIES         : bool = True
DEFAULT_SEARCH_PREVIOUS_SESSIONS_HISTORY : bool = True
DEFAULT_NUM_HISTORY_SESSIONS             : int  = 2
DEFAULT_SHOW_TOOL_CALLS                  : bool = True
DEFAULT_REASONING                        : bool = True
DEFAULT_STREAM_INTERMEDIATE_STEPS        : bool = True

DEFAULT_AGENT_BACKEND_TYPE               : str  = "agno"
DEFAULT_AGENT_BACKEND_VERSION            : str  = ""
