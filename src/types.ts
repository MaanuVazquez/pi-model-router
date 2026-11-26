import type { ClassifierChoiceAnswer } from "@earendil-works/pi-ai";
import type { ModelRouteRequest } from "@earendil-works/pi-coding-agent";

export type UserMessage = Extract<ModelRouteRequest["messages"][number], { role: "user" }>;

export type RoutingTier = "cheap" | "general" | "thinking";

export interface TierModel {
	provider: string;
	id: string;
}

export type TierModelMap = Partial<Record<RoutingTier, TierModel>>;

export interface RoutingInput {
	task: string;
	previousTask: string;
	hasImage: boolean;
}

export interface ClassifierAttempt {
	provider: string;
	model: string;
	status: "unavailable" | "error" | "no-choice" | "low-probability" | "accepted";
	answer?: Pick<ClassifierChoiceAnswer, "choice" | "probabilities" | "confidence">;
}

export interface RoutingLogEntry {
	timestamp: string;
	selectedTier?: RoutingTier;
	input: RoutingInput;
	attempts: ClassifierAttempt[];
	preferredModel: string;
	selectedModel: string;
	requestedThinkingLevel: ModelRouteRequest["thinkingLevel"];
}

export interface RoutingReportEntry extends Pick<RoutingLogEntry, "timestamp" | "attempts" | "selectedTier"> {
	selectedModel: string;
}
