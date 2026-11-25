import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClassifierResult } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, ExtensionVirtualModel, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import router from "../model-router.ts";

test("routes new turns and keeps the active model through tool calls", async () => {
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
		messages: [{ role: "user", content: "Review this task.", timestamp: 0 }],
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
});
