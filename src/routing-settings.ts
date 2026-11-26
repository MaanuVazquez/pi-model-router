import { constants } from "node:fs";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { ROUTING_TIERS } from "./constants.ts";
import type { RoutingTier, TierModelMap } from "./types.ts";

function settingsPath(): string {
	return join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "model-router.json");
}

export async function loadTierMappings(): Promise<TierModelMap> {
	const path = settingsPath();
	let file;
	try {
		file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		throw error;
	}
	try {
		const info = await file.stat();
		if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error("Router settings file must be private");
		const parsed: unknown = JSON.parse(await file.readFile("utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const tiers = (parsed as { tiers?: unknown }).tiers;
		if (!tiers || typeof tiers !== "object" || Array.isArray(tiers)) return {};
		const result: TierModelMap = {};
		const legacyKeys = { cheap: "luna", general: "sol", thinking: "astra" } as const;
		for (const tier of ROUTING_TIERS) {
			const values = tiers as Record<string, unknown>;
			const model: unknown = values[tier] ?? values[legacyKeys[tier]];
			if (model && typeof model === "object" &&
				typeof (model as { provider?: unknown }).provider === "string" &&
				typeof (model as { id?: unknown }).id === "string") {
				result[tier] = { provider: (model as { provider: string }).provider, id: (model as { id: string }).id };
			}
		}
		return result;
	} finally {
		await file.close();
	}
}

export async function saveTierMapping(tier: RoutingTier, provider: string, id: string): Promise<void> {
	const path = settingsPath();
	const directory = dirname(path);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const settings = await loadTierMappings();
	settings[tier] = { provider, id };
	const temporaryPath = join(directory, `.model-router-${randomUUID()}.tmp`);
	try {
		await writeFile(temporaryPath, `${JSON.stringify({ tiers: settings }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		await rename(temporaryPath, path);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}
