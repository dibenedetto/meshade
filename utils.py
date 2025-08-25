import numpy as np
import os
import torch


from constants import DEFAULT_SEED


def module_prop_str(file_path: str, property_name: str) -> str:
	module_name = os.path.splitext(os.path.basename(file_path))[0]
	res         = f"{module_name}:{property_name}"
	return res


def seed_everything(seed: int = DEFAULT_SEED):
	os    .environ['PYTHONHASHSEED'] = str(seed)
	np    .random.seed(seed)
	torch .manual_seed(seed)
	torch .cuda.manual_seed(seed)
	torch .cuda.manual_seed_all(seed)
	torch .backends.cudnn.deterministic = True
