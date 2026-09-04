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
import { trainingStatsTool } from "@/services/ai/training-stats-tool";

const assistantInstructions = `You are VO2's training statistics assistant.

Answer only from the authenticated athlete's computed training data returned by get_training_stats. Call that tool before answering questions about the athlete's numbers, trends, activities, or training load. Do not invent values or activities.

State the date range used. Explain CTL as chronic training load, ATL as acute training load, and TSB as training stress balance when those metrics appear. Distinguish computed values from estimates and call out missing streams, partial data, or the 100-activity display limit.

Keep answers concise and practical. You may describe patterns, but do not diagnose illness or prescribe medical treatment. The assistant is read-only and must not claim to have changed training data.`;

const model = ENV.OPENROUTER_MODEL as Parameters<typeof createOpenRouterText>[0];
const adapter = createOpenRouterText(model, ENV.OPENROUTER_API_KEY);

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

    const stream = chat({
      adapter,
      messages: params.messages,
      systemPrompts: [assistantInstructions],
      tools: [trainingStatsTool],
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
