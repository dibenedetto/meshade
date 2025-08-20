from typing    import Any


from config    import PlaygroundConfig, validate_playground_config
from constants import DEFAULT_PLAYGROUND_PORT


class Playground:

	def __init__(self, config: PlaygroundConfig):
		if not validate_playground_config(config):
			raise ValueError("Invalid playground configuration")

		self.config = config
		self.d      = None


	def is_valid(self) -> bool:
		return self.d is not None


	def generate_app(self) -> Any:
		raise NotImplementedError("Subclasses must implement the generate_app method.")


	def serve(self, app: str, port: int = DEFAULT_PLAYGROUND_PORT, reload: bool = False):
		raise NotImplementedError("Subclasses must implement the serve method.")
