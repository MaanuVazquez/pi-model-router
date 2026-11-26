import { constants } from "node:fs";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { ROUTING_TIERS } from "./constants.ts";
import type { ModelReference, RoutingOption, RoutingSettings } from "./types.ts";

function settingsPath(): string {
	return join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "model-router.json");
}

function modelReference(value: unknown): ModelReference | undefined {
	if (!value || typeof value !== "object" || !("provider" in value) || !("id" in value)) return;
	if (typeof value.provider === "string" && value.provider && typeof value.id === "string" && value.id) {
		return { provider: value.provider, id: value.id };
	}
}

export async function loadRoutingSettings(): Promise<RoutingSettings> {
	const path = settingsPath();
	let file;
	try {
		file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { tiers: {} };
		throw error;
	}
	try {
		const info = await file.stat();
		if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error("Router settings file must be private");
		const parsed: unknown = JSON.parse(await file.readFile("utf8"));
		const settings: RoutingSettings = { tiers: {} };
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return settings;
		if ("classifier" in parsed) settings.classifier = modelReference(parsed.classifier);
		if ("tiers" in parsed && parsed.tiers && typeof parsed.tiers === "object" && !Array.isArray(parsed.tiers)) {
			const values = parsed.tiers as Record<string, unknown>;
			const legacyKeys = { cheap: "luna", general: "sol", thinking: "astra" } as const;
			for (const tier of ROUTING_TIERS) {
				const model = modelReference(values[tier] ?? values[legacyKeys[tier]]);
				if (model) settings.tiers[tier] = model;
			}
		}
		return settings;
	} finally {
		await file.close();
	}
}

export async function saveRoutingChoice(option: RoutingOption, model?: ModelReference): Promise<void> {
	const path = settingsPath();
	const directory = dirname(path);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const settings = await loadRoutingSettings();
	if (option === "classifier") settings.classifier = model;
	else if (model) settings.tiers[option] = model;
	const temporaryPath = join(directory, `.model-router-${randomUUID()}.tmp`);
	try {
		await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}
