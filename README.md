# Pi Model Router

Select `openai/auto` to have Pi choose an OpenAI chat model for each new user turn.

## Install from GitHub

Use Pi 1.6.1 and Node.js 24 or later. Set `OPENAI_API_KEY` for OpenAI chat models and Luna Decisions. Set `TYPESAFE_API_KEY` if you want to use Jev. If you use ChatGPT sign-in for the `openai` provider, use `/logout` for that provider before you use Luna Decisions with an API key.

```sh
pi install git:github.com/MaanuVazquez/pi-model-router
pi --model openai/auto
```

## Install from a local copy

1. Open a terminal in the package directory. Check that you have Pi 1.6.1 and Node.js 24 or later.

   ```sh
   pi --version
   node --version
   ```

2. Set `TYPESAFE_API_KEY` for Jev and `OPENAI_API_KEY` for the OpenAI chat models and Luna Decisions. Do not put either key in the package or in source control. If you use ChatGPT sign-in for the `openai` provider, use `/logout` for that provider first. Pi does not use the API key for Decisions while that sign-in is active.

3. Run the extension once without installing it.

   ```sh
   pi -e ./model-router.ts --model openai/auto
   ```

4. Close that session. Install the package from the same directory.

   ```sh
   pi install "$PWD"
   pi list
   ```

   Pi loads the package from this directory. It does not copy the files. Use `pi install -l "$PWD"` instead to install it only for this project. Pi must trust the project to load that installation.

5. Start Pi with the router. In an existing session, run `/reload`, then select `openai/auto` with `/model`. The footer shows the selected chat model after dispatch.

   ```sh
   pi --model openai/auto
   ```

To remove the package, run `pi remove "$PWD"` from the package directory. Add `-l` if you installed it for this project only.

## Routing policy

| Task | Chat model |
| --- | --- |
| Short answers, simple lookups, and small edits | GPT-6 Luna |
| Standard implementation, reviews, and debugging | GPT-6.2 Sol |
| Hard diagnosis, broad refactors, and architecture trade-offs | GPT-6.2 Astra |

Pi's catalog has no GPT-6.2 Luna. GPT-6 Luna is the chat model for routine work. Luna Decisions is a separate classifier.

The router tries hosted Jev first. If Jev is unavailable or returns an error, such as a quota or rate limit, the router tries Luna Decisions. If neither classifier is available or both return errors, the router uses Sol. A successful classifier result below 55% also uses Sol without a second classifier call. If Sol is unavailable, the router uses Luna as the chat fallback. It does not use Astra as a fallback.

The classifier gets up to 8,000 characters from the current user message and 2,000 from the previous user message. It gets an image flag but no image data, tool output, or separate repository files. TypeSafe receives this input when Jev is called. OpenAI receives the routing input if Luna Decisions is called.

Tool follow-ups and retries keep the previous route when Pi provides it. Direct requests, such as compaction summaries, prefer Luna. Pi passes the selected thinking level to the chosen chat model and clamps it to the model's supported levels.

## Classifier comparison

See [Jev vs. Luna Decisions](classifier-evaluation.md) for the test prompts and results.

## Check the router

Pi supplies the runtime APIs. You do not need to run npm to use the local extension. To develop the extension, install the pinned development dependencies and run the checks:

```sh
npm ci
npm run typecheck
npm test
pi --offline --no-extensions -e ./model-router.ts --list-models openai/auto
```
