# MacSweeper — Build Console
# All targets delegate to scripts/console.py for retro terminal UI + structured logs.

PYTHON := python3
CONSOLE := $(PYTHON) scripts/console.py

.PHONY: help install \
        start stop restart \
        dev desktop build typecheck \
        pack dist dist-arm64 dist-x64 dist-universal \
        notarize release \
        audit audit-fix audit-fix-force \
        status clean clean-all rebuild-native

help:
	@$(CONSOLE) status

install:
	@$(CONSOLE) install

start:
	@$(CONSOLE) start

stop:
	@$(CONSOLE) stop

restart:
	@$(CONSOLE) restart

dev:
	@$(CONSOLE) dev

desktop:
	@$(CONSOLE) desktop

build:
	@$(CONSOLE) build

typecheck:
	@npm run typecheck

pack:
	@$(CONSOLE) pack

dist:
	@$(CONSOLE) dist

dist-arm64:
	@$(CONSOLE) dist-arm64

dist-x64:
	@$(CONSOLE) dist-x64

dist-universal:
	@$(CONSOLE) dist-universal

notarize:
	@$(CONSOLE) notarize

release:
	@$(CONSOLE) release

audit:
	@$(CONSOLE) audit

audit-fix:
	@$(CONSOLE) audit-fix

audit-fix-force:
	@$(CONSOLE) audit-fix-force

status:
	@$(CONSOLE) status

clean:
	@$(CONSOLE) clean

clean-all:
	@$(CONSOLE) clean-all

rebuild-native:
	@npx @electron/rebuild -f -w better-sqlite3

.DEFAULT_GOAL := help
