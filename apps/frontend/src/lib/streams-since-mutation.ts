import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setStreamsSince } from "@/lib/activities-api";
import { activitiesQueryKey } from "@/lib/activities-query";

export function useSetStreamsSince() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (streamsSince: string) => setStreamsSince(streamsSince),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
}
