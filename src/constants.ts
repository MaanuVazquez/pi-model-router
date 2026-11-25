export const PROVIDER = "openai";
export const LUNA = "gpt-6-luna";
export const SOL = "gpt-6.2-sol";
export const ASTRA = "gpt-6.2-astra";
export const MIN_TIER_PROBABILITY = 0.55;
export const ROUTING_LOG_ENV = "PI_MODEL_ROUTER_LOG";
export const CLASSIFIERS = [
	["typesafe", "jev-latest"],
	[PROVIDER, LUNA],
] as const;

export const TASK_TIERS = {
	luna: "A short answer, a simple lookup, or a small edit with clear instructions.",
	sol: "Standard implementation, code review, analysis, or debugging with a clear scope.",
	astra: "A hard diagnosis, a broad refactor, or an architecture decision with major trade-offs.",
};
