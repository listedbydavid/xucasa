import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SearchHistoryResponse, UserHomeResponse } from "@shared/schema";

// ── Search History ───────────────────────────────────────────────────────────

export function useSearchHistory() {
  return useQuery<SearchHistoryResponse[]>({
    queryKey: ["/api/search-history"],
  });
}

export function useAddSearchHistory() {
  return useMutation({
    mutationFn: (data: { query: string; criteria: object }) =>
      apiRequest("POST", "/api/search-history", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/search-history"] }),
  });
}

export function useDeleteSearchHistory() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/search-history/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/search-history"] }),
  });
}

export function useClearSearchHistory() {
  return useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/search-history"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/search-history"] }),
  });
}

// ── My Homes ─────────────────────────────────────────────────────────────────

export function useMyHomes() {
  return useQuery<UserHomeResponse[]>({
    queryKey: ["/api/my-homes"],
  });
}

export function useCreateMyHome() {
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-homes", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/my-homes"] }),
  });
}

export function useDeleteMyHome() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/my-homes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/my-homes"] }),
  });
}

export function useMyHomeIntelligence(id: number | null) {
  return useQuery({
    queryKey: ["/api/my-homes", id, "intelligence"],
    queryFn: () => fetch(`/api/my-homes/${id}/intelligence`).then(r => r.json()),
    enabled: id !== null,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

// ── Agent Invite ─────────────────────────────────────────────────────────────

export function useAgentInvite() {
  return useQuery({
    queryKey: ["/api/agent-invite"],
  });
}

export function useInviteAgent() {
  return useMutation({
    mutationFn: (agentEmail: string) => apiRequest("POST", "/api/agent-invite", { agentEmail }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agent-invite"] }),
  });
}

export function useRemoveAgentInvite() {
  return useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/agent-invite"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agent-invite"] }),
  });
}

export function useAgentClients() {
  return useQuery<any[]>({
    queryKey: ["/api/agent-clients"],
  });
}

export function useClientFavorites(clientId: string | null) {
  return useQuery<any[]>({
    queryKey: ["/api/agent-clients", clientId, "favorites"],
    queryFn: () => fetch(`/api/agent-clients/${clientId}/favorites`).then(r => r.json()),
    enabled: clientId !== null,
  });
}

export function useClientSearches(clientId: string | null) {
  return useQuery<any[]>({
    queryKey: ["/api/agent-clients", clientId, "searches"],
    queryFn: () => fetch(`/api/agent-clients/${clientId}/searches`).then(r => r.json()),
    enabled: clientId !== null,
  });
}

// ── Open Houses ───────────────────────────────────────────────────────────────

export function useOpenHouses() {
  return useQuery<any[]>({
    queryKey: ["/api/open-houses"],
  });
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: { firstName: string; lastName: string }) =>
      apiRequest("PATCH", "/api/auth/user", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
  });
}

// ── Agent Verification ──────────────────────────────────────────────────────

export function useVerifyAgent() {
  return useMutation({
    mutationFn: async (data: { licenseNumber: string; licenseState: string; association: string; brokerageName: string }) => {
      const res = await apiRequest("POST", "/api/agent/verify", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
  });
}

export function useSubmitAgentInfo() {
  return useMutation({
    mutationFn: async (data: { licenseNumber: string; licenseState: string; association: string; brokerageName: string }) => {
      const res = await apiRequest("POST", "/api/agent/submit-info", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
  });
}
