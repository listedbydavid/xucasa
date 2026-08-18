// Confidential MLS field stripping — shared between properties and saved routers.
export const CONFIDENTIAL_MLS_FIELDS = [
  'confidentialRemarks', 'showingInstructions', 'showingContactName', 'showingContactPhone',
  'lockboxType', 'accessInstructions', 'listingAgentMlsId', 'listingAgentLicenseNumber',
  'coListingAgentName', 'coListingAgentEmail', 'coListingAgentPhone',
  'listingOfficeMlsId', 'listingOfficePhone', 'buyerAgentCommission',
  'specialConditions', 'mlsDocuments',
] as const;

export function stripConfidentialFields<T extends Record<string, any>>(prop: T): Omit<T, typeof CONFIDENTIAL_MLS_FIELDS[number]> {
  const result = { ...prop };
  for (const field of CONFIDENTIAL_MLS_FIELDS) {
    delete (result as any)[field];
  }
  return result;
}
