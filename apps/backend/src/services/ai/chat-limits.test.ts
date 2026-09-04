import { describe, expect, test } from "bun:test";

import {
  MAX_CHAT_HISTORY_CHARS,
  MAX_CHAT_MESSAGES,
  validateChatMessageLimits,
} from "./chat-limits";

describe("validateChatMessageLimits", () => {
  test("accepts a normal chat history", () => {
    expect(validateChatMessageLimits([{ role: "user", content: "How is my load?" }])).toBeNull();
  });

  test("rejects too many messages", () => {
    expect(validateChatMessageLimits(Array.from({ length: MAX_CHAT_MESSAGES + 1 }))).toContain(
      "more than",
    );
  });

  test("rejects an oversized history", () => {
    expect(validateChatMessageLimits([{ content: "x".repeat(MAX_CHAT_HISTORY_CHARS) }])).toContain(
      "cannot exceed",
    );
  });
});
