import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	ASTRA, LUNA, MIN_TIER_PROBABILITY, REPORT_CHEAP_PROBABILITY, REPORT_REVIEW_LIMIT, REPORT_WINDOW_MS, ROUTING_LOG_ENV, SOL,
} from "./constants.ts";
import type { ClassifierAttempt, RoutingReportEntry } from "./types.ts";

function parseEntry(line: string): RoutingReportEntry | undefined {
	try {
		const entry = JSON.parse(line) as RoutingReportEntry | null;
		if (typeof entry?.timestamp === "string" && Number.isFinite(Date.parse(entry.timestamp)) &&
			typeof entry.selectedModel === "string" &&
			Array.isArray(entry.attempts) && entry.attempts.every((attempt: ClassifierAttempt) =>
				typeof attempt?.status === "string")) return entry;
	} catch {
		// A partial or malformed line does not stop the report.
	}
}

async function routingReport(path: string, review: boolean): Promise<string> {
	const now = Date.now();
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const info = await file.stat();
		if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error("Log file must be private");

		const routes = new Map<string, number>();
		const general = { accepted: 0, lowCheap: 0, noChoice: 0, other: 0 };
		const candidates: string[] = [];
		let eligible = 0;
		let skipped = 0;
		let lineNumber = 0;

		for await (const line of file.readLines()) {
			lineNumber++;
			if (!line.trim()) continue;
			const entry = parseEntry(line);
			if (!entry) {
				skipped++;
				continue;
			}
			const timestamp = Date.parse(entry.timestamp);
			if (timestamp < now - REPORT_WINDOW_MS || timestamp > now) continue;

			routes.set(entry.selectedModel, (routes.get(entry.selectedModel) ?? 0) + 1);
			const legacyLog = !entry.selectedTier;
			const isGeneralRoute = entry.selectedTier ? entry.selectedTier === "general" : entry.selectedModel === SOL;
			if (!isGeneralRoute) continue;
			const attempt = entry.attempts.at(-1);
			if (attempt?.status === "accepted" && attempt.answer?.choice === (legacyLog ? "sol" : "general")) {
				general.accepted++;
			} else if (attempt?.status === "low-probability" && attempt.answer?.choice === (legacyLog ? "luna" : "cheap")) {
				general.lowCheap++;
				const score = attempt.answer.probabilities?.[legacyLog ? "luna" : "cheap"];
				if (typeof score === "number" && score >= REPORT_CHEAP_PROBABILITY && score < MIN_TIER_PROBABILITY) {
					eligible++;
					if (review) {
						candidates.push(`Line ${lineNumber}: cheap ${(score * 100).toFixed(1)}%`);
						if (candidates.length > REPORT_REVIEW_LIMIT) candidates.shift();
					}
				}
			} else if (!attempt || attempt.status === "error" || attempt.status === "unavailable" || attempt.status === "no-choice") {
				general.noChoice++;
			} else {
				general.other++;
			}
		}

		return [
			"Routing report: last 24 hours",
			`Routes: Luna ${routes.get(LUNA) ?? 0}, Sol ${routes.get(SOL) ?? 0}, Astra ${routes.get(ASTRA) ?? 0}${[...routes.keys()].some((model) => model !== LUNA && model !== SOL && model !== ASTRA) ? `, other models ${[...routes].filter(([model]) => model !== LUNA && model !== SOL && model !== ASTRA).map(([model, count]) => `${model} ${count}`).join(", ")}` : ""}.`,
			`General routes: accepted general ${general.accepted}, low-confidence cheap ${general.lowCheap}, no classifier choice ${general.noChoice}, other ${general.other}.`,
			`A ${REPORT_CHEAP_PROBABILITY * 100}% cheap threshold would reconsider ${eligible} general routes.`,
			...(skipped ? [`Skipped ${skipped} invalid log lines.`] : []),
			...(candidates.length ? ["Review the most recent candidates by line number in the local log:", ...candidates] : []),
		].join("\n");
	} finally {
		await file.close();
	}
}

export function registerRoutingReport(pi: ExtensionAPI): void {
	pi.registerCommand("router-report", {
		description: "Report routing decisions from the last 24 hours",
		async handler(args, ctx) {
			const option = args.trim();
			if (option && option !== "--review") {
				ctx.ui.notify("Usage: /router-report [--review]", "warning");
				return;
			}
			const path = process.env[ROUTING_LOG_ENV];
			if (!path || !isAbsolute(path)) {
				ctx.ui.notify(`Set ${ROUTING_LOG_ENV} to an absolute path to a private routing log.`, "warning");
				return;
			}
			try {
				ctx.ui.notify(await routingReport(path, option === "--review"), "info");
			} catch {
				ctx.ui.notify(`Could not read the routing log. Check ${ROUTING_LOG_ENV} and file permissions.`, "warning");
			}
		},
	});
}
