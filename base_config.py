from base_types import AgentConfig


def validate_config(config: AgentConfig):
	# TODO: Implement validation logic for the AgentConfig
	return config is not None and isinstance(config, AgentConfig)
