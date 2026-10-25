import { useQueries, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acknowledgeIncident,
  fetchIncident,
  fetchIncidents,
  resolveIncident,
} from "../api/client";
import type {
  IncidentFilters,
  IncidentSeverity,
  IncidentStatus,
} from "../api/types";

export const incidentKeys = {
  list: (filters: IncidentFilters) => ["incidents", "list", filters] as const,
  detail: (id: string) => ["incidents", "detail", id] as const,
  counts: (status: IncidentStatus) => ["incidents", "count", status] as const,
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

const COUNT_STATUSES: IncidentStatus[] = ["open", "acknowledged", "resolved"];
const SEVERITIES: IncidentSeverity[] = ["critical", "high", "medium", "low"];
const COUNT_PAGE_SIZE = 100;

export interface IncidentBreakdown {
  counts: Record<IncidentStatus, number>;
  /** True when more than 100 incidents exist for that status: show "100+". */
  capped: Record<IncidentStatus, boolean>;
  severity: Record<IncidentSeverity, number>;
  latest: string | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Summary figures for the stat cards and the severity chart.
 *
 * The API only offers cursor pagination, so each status is counted from at most
 * one page of 100. When `next_cursor` is present we report "100+" rather than
 * pretending the number is exact — an understated count shown as fact would be
 * a lie on a dashboard.
 */
export function useIncidentBreakdown(): IncidentBreakdown {
  const results = useQueries({
    queries: COUNT_STATUSES.map((status) => ({
      queryKey: incidentKeys.counts(status),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchIncidents({ status, limit: COUNT_PAGE_SIZE }, null, signal),
      staleTime: 30_000,
    })),
  });

  const counts: Record<IncidentStatus, number> = {
    open: 0,
    acknowledged: 0,
    resolved: 0,
  };
  const capped: Record<IncidentStatus, boolean> = {
    open: false,
    acknowledged: false,
    resolved: false,
  };
  const severity: Record<IncidentSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  let latest: string | null = null;

  COUNT_STATUSES.forEach((status, index) => {
    const page = results[index]?.data;
    if (!page) return;
    counts[status] = page.items.length;
    capped[status] = page.next_cursor !== null;
    for (const incident of page.items) {
      if (SEVERITIES.includes(incident.severity)) severity[incident.severity] += 1;
      if (latest === null || incident.created_at > latest) latest = incident.created_at;
    }
  });

  return {
    counts,
    capped,
    severity,
    latest,
    isLoading: results.some((result) => result.isLoading),
    error: results.find((result) => result.error)?.error ?? null,
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
}

/**
 * Lifecycle actions. The server is the source of truth: we write the returned
 * record into the cache rather than guessing the new state locally.
 */
export function useIncidentLifecycle(incidentId: string) {
  const queryClient = useQueryClient();

  const onSuccess = (updated: Awaited<ReturnType<typeof acknowledgeIncident>>) => {
    // The response is the authoritative record: write it into the detail cache
    // and refresh the derived aggregates. Do NOT invalidate the detail query —
    // that would immediately refetch and could resurrect the pre-action state.
    queryClient.setQueryData(incidentKeys.detail(incidentId), updated);
    void queryClient.invalidateQueries({ queryKey: ["incidents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["incidents", "count"] });
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
