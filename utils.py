import os
import numpy as np
import torch


from constants import DEFAULT_SEED


def seed_everything(seed: int = DEFAULT_SEED):
	os    .environ['PYTHONHASHSEED'] = str(seed)
	np    .random.seed(seed)
	torch .manual_seed(seed)
	torch .cuda.manual_seed(seed)
	torch .cuda.manual_seed_all(seed)
	torch .backends.cudnn.deterministic = True
