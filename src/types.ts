import type { ClassifierChoiceAnswer } from "@earendil-works/pi-ai";
import type { ModelRouteRequest } from "@earendil-works/pi-coding-agent";

export type UserMessage = Extract<ModelRouteRequest["messages"][number], { role: "user" }>;

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
	input: RoutingInput;
	attempts: ClassifierAttempt[];
	preferredModel: string;
	selectedModel: string;
	requestedThinkingLevel: ModelRouteRequest["thinkingLevel"];
}
