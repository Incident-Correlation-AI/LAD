import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acknowledgeIncident,
  fetchIncident,
  fetchIncidents,
  resolveIncident,
} from "../api/client";
import type { IncidentFilters } from "../api/types";

export const incidentKeys = {
  list: (filters: IncidentFilters) => ["incidents", "list", filters] as const,
  detail: (id: string) => ["incidents", "detail", id] as const,
};

export function useIncidents(filters: IncidentFilters) {
  return useInfiniteQuery({
    queryKey: incidentKeys.list(filters),
    queryFn: ({ pageParam, signal }) => fetchIncidents(filters, pageParam, signal),
    initialPageParam: null as string | null,
    // Cursors are opaque: pass them through untouched.
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}

export function useIncident(incidentId: string) {
  return useQuery({
    queryKey: incidentKeys.detail(incidentId),
    queryFn: ({ signal }) => fetchIncident(incidentId, signal),
    enabled: Boolean(incidentId),
  });
}

/**
 * Lifecycle actions. The server is the source of truth: we write the returned
 * record into the cache rather than guessing the new state locally.
 */
export function useIncidentLifecycle(incidentId: string) {
  const queryClient = useQueryClient();

  const onSuccess = (updated: Awaited<ReturnType<typeof acknowledgeIncident>>) => {
    queryClient.setQueryData(incidentKeys.detail(incidentId), updated);
    void queryClient.invalidateQueries({ queryKey: ["incidents", "list"] });
  };

  const acknowledge = useMutation({
    mutationFn: () => acknowledgeIncident(incidentId),
    onSuccess,
  });

  const resolve = useMutation({
    mutationFn: () => resolveIncident(incidentId),
    onSuccess,
  });

  return { acknowledge, resolve };
}
