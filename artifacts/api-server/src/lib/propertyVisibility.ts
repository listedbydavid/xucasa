type PropertyVisibilityShape = {
  status?: string | null;
  listingStatus?: string | null;
  agentId?: string | null;
};

export function isDraftProperty(property: PropertyVisibilityShape | null | undefined): boolean {
  return (property?.listingStatus || property?.status || "").toLowerCase() === "draft";
}

export function canViewProperty(
  property: PropertyVisibilityShape | null | undefined,
  viewerUserId?: string | null,
): boolean {
  if (!property) return false;
  return !isDraftProperty(property) || (!!viewerUserId && property.agentId === viewerUserId);
}