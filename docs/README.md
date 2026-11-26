# Pi Model Router

Select `@maanuvazquez/auto` to have Pi choose a chat model for each new user turn.

## Install from GitHub

Use Pi 1.6.1 and Node.js 24 or later. Set `OPENAI_API_KEY` for OpenAI chat models and Luna Decisions. Set `TYPESAFE_API_KEY` if you want to use Jev. If you use ChatGPT sign-in for the `openai` provider, use `/logout` for that provider before you use Luna Decisions with an API key.

```sh
pi install git:github.com/MaanuVazquez/pi-model-router
```

Start Pi, then [set up automatic routing](#set-models-for-automatic-routing).

## Install from a local copy

1. Open a terminal in the package directory. Check that you have Pi 1.6.1 and Node.js 24 or later.

   ```sh
   pi --version
   node --version
   ```

2. Set `TYPESAFE_API_KEY` for Jev and `OPENAI_API_KEY` for the OpenAI chat models and Luna Decisions. Do not put either key in the package or in source control. If you use ChatGPT sign-in for the `openai` provider, use `/logout` for that provider first. Pi does not use the API key for Decisions while that sign-in is active.

3. Run the extension once without installing it.

   ```sh
   pi -e ./src/model-router.ts
   ```

4. Close that session. Install the package from the same directory.

   ```sh
   pi install "$PWD"
   pi list
   ```

   Pi loads the package from this directory. It does not copy the files. Use `pi install -l "$PWD"` instead to install it only for this project. Pi must trust the project to load that installation.

5. Start Pi, or run `/reload` in an existing session. Then [set up automatic routing](#set-models-for-automatic-routing).

To remove the package, run `pi remove "$PWD"` from the package directory. Add `-l` if you installed it for this project only.

## Set models for automatic routing

A new installation does not assign any chat models or change your default model.

1. Run `/model-router` to choose a tier and assign one of Pi's available chat models. Repeat for cheap, general, and thinking.
2. Open `/model` and highlight `@maanuvazquez/auto`.
3. Press **Ctrl+S** to set it as the default for new sessions.

The tier picker shows saved models in parentheses. To go directly to a tier's model picker, run a command such as `/model-router cheap`. The extension stores your choices in `model-router.json` in the Pi agent directory. They apply to all sessions that use that directory. Existing choices still apply. If you used `openai/auto` before, select the new virtual model in step 2.

## Routing policy

| Tier | Tasks |
| --- | --- |
| cheap | Short answers, simple lookups, and small edits |
| general | Standard implementation, reviews, and debugging |
| thinking | Hard diagnosis, broad refactors, and architecture trade-offs |

Luna Decisions is a classifier. It does not set the chat model for any tier.

The router tries hosted Jev first. If Jev is unavailable or returns an error, such as a quota or rate limit, the router tries Luna Decisions. If neither classifier is available or both return errors, the router uses the general tier. A successful classifier result below 55% also uses the general tier without a second classifier call. If the model assigned to the selected tier is unavailable, the router asks you to choose another model for that tier. It does not substitute another chat model.

The classifier gets up to 8,000 characters from the current user message and 2,000 from the previous user message. It gets an image flag but no image data, tool output, or separate repository files. TypeSafe receives this input when Jev is called. OpenAI receives the routing input if Luna Decisions is called.

Tool follow-ups and retries keep the previous route when Pi provides it. Direct requests, such as compaction summaries, prefer the cheap tier. Pi passes the selected thinking level to the chosen chat model and clamps it to the model's supported levels.

## Record routing decisions

Logging is off by default. To collect examples for tuning on macOS or Linux, start Pi with an absolute log path in a private local directory:

```sh
PI_MODEL_ROUTER_LOG="$HOME/.pi/agent/model-router.jsonl" pi --model @maanuvazquez/auto
```

Each completed routing decision for a new user turn appends one JSON line. The line includes the timestamp, selected tier, the same bounded text and image flag used for routing, each classifier's status and available scores, the preferred and selected chat models, and the requested thinking level. It does not include image bytes, tool results, or provider error messages. It does not record tool follow-ups, retries, or compaction requests.

The router creates the file with owner-only permissions. Use an existing directory that other users cannot write to. If a write fails, the router warns and still selects a model. Logging makes no extra network requests.

Prompt text is not redacted. Keep the log out of Git and cloud sync. Review it before you share it or use it for training. Unset `PI_MODEL_ROUTER_LOG` to stop logging. Remove or rotate the file yourself. The log records the router's decision, not the correct tier or the quality of the answer.

## Review routing decisions

In an interactive Pi session with logging enabled, run `/router-report` to summarize the last 24 hours. The report shows which models handled new turns and why the router selected the general tier.

The report also counts general routes where cheap was the classifier's top choice and its score was at least 50% but below 55%. This is an estimate of which routes a lower cheap threshold could change. The log does not show whether the cheap-tier model was available at the time or whether it would have completed the task well.

Run `/router-report --review` to show up to ten recent candidates by line number. Open those lines in the private log and mark each task as `cheap enough`, `general needed`, or `unsure` in your own notes. The command does not display prompts, send data, or change the routing rule.

## Classifier comparison

See [Jev vs. Luna Decisions](classifier-evaluation.md) for the test prompts and results.

## Check the router

Pi supplies the runtime APIs. You do not need to run npm to use the local extension. To develop the extension, install the pinned development dependencies and run the checks:

```sh
npm ci
npm run typecheck
npm test
pi --offline --no-extensions -e ./src/model-router.ts --list-models @maanuvazquez/auto
```
