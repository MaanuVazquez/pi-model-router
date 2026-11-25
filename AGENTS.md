# Project guidance

## Purpose

This repository contains a Pi extension that selects an OpenAI chat model for each new user turn. The virtual model is `openai/auto`.

The router asks the Jev classifier first. It uses Luna Decisions if Jev is missing or fails. It accepts a tier only when its probability is at least 55%. Otherwise, it selects Sol. Read `docs/README.md` for setup and `docs/classifier-evaluation.md` for classifier results.

## Project layout

- `src/model-router.ts`: Pi virtual-model registration and routing.
- `src/constants.ts`: model IDs, classifier order, routing threshold, and tier criteria.
- `src/types.ts`: shared TypeScript types.
- `src/routing-log.ts`: optional local routing log.
- `src/__tests__/`: Node.js tests for routing behavior.
- `docs/`: project guide and classifier evaluation.

Keep TypeScript source in `src/`. Keep tests in `src/__tests__/`. Keep Markdown documentation in `docs/`. Keep this `AGENTS.md` at the repository root so coding agents can find it.

## Development

Use Node.js 24 or later and Pi 1.6.1. Install pinned development dependencies with:

```sh
npm ci
```

Run checks before you finish a code change:

```sh
npm test
npm run typecheck
pi --offline --no-extensions -e ./src/model-router.ts --list-models openai/auto
git diff --check
```

The project uses TypeScript with strict checks and explicit `.ts` import paths. The tests use Node's built-in test runner and assertions. Do not add a test framework without a clear need.

## Data and credentials

Never put API keys or prompt logs in source control. Use environment variables for credentials. The router's optional `PI_MODEL_ROUTER_LOG` setting writes prompt text and routing decisions to a local JSONL file. Logging is off by default. Review `docs/README.md` before enabling it. Treat log data as sensitive.

## Changes and commits

Make each commit atomic. Each commit must contain one complete, related change that can be reviewed, tested, and reverted on its own.

Use Conventional Commit messages. Start each message with a valid type, such as `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, or `chore:`. Add a scope when it helps, such as `fix(router): handle classifier errors`.

Use Semantic Versioning for releases:

- **MAJOR** for an incompatible change.
- **MINOR** for a backward-compatible feature.
- **PATCH** for a backward-compatible fix.

Update the package version for a release. Do not treat each commit as a release. The package is currently private; do not publish it unless the project owner asks.
