import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ClassifierResult } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, ExtensionVirtualModel, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import router from "../model-router.ts";
import type { RoutingLogEntry } from "../types.ts";

test("routes new turns, keeps the active model, and logs decisions only when enabled", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "pi-model-router-"));
	const logPath = join(directory, "routes.jsonl");
	const originalLogPath = process.env.PI_MODEL_ROUTER_LOG;
	delete process.env.PI_MODEL_ROUTER_LOG;
	t.after(async () => {
		if (originalLogPath === undefined) delete process.env.PI_MODEL_ROUTER_LOG;
		else process.env.PI_MODEL_ROUTER_LOG = originalLogPath;
		await rm(directory, { recursive: true, force: true });
	});
	let definition: ExtensionVirtualModel | undefined;
	router({
		registerVirtualModel(route: ExtensionVirtualModel) { definition = route; },
	} as ExtensionAPI);
	assert.ok(definition);

	const available = ["gpt-6-luna", "gpt-6.2-sol", "gpt-6.2-astra"].map((id) => ({ provider: "openai", id }));
	let answer: ClassifierResult["answers"]["tier"] | undefined;
	let jevError = false;
	let lunaError = false;
	const calls: string[] = [];
	const route = definition.route;
	const request: Pick<ModelRouteRequest, "reason" | "messages" | "thinkingLevel"> = {
		reason: "user",
		messages: [
			{ role: "user", content: "p".repeat(2_000) + "excluded previous text", timestamp: 0 },
			{ role: "user", content: [
				{ type: "text", text: "r".repeat(8_000) + "excluded current text" },
				{ type: "image", data: "private-image-bytes", mimeType: "image/png" },
			], timestamp: 1 },
		],
		thinkingLevel: "medium",
	};
	const registry = {
		getAvailable: () => available,
		getAvailableOfType: async (_type: string, provider: string) => provider === "typesafe"
			? [{ provider, id: "jev-latest" }]
			: [{ provider, id: "gpt-6-luna" }],
		classify: async (model: Pick<ClassifierResult, "provider">) => {
			calls.push(model.provider);
			if (model.provider === "typesafe") {
				return jevError
					? { stopReason: "error", errorMessage: "HTTP 429: token quota exceeded", answers: {} }
					: { stopReason: "stop", answers: answer ? { tier: answer } : {} };
			}
			return lunaError
				? { stopReason: "error", answers: {} }
				: { stopReason: "stop", answers: { tier: { type: "choice", choice: "luna", probabilities: { luna: 0.9 } } } };
		},
	};
	const ctx = { modelRegistry: registry } as unknown as ExtensionContext;

	answer = { type: "choice", choice: "luna", confidence: 0.95, probabilities: { luna: 0.95 } };
	assert.equal((await route(request as ModelRouteRequest, ctx)).model.id, "gpt-6-luna");
	process.env.PI_MODEL_ROUTER_LOG = logPath;

	answer = { type: "choice", choice: "astra", confidence: 0.35, probabilities: { astra: 0.57, sol: 0.35, luna: 0.08 } };
	const deep = await route(request as ModelRouteRequest, ctx);
	assert.equal(deep.model.id, "gpt-6.2-astra");

	const followUp = await route({
		...request, reason: "continuation", previous: deep, thinkingLevel: "low",
	} as ModelRouteRequest, ctx);
	assert.equal(followUp.model.id, "gpt-6.2-astra");
	assert.equal(followUp.thinkingLevel, "medium");
	assert.deepEqual(calls, ["typesafe", "typesafe"]);

	answer.probabilities.astra = 0.5;
	assert.equal((await route(request as ModelRouteRequest, ctx)).model.id, "gpt-6.2-sol");
	assert.deepEqual(calls.splice(0), ["typesafe", "typesafe", "typesafe"]);

	jevError = true;
	assert.equal((await route(request as ModelRouteRequest, ctx)).model.id, "gpt-6-luna");
	assert.deepEqual(calls.splice(0), ["typesafe", "openai"]);

	lunaError = true;
	assert.equal((await route(request as ModelRouteRequest, ctx)).model.id, "gpt-6.2-sol");
	assert.deepEqual(calls, ["typesafe", "openai"]);

	const log = await readFile(logPath, "utf8");
	const entries: RoutingLogEntry[] = log.trimEnd().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(entries.map((entry) => entry.selectedModel), [
		"gpt-6.2-astra", "gpt-6.2-sol", "gpt-6-luna", "gpt-6.2-sol",
	]);
	assert.deepEqual(entries[0].input, { task: "r".repeat(8_000), previousTask: "p".repeat(2_000), hasImage: true });
	assert.equal(entries[0].attempts[0].answer?.probabilities.astra, 0.57);
	assert.equal(entries[1].attempts[0].status, "low-probability");
	assert.deepEqual(entries[2].attempts.map(({ provider, status }) => [provider, status]), [
		["typesafe", "error"], ["openai", "accepted"],
	]);
	assert.doesNotMatch(log, /private-image-bytes|token quota exceeded|excluded .* text/);
	assert.equal((await stat(logPath)).mode & 0o777, 0o600);
});
