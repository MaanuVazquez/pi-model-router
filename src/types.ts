import type { ModelRouteRequest } from "@earendil-works/pi-coding-agent";

export type UserMessage = Extract<ModelRouteRequest["messages"][number], { role: "user" }>;
