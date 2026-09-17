import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  toServerSentEventsResponse,
} from "@tanstack/ai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ENV } from "varlock/env";

import { isAuthenticated } from "@/middlewares/use-auth";
import { MAX_CHAT_BODY_BYTES, validateChatMessageLimits } from "@/services/ai/chat-limits";
import {
  createPlannedWorkoutTool,
  deletePlannedWorkoutTool,
  listPlannedWorkoutsTool,
  updatePlannedWorkoutTool,
} from "@/services/ai/planned-workouts-tools";
import { trainingStatsTool } from "@/services/ai/training-stats-tool";

const assistantInstructions = `You are VO2's training and planning assistant.

Answer questions about computed training data only from get_training_stats. Call list_planned_workouts before answering questions about the athlete's plan. Do not invent values, activities, or planned workouts.

You can create, update, and delete planned workouts with the planning tools. Always ask for duration when it is missing. The create, update, and delete tools require explicit athlete approval. Never claim a planned workout was changed until the approved tool call returns successfully. Do not automatically match planned workouts to Strava activities.

State the date range used. Explain CTL as chronic training load, ATL as acute training load, and TSB as training stress balance when those metrics appear. Distinguish computed values from estimates and call out missing streams, partial data, or the 100-activity display limit.

Keep answers concise and practical. You may describe patterns, but do not diagnose illness or prescribe medical treatment. Training analytics are read-only. Planning changes are only made by the approved planning tools.`;

const model = ENV.OPENROUTER_MODEL as Parameters<typeof createOpenRouterText>[0];
const openRouterApiKey = ENV.OPENROUTER_API_KEY?.trim();
const adapter = openRouterApiKey ? createOpenRouterText(model, openRouterApiKey) : null;

export const chatRoutes = new Hono().use(isAuthenticated).post(
  "/",
  bodyLimit({
    maxSize: MAX_CHAT_BODY_BYTES,
    onError: (c) => c.json({ message: "Chat request is too large" }, 413),
  }),
  async (c) => {
    const userId = c.get("user")!.id;
    let params: Awaited<ReturnType<typeof chatParamsFromRequestBody>>;

    try {
      params = await chatParamsFromRequestBody(await c.req.json());
    } catch {
      return c.json({ message: "Invalid chat request" }, 400);
    }

    const limitError = validateChatMessageLimits(params.messages);
    if (limitError) {
      return c.json({ message: limitError }, 400);
    }
    if (!adapter) {
      return c.json({ message: "AI chat is not configured" }, 503);
    }

    const stream = chat({
      adapter,
      messages: params.messages,
      systemPrompts: [assistantInstructions],
      tools: [
        trainingStatsTool,
        listPlannedWorkoutsTool,
        createPlannedWorkoutTool,
        updatePlannedWorkoutTool,
        deletePlannedWorkoutTool,
      ],
      context: { userId },
      agentLoopStrategy: maxIterations(4),
      modelOptions: {
        temperature: 0.2,
        maxCompletionTokens: 900,
        reasoning: {
          effort: "low",
        },
      },
      threadId: params.threadId,
      runId: params.runId,
      parentRunId: params.parentRunId,
      resume: params.resume,
    });

    return toServerSentEventsResponse(stream);
  },
);
