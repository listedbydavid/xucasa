import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { X, Sparkles, ChevronDown, ChevronUp, Plus, Loader2 } from "lucide-react";

interface CompletenessResponse {
  score: number;
  missingFields: string[];
  profile: any | null;
  noProfile?: boolean;
}

const HOME_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Mobile", "Land"];
const MUST_HAVE_SUGGESTIONS = ["pool", "garage", "ocean view", "single story", "large lot", "updated kitchen", "solar", "ADU", "no HOA", "good schools"];
const TIMELINE_OPTIONS = ["ASAP", "1-3 months", "3-6 months", "6-12 months", "12+ months", "Just looking"];

const DISMISS_KEY = "buyer_profile_nudge_dismissed";

export function BuyerProfileNudge() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [preferredCities, setPreferredCities] = useState<string[]>([]);
  const [homeTypes, setHomeTypes] = useState<string[]>([]);
  const [minBeds, setMinBeds] = useState<string>("");
  const [maxBeds, setMaxBeds] = useState<string>("");
  const [minBaths, setMinBaths] = useState<string>("");
  const [minSqft, setMinSqft] = useState<string>("");
  const [maxSqft, setMaxSqft] = useState<string>("");
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [moveInTimeline, setMoveInTimeline] = useState<string>("");
  const [cityInput, setCityInput] = useState("");
  const [mustHaveInput, setMustHaveInput] = useState("");

  const isBuyer = (user as any)?.primaryIntent === "buyer" || (user as any)?.currentMode === "buyer";

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {}
  }, []);

  const { data, isLoading, refetch } = useQuery<CompletenessResponse>({
    queryKey: ["/api/buyer-profile/completeness"],
    enabled: isAuthenticated && isBuyer,
  });

  // Hydrate form from existing profile when expanded
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (expanded && data?.profile && !hydratedRef.current) {
      const p = data.profile;
      setPreferredCities(p.preferredCities || []);
      setHomeTypes(p.homeTypes || []);
      setMinBeds(p.minBeds != null ? String(p.minBeds) : "");
      setMaxBeds(p.maxBeds != null ? String(p.maxBeds) : "");
      setMinBaths(p.minBaths != null ? String(p.minBaths) : "");
      setMinSqft(p.minSqft != null ? String(p.minSqft) : "");
      setMaxSqft(p.maxSqft != null ? String(p.maxSqft) : "");
      setMustHaves(p.mustHaves || []);
      setMoveInTimeline(p.moveInTimeline || "");
      hydratedRef.current = true;
    }
  }, [expanded, data]);

  if (!isAuthenticated || !isBuyer) return null;
  if (isLoading || !data) return null;
  if (data.noProfile) return null;
  if (data.score >= 100) return null;
  if (dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const addCity = () => {
    const v = cityInput.trim();
    if (v && !preferredCities.includes(v)) setPreferredCities([...preferredCities, v]);
    setCityInput("");
  };
  const addMustHave = (v?: string) => {
    const val = (v ?? mustHaveInput).trim().toLowerCase();
    if (val && !mustHaves.includes(val)) setMustHaves([...mustHaves, val]);
    if (!v) setMustHaveInput("");
  };
  const toggleHomeType = (t: string) => {
    setHomeTypes(homeTypes.includes(t) ? homeTypes.filter(x => x !== t) : [...homeTypes, t]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        preferredCities: preferredCities.length ? preferredCities : null,
        homeTypes: homeTypes.length ? homeTypes : null,
        mustHaves: mustHaves.length ? mustHaves : null,
        minBeds: minBeds ? parseInt(minBeds) : null,
        maxBeds: maxBeds ? parseInt(maxBeds) : null,
        minBaths: minBaths ? parseFloat(minBaths) : null,
        minSqft: minSqft ? parseInt(minSqft) : null,
        maxSqft: maxSqft ? parseInt(maxSqft) : null,
        moveInTimeline: moveInTimeline || null,
      };
      const res: any = await apiRequest("PATCH", "/api/buyer-profile", payload);
      const json = await res.json();
      toast({
        title: "Profile updated",
        description: `Your buyer profile is now ${json.score}% complete.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/buyer-profile/completeness"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/buyer-profiles/mine"] });
      await refetch();
      setExpanded(false);
      hydratedRef.current = false;
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const score = data.score;
  // Color: amber → green as score increases
  const barColor = score >= 75 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-amber-400";

  return (
    <div
      className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 mb-4 shadow-sm"
      data-testid="banner-profile-nudge"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100" data-testid="text-nudge-headline">
                Your buyer profile is {score}% complete.
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/70 mt-0.5">
                Finish it to get better matches and let agents know what you're looking for.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-md transition-colors flex-shrink-0"
              aria-label="Dismiss"
              data-testid="button-nudge-dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 h-2 bg-amber-100 dark:bg-amber-900/40 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-500 rounded-full`}
              style={{ width: `${score}%` }}
              data-testid="progress-nudge"
            />
          </div>

          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-amber-900 dark:text-amber-100 hover:underline"
            data-testid="button-nudge-expand"
          >
            {expanded ? "Hide form" : "Complete my profile"}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="mt-4 space-y-5 bg-card border border-border rounded-xl p-4">
              {/* Preferred cities */}
              <Section label="Preferred cities" weight="20 pts">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {preferredCities.map((c, i) => (
                    <Tag key={i} label={c} onRemove={() => setPreferredCities(preferredCities.filter((_, j) => j !== i))} testId={`tag-city-${i}`} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cityInput}
                    onChange={e => setCityInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }}
                    placeholder="Type a city, press Enter"
                    className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    data-testid="input-city"
                  />
                  <button onClick={addCity} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium" data-testid="button-add-city">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </Section>

              {/* Home types */}
              <Section label="Home types" weight="15 pts">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {HOME_TYPE_OPTIONS.map(t => (
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={homeTypes.includes(t)}
                        onChange={() => toggleHomeType(t)}
                        data-testid={`checkbox-hometype-${t.replace(/\s+/g, "-").toLowerCase()}`}
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </Section>

              {/* Bedrooms */}
              <Section label="Bedrooms" weight="15 pts">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Min" value={minBeds} onChange={setMinBeds} testId="input-min-beds" />
                  <NumberField label="Max" value={maxBeds} onChange={setMaxBeds} testId="input-max-beds" />
                </div>
              </Section>

              {/* Bathrooms */}
              <Section label="Bathrooms" weight="10 pts">
                <NumberField label="Min" value={minBaths} onChange={setMinBaths} step="0.5" testId="input-min-baths" />
              </Section>

              {/* Size */}
              <Section label="Size (sqft)" weight="10 pts">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Min" value={minSqft} onChange={setMinSqft} testId="input-min-sqft" />
                  <NumberField label="Max" value={maxSqft} onChange={setMaxSqft} testId="input-max-sqft" />
                </div>
              </Section>

              {/* Must haves */}
              <Section label="Must-haves" weight="20 pts">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {mustHaves.map((m, i) => (
                    <Tag key={i} label={m} onRemove={() => setMustHaves(mustHaves.filter((_, j) => j !== i))} testId={`tag-musthave-${i}`} />
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={mustHaveInput}
                    onChange={e => setMustHaveInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMustHave(); } }}
                    placeholder="Type a feature, press Enter"
                    className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    data-testid="input-musthave"
                  />
                  <button onClick={() => addMustHave()} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium" data-testid="button-add-musthave">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MUST_HAVE_SUGGESTIONS.filter(s => !mustHaves.includes(s)).map(s => (
                    <button
                      key={s}
                      onClick={() => addMustHave(s)}
                      className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full hover:bg-muted/70"
                      data-testid={`suggest-musthave-${s.replace(/\s+/g, "-")}`}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Move-in timeline */}
              <Section label="Move-in timeline" weight="10 pts">
                <select
                  value={moveInTimeline}
                  onChange={e => setMoveInTimeline(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="select-timeline"
                >
                  <option value="">Select…</option>
                  {TIMELINE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Section>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => { setExpanded(false); hydratedRef.current = false; }}
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-md"
                  data-testid="button-nudge-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md disabled:opacity-60"
                  data-testid="button-nudge-save"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, weight, children }: { label: string; weight: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        <span className="text-xs text-muted-foreground">{weight}</span>
      </div>
      {children}
    </div>
  );
}

function Tag({ label, onRemove, testId }: { label: string; onRemove: () => void; testId?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium" data-testid={testId}>
      {label}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full p-0.5" aria-label={`Remove ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function NumberField({ label, value, onChange, step, testId }: { label: string; value: string; onChange: (v: string) => void; step?: string; testId?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type="number"
        step={step || "1"}
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid={testId}
      />
    </div>
  );
}
