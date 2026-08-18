import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Lock, Key, User, Building2, Phone, Mail, DollarSign, FileText, ChevronDown, ChevronUp, Calendar, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AgentMLSData {
  mlsNumber: string | null;
  confidentialRemarks: string | null;
  showingInstructions: string | null;
  showingContactName: string | null;
  showingContactPhone: string | null;
  lockboxType: string | null;
  accessInstructions: string | null;
  listingAgentName: string | null;
  listingAgentEmail: string | null;
  listingAgentPhone: string | null;
  listingAgentMlsId: string | null;
  listingAgentLicenseNumber: string | null;
  listingBrokerage: string | null;
  listingOfficeMlsId: string | null;
  listingOfficePhone: string | null;
  coListingAgentName: string | null;
  coListingAgentEmail: string | null;
  coListingAgentPhone: string | null;
  buyerAgentCommission: string | null;
  specialConditions: string | null;
  mlsDocuments: Array<{ url: string; name: string; type?: string }> | null;
}

interface AgentMLSPanelProps {
  propertyId: number;
  isAgent: boolean;
}

export function AgentMLSPanel({ propertyId, isAgent }: AgentMLSPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading } = useQuery<AgentMLSData>({
    queryKey: ["/api/properties", propertyId, "agent-mls"],
    enabled: isAgent,
  });

  if (!isAgent) return null;

  if (isLoading) {
    return (
      <div className="mt-10 pt-8 border-t border-border" data-testid="agent-mls-panel-loading">
        <div className="rounded-md overflow-hidden border border-border bg-card">
          <div className="bg-indigo-500/10 dark:bg-indigo-500/20 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasCoListingAgent = !!(data.coListingAgentName || data.coListingAgentEmail || data.coListingAgentPhone);
  const hasDocs = data.mlsDocuments && data.mlsDocuments.length > 0;

  return (
    <div className="mt-10 pt-8 border-t border-border" data-testid="agent-mls-panel">
      <div className="rounded-md overflow-hidden border border-border bg-card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 p-4 bg-indigo-500/10 dark:bg-indigo-500/20 border-b border-indigo-500/20 dark:border-indigo-500/30 text-left"
          data-testid="button-toggle-agent-mls"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <span className="font-display font-bold text-foreground">Agent MLS View</span>
            {data.mlsNumber && (
              <Badge variant="secondary" className="no-default-hover-elevate text-xs" data-testid="badge-mls-number">
                MLS# {data.mlsNumber}
              </Badge>
            )}
            <Badge variant="outline" className="no-default-hover-elevate text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400" data-testid="badge-confidential">
              Confidential
            </Badge>
          </div>
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="p-4 sm:p-6 space-y-5" data-testid="agent-mls-content">
            <div data-testid="section-confidential-remarks">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-sm text-foreground">Confidential Remarks</h3>
              </div>
              <div className="bg-muted rounded-md p-4 text-sm text-muted-foreground" data-testid="text-confidential-remarks">
                {data.confidentialRemarks || "No confidential remarks provided"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-md border border-border p-4" data-testid="section-showing-info">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-semibold text-sm text-foreground">Showing Information</h3>
                </div>
                <div className="space-y-2.5 text-sm">
                  {data.showingInstructions && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Instructions</span>
                      <p className="text-foreground" data-testid="text-showing-instructions">{data.showingInstructions}</p>
                    </div>
                  )}
                  {data.showingContactName && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Contact</span>
                      <p className="text-foreground" data-testid="text-showing-contact">{data.showingContactName}</p>
                    </div>
                  )}
                  {data.showingContactPhone && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Phone</span>
                      <p>
                        <a href={`tel:${data.showingContactPhone.replace(/\D/g, "")}`} className="text-indigo-600 dark:text-indigo-400 hover:underline" data-testid="link-showing-phone">
                          {data.showingContactPhone}
                        </a>
                      </p>
                    </div>
                  )}
                  {data.lockboxType && (
                    <div className="flex items-start gap-2">
                      <Key className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Lockbox</span>
                        <p className="text-foreground" data-testid="text-lockbox-type">{data.lockboxType}</p>
                      </div>
                    </div>
                  )}
                  {data.accessInstructions && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Access</span>
                      <p className="text-foreground" data-testid="text-access-instructions">{data.accessInstructions}</p>
                    </div>
                  )}
                  {!data.showingInstructions && !data.showingContactName && !data.showingContactPhone && !data.lockboxType && !data.accessInstructions && (
                    <p className="text-muted-foreground italic">No showing information available</p>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-md border border-border p-4" data-testid="section-listing-agent">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-semibold text-sm text-foreground">Listing Agent</h3>
                </div>
                <div className="space-y-2.5 text-sm">
                  {data.listingAgentName && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Name</span>
                      <p className="text-foreground font-medium" data-testid="text-listing-agent-name">{data.listingAgentName}</p>
                    </div>
                  )}
                  {data.listingAgentMlsId && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">MLS ID</span>
                      <p className="text-foreground" data-testid="text-listing-agent-mls-id">{data.listingAgentMlsId}</p>
                    </div>
                  )}
                  {data.listingAgentLicenseNumber && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">License #</span>
                      <p className="text-foreground" data-testid="text-listing-agent-license">{data.listingAgentLicenseNumber}</p>
                    </div>
                  )}
                  {data.listingAgentEmail && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Email</span>
                      <p>
                        <a href={`mailto:${data.listingAgentEmail}`} className="text-indigo-600 dark:text-indigo-400 hover:underline" data-testid="link-listing-agent-email">
                          {data.listingAgentEmail}
                        </a>
                      </p>
                    </div>
                  )}
                  {data.listingAgentPhone && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Phone</span>
                      <p>
                        <a href={`tel:${data.listingAgentPhone.replace(/\D/g, "")}`} className="text-indigo-600 dark:text-indigo-400 hover:underline" data-testid="link-listing-agent-phone">
                          {data.listingAgentPhone}
                        </a>
                      </p>
                    </div>
                  )}
                  {data.listingBrokerage && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Brokerage</span>
                        <p className="text-foreground" data-testid="text-listing-brokerage">{data.listingBrokerage}</p>
                      </div>
                    </div>
                  )}
                  {data.listingOfficeMlsId && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Office MLS ID</span>
                      <p className="text-foreground" data-testid="text-office-mls-id">{data.listingOfficeMlsId}</p>
                    </div>
                  )}
                  {data.listingOfficePhone && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Office Phone</span>
                      <p>
                        <a href={`tel:${data.listingOfficePhone.replace(/\D/g, "")}`} className="text-indigo-600 dark:text-indigo-400 hover:underline" data-testid="link-office-phone">
                          {data.listingOfficePhone}
                        </a>
                      </p>
                    </div>
                  )}
                  {!data.listingAgentName && !data.listingAgentEmail && !data.listingBrokerage && (
                    <p className="text-muted-foreground italic">No listing agent information available</p>
                  )}
                </div>
              </div>

              {hasCoListingAgent && (
                <div className="bg-muted/50 rounded-md border border-border p-4" data-testid="section-co-listing-agent">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-sm text-foreground">Co-Listing Agent</h3>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    {data.coListingAgentName && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Name</span>
                        <p className="text-foreground font-medium" data-testid="text-co-listing-agent-name">{data.coListingAgentName}</p>
                      </div>
                    )}
                    {data.coListingAgentEmail && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Email</span>
                        <p>
                          <a href={`mailto:${data.coListingAgentEmail}`} className="text-indigo-600 dark:text-indigo-400 hover:underline" data-testid="link-co-listing-email">
                            {data.coListingAgentEmail}
                          </a>
                        </p>
                      </div>
                    )}
                    {data.coListingAgentPhone && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Phone</span>
                        <p>
                          <a href={`tel:${data.coListingAgentPhone.replace(/\D/g, "")}`} className="text-indigo-600 dark:text-indigo-400 hover:underline" data-testid="link-co-listing-phone">
                            {data.coListingAgentPhone}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-muted/50 rounded-md border border-border p-4" data-testid="section-compensation">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-semibold text-sm text-foreground">Compensation</h3>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Buyer Agent Commission</span>
                    <p className="text-foreground font-medium" data-testid="text-buyer-commission">
                      {data.buyerAgentCommission || "Not specified"}
                    </p>
                  </div>
                  {data.specialConditions && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Special Conditions</span>
                      <p className="text-foreground" data-testid="text-special-conditions">{data.specialConditions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {hasDocs && (
              <div data-testid="section-documents">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-semibold text-sm text-foreground">Documents</h3>
                </div>
                <div className="space-y-2">
                  {data.mlsDocuments!.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-md border border-border hover:bg-muted transition-colors"
                      data-testid={`link-document-${i}`}
                    >
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground font-medium flex-1 truncate">{doc.name || `Document ${i + 1}`}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
