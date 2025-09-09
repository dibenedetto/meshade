#!/bin/sh

set -e

if [ $1 = "True" ]; then
	python -Xfrozen_modules=off -m debugpy --listen 0.0.0.0:$2 launch.py --port=$3
else
	python -Xfrozen_modules=off launch.py --port=$3
fi
