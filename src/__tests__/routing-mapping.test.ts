import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, ExtensionVirtualModel, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import router from "../model-router.ts";

test("/model-router saves tier model choices for future routing", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "pi-router-settings-"));
	const originalDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = directory;
	t.after(async () => {
		if (originalDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = originalDir;
		await rm(directory, { recursive: true, force: true });
	});

	let command: Parameters<ExtensionAPI["registerCommand"]>[1] | undefined;
	let definition: ExtensionVirtualModel | undefined;
	router({
		on() {},
		registerCommand(name: string, options: Parameters<ExtensionAPI["registerCommand"]>[1]) {
			if (name === "model-router") command = options;
		},
		registerVirtualModel(model: ExtensionVirtualModel) { definition = model; },
	} as unknown as ExtensionAPI);
	assert.ok(command);
	assert.ok(definition);

	const available = [
		{ provider: "openai", id: "gpt-6-luna" },
		{ provider: "openai", id: "gpt-6.2-sol" },
		{ provider: "openai", id: "gpt-6.2-astra" },
		{ provider: "anthropic", id: "claude-haiku" },
		{ provider: "google", id: "gemini-standard" },
	];
	await writeFile(join(directory, "model-router.json"), JSON.stringify({
		tiers: {
			sol: { provider: "google", id: "gemini-standard" },
			thinking: { provider: "openai", id: "gpt-6.2-astra" },
		},
	}), { mode: 0o600 });
	const selections = ["anthropic/claude-haiku"];
	let tierOptions: string[] = [];
	let notice = "";
	const ctx = {
		modelRegistry: { getAvailable: () => available },
		ui: {
			async select(title: string, options: string[]) {
				if (title === "Choose a routing tier") {
					tierOptions = options;
					return options.find((option) => option === "cheap");
				}
				return selections.shift();
			},
			notify(message: string) { notice = message; },
		},
	} as unknown as ExtensionCommandContext;

	await command.handler("", ctx);
	assert.deepEqual(tierOptions, [
		"cheap",
		"general (google/gemini-standard)",
		"thinking (openai/gpt-6.2-astra)",
	]);
	assert.match(notice, /Saved anthropic\/claude-haiku for cheap tasks/);
	assert.match(notice, /Ctrl\+S on @maanuvazquez\/auto/);
	const settings = JSON.parse(await readFile(join(directory, "model-router.json"), "utf8")) as {
		tiers: {
			cheap: { provider: string; id: string };
			general: { provider: string; id: string };
		};
	};
	assert.deepEqual(settings.tiers.cheap, { provider: "anthropic", id: "claude-haiku" });
	assert.deepEqual(settings.tiers.general, { provider: "google", id: "gemini-standard" });

	const routed = await definition.route({
		reason: "user", messages: [{ role: "user", content: "Small task", timestamp: 1 }], thinkingLevel: "medium",
	} as unknown as ModelRouteRequest, {
		modelRegistry: {
			getAvailable: () => available,
			getAvailableOfType: async () => [{ provider: "typesafe", id: "jev-latest" }],
			classify: async () => ({
				stopReason: "stop",
				answers: { tier: { type: "choice", choice: "cheap", confidence: 0.9, probabilities: { cheap: 0.9 } } },
			}),
		},
	} as unknown as ExtensionContext);
	assert.equal(routed.model.provider, "anthropic");
	assert.equal(routed.model.id, "claude-haiku");

	await command.handler("unknown", ctx);
	assert.match(notice, /Usage: \/model-router/);
});
