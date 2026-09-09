export const MAX_CHAT_BODY_BYTES = 256 * 1024;
export const MAX_CHAT_MESSAGES = 40;
export const MAX_CHAT_HISTORY_CHARS = 20_000;

export function validateChatMessageLimits(messages: readonly unknown[]): string | null {
  if (messages.length > MAX_CHAT_MESSAGES) {
    return `Chat history cannot contain more than ${MAX_CHAT_MESSAGES} messages`;
  }

  const historyChars = messages.reduce<number>(
    (total, message) => total + (JSON.stringify(message)?.length ?? 0),
    0,
  );
  if (historyChars > MAX_CHAT_HISTORY_CHARS) {
    return `Chat history cannot exceed ${MAX_CHAT_HISTORY_CHARS} characters`;
  }

  return null;
}
