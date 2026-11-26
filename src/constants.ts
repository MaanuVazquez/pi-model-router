export const PROVIDER = "openai";
export const ROUTER_PROVIDER = "@maanuvazquez";
export const ROUTER_ID = "auto";
export const ROUTING_TIERS = ["cheap", "general", "thinking"] as const;
export const ROUTING_OPTIONS = [...ROUTING_TIERS, "classifier"] as const;
export const AUTOMATIC_CLASSIFIER = "Automatic (Jev, then Luna Decisions)";
export const ROUTER_SETUP = "Run /model-router to set the cheap, general, and thinking models.";
export const ROUTER_DEFAULT_SETUP = "Open /model and press Ctrl+S on @maanuvazquez/auto to set it as the default.";
export const LUNA = "gpt-6-luna";
export const SOL = "gpt-6.2-sol";
export const ASTRA = "gpt-6.2-astra";
export const MIN_TIER_PROBABILITY = 0.55;
export const REPORT_CHEAP_PROBABILITY = 0.5;
export const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REPORT_REVIEW_LIMIT = 10;
export const ROUTING_LOG_ENV = "PI_MODEL_ROUTER_LOG";
export const CLASSIFIERS = [
	["typesafe", "jev-latest"],
	[PROVIDER, LUNA],
] as const;

export const TASK_TIERS = {
	cheap: "A short answer, a simple lookup, or a small edit with clear instructions.",
	general: "Standard implementation, code review, analysis, or debugging with a clear scope.",
	thinking: "A hard diagnosis, a broad refactor, or an architecture decision with major trade-offs.",
};
