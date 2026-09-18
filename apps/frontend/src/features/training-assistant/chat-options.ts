import {
  createPlannedWorkoutToolDefinition,
  deletePlannedWorkoutToolDefinition,
  listPlannedWorkoutsToolDefinition,
  trainingStatsToolDefinition,
  updatePlannedWorkoutToolDefinition,
} from "@repo/ai";
import { fetchServerSentEvents } from "@tanstack/ai-react";
import { ENV } from "varlock/env";

export const trainingAssistantChatOptions = {
  connection: fetchServerSentEvents(ENV.BACKEND_URL + "/api/chat", {
    credentials: "include",
  }),
  tools: [
    trainingStatsToolDefinition,
    listPlannedWorkoutsToolDefinition,
    createPlannedWorkoutToolDefinition,
    updatePlannedWorkoutToolDefinition,
    deletePlannedWorkoutToolDefinition,
  ],
};

export type TrainingAssistantChatOptions = typeof trainingAssistantChatOptions;
