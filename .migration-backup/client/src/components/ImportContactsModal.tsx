import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Smartphone,
  Upload,
  Users,
  Check,
  AlertCircle,
  Loader2,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface RawContact {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = "choose" | "preview" | "importing" | "done";
type ImportSource = "phone" | "vcard" | "csv";

const supportsContactPicker =
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  typeof window !== "undefined" &&
  "ContactsManager" in window;

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] || "Unknown",
    lastName: parts.slice(1).join(" ") || null,
  };
}

export function ImportContactsModal({ isOpen, onClose }: ImportContactsModalProps) {
  const queryClient = useQueryClient();
  const vcfInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("choose");
  const [source, setSource] = useState<ImportSource>("phone");
  const [contacts, setContacts] = useState<RawContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<{ imported: number; skipped: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  const reset = () => {
    setStep("choose");
    setContacts([]);
    setSelected(new Set());
    setResult(null);
    setError(null);
    setShowHowTo(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePhonePicker = async (mode: "one" | "all") => {
    setError(null);
    try {
      const props = ["name", "email", "tel"];
      const opts = { multiple: mode === "all" };
      // @ts-ignore — Contact Picker API not in TS lib yet
      const results = await navigator.contacts.select(props, opts);
      if (!results || results.length === 0) return;
      const parsed: RawContact[] = results
        .map((c: any) => ({
          name: c.name?.[0] ?? "",
          email: c.email?.[0] ?? undefined,
          phone: c.tel?.[0] ?? undefined,
        }))
        .filter((c: RawContact) => c.name.length > 0);
      if (parsed.length === 0) {
        setError("No valid contacts found. Make sure the contacts have a name.");
        return;
      }
      setContacts(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
      setSource("phone");
      setStep("preview");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError("Could not access contacts. Please try the file upload option instead.");
      }
    }
  };

  const handleVcfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const count = (text.match(/BEGIN:VCARD/gi) ?? []).length;
    if (count === 0) {
      setError("This does not appear to be a valid vCard (.vcf) file.");
      return;
    }
    try {
      const response = await fetch("/api/agent/contacts/preview-vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vcard: text }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Could not parse the file.");
        return;
      }
      setContacts(data.contacts);
      setSelected(new Set(data.contacts.map((_: unknown, i: number) => i)));
      setSource("vcard");
      setStep("preview");
    } catch {
      setError("Failed to read file. Please try again.");
    }
    e.target.value = "";
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      setError("The CSV file appears to be empty or has no data rows.");
      return;
    }
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes("name"));
    const firstIdx = headers.findIndex(h => h.includes("first"));
    const lastIdx = headers.findIndex(h => h.includes("last"));
    const emailIdx = headers.findIndex(h => h.includes("email"));
    const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
    const companyIdx = headers.findIndex(h => h.includes("company") || h.includes("organization") || h.includes("employer"));

    if (nameIdx === -1 && firstIdx === -1) {
      setError('CSV must have a "name" (or "first name") column. Please check your file headers.');
      return;
    }

    const parsed: RawContact[] = lines.slice(1).map(line => {
      const cols = line.split(",").map(c => c.replace(/"/g, "").trim());
      let name = "";
      if (nameIdx >= 0) name = cols[nameIdx] ?? "";
      else {
        const fn = firstIdx >= 0 ? cols[firstIdx] ?? "" : "";
        const ln = lastIdx >= 0 ? cols[lastIdx] ?? "" : "";
        name = [fn, ln].filter(Boolean).join(" ").trim();
      }
      return {
        name,
        email: emailIdx >= 0 ? cols[emailIdx] : undefined,
        phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
        company: companyIdx >= 0 ? cols[companyIdx] : undefined,
      };
    }).filter(c => c.name.length > 0);

    if (parsed.length === 0) {
      setError("No valid contacts found in the CSV. Check that the name column has data.");
      return;
    }

    setContacts(parsed);
    setSelected(new Set(parsed.map((_, i) => i)));
    setSource("csv");
    setStep("preview");
    e.target.value = "";
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedContacts = contacts.filter((_, i) => selected.has(i));
      if (source === "csv") {
        const csvPayload = selectedContacts.map(c => {
          const { firstName, lastName } = splitName(c.name);
          return {
            firstName,
            lastName,
            email: c.email || null,
            phone: c.phone || null,
            notes: c.company ? `Company: ${c.company}` : null,
          };
        });
        const response = await fetch("/api/agent/contacts/import-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: csvPayload }),
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Import failed");
        return {
          imported: data.imported ?? selectedContacts.length,
          skipped: 0,
          message: `${data.imported ?? selectedContacts.length} contact${(data.imported ?? selectedContacts.length) !== 1 ? "s" : ""} imported.`,
        };
      } else {
        const response = await fetch("/api/agent/contacts/import-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: selectedContacts, skipDuplicates }),
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Import failed");
        return data;
      }
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
    },
    onError: (err: any) => {
      setError(err?.message || "Import failed. Please try again.");
      setStep("preview");
    },
  });

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((_, i) => i))
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" data-testid="modal-import-contacts">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            {step === "choose" && "Add contacts from your phone, a vCard file, or a CSV."}
            {step === "preview" && `Review ${contacts.length} contact${contacts.length !== 1 ? "s" : ""} before importing.`}
            {step === "importing" && "Importing your contacts..."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300" data-testid="error-import">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "choose" && (
          <div className="flex flex-col gap-3 py-2">
            {supportsContactPicker ? (
              <>
                <button
                  onClick={() => handlePhonePicker("one")}
                  className="flex items-center gap-4 p-4 border rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
                  data-testid="button-pick-one-phone"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Pick one contact</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Choose a single contact from your phone</div>
                  </div>
                </button>
                <button
                  onClick={() => handlePhonePicker("all")}
                  className="flex items-center gap-4 p-4 border rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
                  data-testid="button-pick-many-phone"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">Select multiple contacts</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Choose as many contacts as you want from your phone</div>
                  </div>
                </button>
                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or upload a file</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            ) : (
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                Phone contact picker is available on mobile browsers. Use a file upload below on desktop.
              </div>
            )}

            <button
              onClick={() => vcfInputRef.current?.click()}
              className="flex items-center gap-4 p-4 border rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
              data-testid="button-upload-vcard"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <div className="font-medium text-sm">Upload a vCard file (.vcf)</div>
                <div className="text-xs text-muted-foreground mt-0.5">Export from iPhone Contacts, Google Contacts, or Outlook</div>
              </div>
            </button>
            <input ref={vcfInputRef} type="file" accept=".vcf,text/vcard" className="hidden" onChange={handleVcfFile} data-testid="input-file-vcard" />

            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-4 p-4 border rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors text-left"
              data-testid="button-upload-csv"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <div className="font-medium text-sm">Upload a CSV file</div>
                <div className="text-xs text-muted-foreground mt-0.5">Works with exports from most CRMs and spreadsheets</div>
              </div>
            </button>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} data-testid="input-file-csv" />

            <button
              onClick={() => setShowHowTo(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto mt-1"
              data-testid="button-toggle-howto"
            >
              {showHowTo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              How do I export my contacts?
            </button>
            {showHowTo && (
              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 space-y-2">
                <p><strong>iPhone:</strong> Contacts app → tap a contact → Share Contact → save as .vcf. For all contacts: iCloud.com → Contacts → select all → Export vCard.</p>
                <p><strong>Google Contacts:</strong> contacts.google.com → select contacts → Export → vCard (.vcf).</p>
                <p><strong>Outlook:</strong> File → Open &amp; Export → Import/Export → Export to a file → vCard or CSV.</p>
                <p><strong>Other CRM:</strong> Look for an "Export" option and choose CSV with columns: Name, Email, Phone.</p>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <button onClick={toggleAll} className="text-xs text-amber-600 hover:underline" data-testid="button-toggle-all">
                {selected.size === contacts.length ? "Deselect all" : "Select all"}
              </button>
              <span className="text-xs text-muted-foreground" data-testid="text-selected-count">
                {selected.size} of {contacts.length} selected
              </span>
            </div>

            {source !== "csv" && (
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="skip-dupes"
                  checked={skipDuplicates}
                  onCheckedChange={v => setSkipDuplicates(!!v)}
                  data-testid="checkbox-skip-duplicates"
                />
                <label htmlFor="skip-dupes" className="text-sm cursor-pointer">
                  Skip contacts that already exist in my CRM
                </label>
              </div>
            )}

            <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0 max-h-64">
              {contacts.map((contact, i) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${selected.has(i) ? "" : "opacity-40"}`}
                  data-testid={`row-preview-contact-${i}`}
                >
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => toggleSelect(i)}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{contact.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[contact.email, contact.phone, contact.company].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={reset} className="flex-1" data-testid="button-back">Back</Button>
              <Button
                onClick={() => { setStep("importing"); importMutation.mutate(); }}
                disabled={selected.size === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="button-confirm-import"
              >
                Import {selected.size} contact{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">Importing {selected.size} contacts...</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-4 py-6 text-center" data-testid="step-done">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-medium" data-testid="text-import-result">{result.message}</p>
              {result.skipped > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Skipped contacts already exist in your CRM
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-done">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
