def dummy_tool():
	return None


# TODO

# from agno.tools import tool

# @tool(external_execution=True)
# def set_theme_color(theme_color: str) -> str: # pylint: disable=unused-argument
#   """
#   Change the theme color of the chat.

#   Args:
#       background: str: The background color to change to.
#   """

# @tool(external_execution=True)
# def add_proverb(proverb: str) -> str: # pylint: disable=unused-argument
#   """
#   Add a proverb to the chat.

#   Args:
#       proverb: str: The proverb to add to the chat.
#   """

# import asyncio
# from   agno.tools                import tool


# @tool
# async def start_webcam_stream(duration_seconds: int = 10, interval_seconds: int = 2):
# 	"""
# 	Start webcam streaming that captures frames periodically.
	
# 	Args:
# 		duration_seconds: How long to stream (default 30s)
# 		interval_seconds: Interval between captures (default 5s)
# 	"""
# 	# results = []
# 	for i in range(duration_seconds // interval_seconds):
# 		# Simulate analysis (you could call vision models here)
# 		timestamp = i * interval_seconds
# 		item = f"Frame {i+1} at {timestamp}s: Webcam active, frame captured"
# 		yield item

# 		# Wait for next interval
# 		await asyncio.sleep(interval_seconds)
	
# 	# return f"Webcam stream completed. Captured {len(results)} frames: " + "; ".join(results)
# 	yield "-- done --"
