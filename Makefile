# TaskDex — Tauri 2 (Rust + SQLite) + React 18 + TypeScript + Vite
# Common targets: make setup | make run | make build | make test | make deploy

.PHONY: setup dev run build bundle deploy test test-web test-rust typecheck fmt clean

## install JS dependencies (Rust deps are fetched on first build)
setup:
	npm install

## run the app in development (Vite + Tauri webview, hot reload)
dev run:
	npm run tauri dev

## compile both halves to verify the build (frontend bundle + Rust debug build)
build:
	npm run build
	cd src-tauri && cargo build

## produce a distributable macOS bundle (.app / .dmg) under src-tauri/target/release/bundle
bundle:
	npm run tauri build

## deploy = build the signed distributable. Notarization + GitHub Releases are
## handled by the Tauri release workflow (see the `tauri-release` skill / .github).
deploy: bundle

## run all tests (frontend Vitest + Rust cargo)
test: test-web test-rust

test-web:
	npm test

test-rust:
	cd src-tauri && cargo test

## typecheck the frontend without emitting
typecheck:
	npm run typecheck

## format the Rust backend
fmt:
	cd src-tauri && cargo fmt

## remove build artifacts
clean:
	rm -rf dist
	cd src-tauri && cargo clean

# ── Release pipeline (Tauri signs/notarizes during `tauri build`) ─────────────
.PHONY: gh-secrets release-patch release-minor release-local

## push the release secrets from the macOS Keychain to the current GitHub repo
gh-secrets:
	@command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI not found. Install with: brew install gh"; exit 1; }
	@gh auth status >/dev/null 2>&1 || { echo "Error: gh CLI is not authenticated. Run: gh auth login"; exit 1; }
	@if ! gh repo view --json nameWithOwner -q .nameWithOwner >/dev/null 2>&1; then \
		echo "Skipping gh-secrets: this repository doesn't exist on GitHub yet."; \
		echo "Create it first with: gh repo create --source . --private --push"; \
		exit 0; \
	fi
	@./scripts/set-gh-release-secrets.sh

## bump the patch version (x.y.Z), tag, and push — triggers a release
release-patch:
	@./scripts/bump-version.sh patch

## bump the minor version (x.Y.0), tag, and push — triggers a release
release-minor:
	@./scripts/bump-version.sh minor

## local universal signed build (requires the Apple env vars in your shell)
release-local:
	npm run tauri build -- --target universal-apple-darwin
	@echo "Built: src-tauri/target/universal-apple-darwin/release/bundle/dmg/"
