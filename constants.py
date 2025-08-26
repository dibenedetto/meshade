# DEFAULT_KNOWLEDGE_DB_URL                          : str  = "postgresql+psycopg://ai:ai@localhost:5532/ai"

DEFAULT_SEED                                      : int  = 42

DEFAULT_API_KEY                                   : str  = None

DEFAULT_BACKEND_TYPE                              : str  = "agno"
DEFAULT_BACKEND_VERSION                           : str  = ""

DEFAULT_MODEL_TYPE                                : str  = "openai"
DEFAULT_MODEL_ID                                  : str  = "gpt-4o"

DEFAULT_EMBEDDING_TYPE                            : str  = "openai"
DEFAULT_EMBEDDING_ID                              : str  = "gpt-4o"

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
