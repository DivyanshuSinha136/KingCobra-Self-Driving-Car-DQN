# KingCobra Self-Driving Car DQN - common tasks.   `make help` lists them.
#
# KINGCOBRA is the interpreter; override it if it is not on your PATH:
#     make serve KINGCOBRA=/path/to/kingcobra
KINGCOBRA ?= kingcobra
MAIN      := src/main.kc
ARGS      ?=

.PHONY: help train train-drift serve eval baseline info test test-kc test-web check assets screenshots video clean

help:  ## show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

train:  ## train the racing agent (ARGS="--episodes 150 --seed 7")
	$(KINGCOBRA) run $(MAIN) train $(ARGS)

train-drift:  ## train the drift-style agent (reward bonus for sliding, keeps the final network)
	$(KINGCOBRA) run $(MAIN) train --name drifter_ddqn --set reward.drift=0.4 --set train.select=last $(ARGS)

serve:  ## start the web dashboard on http://127.0.0.1:8766
	$(KINGCOBRA) run $(MAIN) serve $(ARGS)

eval:  ## laps on seen and unseen tracks, with traffic (ARGS="--starts 3 --name drifter_ddqn")
	$(KINGCOBRA) run $(MAIN) eval $(ARGS)

baseline:  ## the same evaluation for the hand-written rule-based driver
	$(KINGCOBRA) run $(MAIN) eval --baseline $(ARGS)

info:  ## print the saved model's card
	$(KINGCOBRA) run $(MAIN) info $(ARGS)

test: test-kc test-web  ## run every test

test-kc:  ## KingCobra unit + end-to-end tests
	$(KINGCOBRA) test tests/

test-web:  ## front-end tests (needs node): pure helpers + a live smoke test
	node tests/web/pure.test.js
	KINGCOBRA=$(KINGCOBRA) ./scripts/test_web.sh

check:  ## parse + type-check every source file
	$(KINGCOBRA) check src/ tests/

assets:  ## regenerate the SVG banners, icons, diagrams and terminal pictures (needs node)
	node scripts/build_assets.js

screenshots:  ## retake the dashboard screenshots (needs playwright; run `make serve` first)
	python3 scripts/screenshots.py http://127.0.0.1:8766 a
	python3 scripts/screenshots.py http://127.0.0.1:8766 b

video:  ## re-record the gameplay video (needs playwright + ffmpeg; run `make serve` first)
	python3 scripts/record_video.py

clean:  ## remove scratch files (the shipped models are kept)
	find . -name '*.tmp' -delete
