export function agentProfileRoute(agentId: string) {
  return `/agents/${encodeURIComponent(agentId)}` as const;
}

export function agentPropertyRoute(propertyId: string | number) {
  return `/property/${propertyId}` as const;
}

export default { agentProfileRoute, agentPropertyRoute };