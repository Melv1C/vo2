import type { InferResponseType } from "hono/client";

import { apiClient } from "@/lib/api-client";

export type ActivitySyncSummary = InferResponseType<typeof apiClient.activities.$get>;

export async function fetchActivities(signal?: AbortSignal) {
  const res = await apiClient.activities.$get(undefined, { init: { signal } });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function setStreamsSince(streamsSince: string) {
  const res = await apiClient.activities["streams-since"].$put({
    json: { streamsSince },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function syncStreams() {
  const res = await apiClient.activities.sync.streams.$post();

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}
