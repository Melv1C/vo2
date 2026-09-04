import { trainingStatsToolDefinition } from "@repo/ai";

import { getTrainingStats } from "@/services/ai/training-stats";

export type TrainingStatsToolContext = {
  userId: string;
};

export const trainingStatsTool = trainingStatsToolDefinition.server<TrainingStatsToolContext>(
  async (input, { context }) => getTrainingStats(context.userId, input),
);
