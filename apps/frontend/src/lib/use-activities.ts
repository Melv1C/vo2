import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchActivities, syncActivities } from "@/lib/activities-api";

const activitiesQueryKey = ["activities"] as const;

export function useActivities(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: activitiesQueryKey,
    queryFn: fetchActivities,
    enabled,
    refetchOnWindowFocus: true,
  });

  const { mutate: sync, isPending } = useMutation({
    mutationFn: syncActivities,
    onSuccess: (data) => {
      queryClient.setQueryData(activitiesQueryKey, data);
    },
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    sync();
  }, [enabled, sync]);

  return {
    ...query,
    isSyncing: isPending,
  };
}
