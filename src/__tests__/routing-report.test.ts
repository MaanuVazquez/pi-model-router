import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import router from "../model-router.ts";
import type { ClassifierAttempt } from "../types.ts";

test("reports recent routes and lists cheap-tier threshold candidates for review", async (t) => {
	const directory = await mkdtemp(join(tmpdir(), "pi-router-report-"));
	const path = join(directory, "routes.jsonl");
	const original = process.env.PI_MODEL_ROUTER_LOG;
	process.env.PI_MODEL_ROUTER_LOG = path;
	t.after(async () => {
		if (original === undefined) delete process.env.PI_MODEL_ROUTER_LOG;
		else process.env.PI_MODEL_ROUTER_LOG = original;
		await rm(directory, { recursive: true, force: true });
	});

	const now = Date.now();
	const sol = "gpt-6.2-sol";
	const choice = (tier: string, score: number): ClassifierAttempt["answer"] =>
		({ choice: tier, confidence: score, probabilities: { [tier]: score } });
	const entry = (selectedModel: string, status: ClassifierAttempt["status"], answer?: ClassifierAttempt["answer"], timestamp = now, selectedTier?: string) =>
		JSON.stringify({
			timestamp: new Date(timestamp).toISOString(),
			selectedModel,
			...(selectedTier ? { selectedTier } : {}),
			attempts: [{ status: "error" }, { status, answer }],
			input: { task: "private prompt" },
		});
	await writeFile(path, [
		entry(sol, "low-probability", choice("luna", 0.5)),
		entry(sol, "low-probability", choice("luna", 0.49)),
		entry(sol, "low-probability", choice("astra", 0.54)),
		entry(sol, "accepted", choice("sol", 0.9)),
		entry(sol, "error"),
		entry("gpt-6-luna", "accepted", choice("luna", 0.55)),
		entry("gpt-6.2-astra", "accepted", choice("astra", 0.9)),
		entry(sol, "low-probability", choice("luna", 0.53), now - 25 * 60 * 60 * 1000),
		entry("anthropic/claude-sonnet", "accepted", choice("general", 0.9), now, "general"),
		"{",
	].join("\n"), { mode: 0o600 });

	let command: Parameters<ExtensionAPI["registerCommand"]>[1] | undefined;
	router({
		on() {},
		registerCommand(name: string, options: Parameters<ExtensionAPI["registerCommand"]>[1]) {
			if (name === "router-report") command = options;
		},
		registerVirtualModel() {},
	} as unknown as ExtensionAPI);
	assert.ok(command);
	let output = "";
	const ctx = { ui: { notify(message: string) { output = message; } } } as ExtensionCommandContext;
	await command.handler("", ctx);
	assert.match(output, /Routes: Luna 1, Sol 5, Astra 1/);
	assert.match(output, /accepted general 2, low-confidence cheap 2, no classifier choice 1, other 1/);
	assert.match(output, /other models anthropic\/claude-sonnet 1/);
	assert.match(output, /50% cheap threshold would reconsider 1 general routes/);
	assert.match(output, /Skipped 1 invalid log lines/);
	assert.doesNotMatch(output, /private prompt|Line \d+:/);

	await command.handler("--review", ctx);
	assert.deepEqual(output.match(/^Line .*$/gm), ["Line 1: cheap 50.0%"]);
	assert.doesNotMatch(output, /private prompt/);

	await chmod(path, 0o644);
	await command.handler("", ctx);
	assert.match(output, /^Could not read the routing log/);
	assert.doesNotMatch(output, /Routes:/);
});
