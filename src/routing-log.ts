import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { ROUTING_LOG_ENV } from "./constants.ts";
import type { RoutingLogEntry } from "./types.ts";

export async function logRoutingDecision(entry: RoutingLogEntry): Promise<void> {
	const path = process.env[ROUTING_LOG_ENV];
	if (!path) return;

	try {
		if (!isAbsolute(path)) throw new Error("Log path must be absolute");
		const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK;
		const file = await open(path, flags, 0o600);
		try {
			const info = await file.stat();
			if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error("Log file must be private");
			await file.appendFile(JSON.stringify(entry) + "\n");
		} finally {
			await file.close();
		}
	} catch {
		console.warn(`Pi model router: Could not write the routing log. Check ${ROUTING_LOG_ENV} and file permissions.`);
	}
}
