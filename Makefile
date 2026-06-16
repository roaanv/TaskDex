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
