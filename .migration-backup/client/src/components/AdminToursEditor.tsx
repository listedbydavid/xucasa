import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Plus, RotateCcw, Eye, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TOUR_REGISTRY, type TourStep } from "@/components/tours/tour-definitions";
import SpotlightTour from "@/components/tours/SpotlightTour";

type Override = {
  id: number;
  pageKey: string;
  stepIndex: number;
  title: string | null;
  body: string | null;
  targetSelector: string | null;
  placement: string | null;
  sortOrder: number;
  isActive: boolean;
};

type EditableStep = {
  stepIndex: number;
  title: string;
  body: string;
  targetSelector: string;
  placement: string;
  isActive: boolean;
  overrideId?: number;
};

const PAGE_KEYS = Object.keys(TOUR_REGISTRY);

function defaultsForPage(pageKey: string): EditableStep[] {
  const def = TOUR_REGISTRY[pageKey];
  if (!def) return [];
  return def.steps.map((s: TourStep, i) => ({
    stepIndex: i,
    title: s.title,
    body: s.body,
    targetSelector: s.target,
    placement: s.placement || "bottom",
    isActive: true,
  }));
}

function mergeWithOverrides(pageKey: string, overrides: Override[]): EditableStep[] {
  const defaults = defaultsForPage(pageKey);
  const byIdx = new Map<number, Override>();
  for (const o of overrides) byIdx.set(o.stepIndex, o);
  const maxIdx = Math.max(defaults.length - 1, ...overrides.map(o => o.stepIndex));
  const out: EditableStep[] = [];
  for (let i = 0; i <= maxIdx; i++) {
    const d = defaults[i];
    const o = byIdx.get(i);
    if (!d && !o) continue;
    if (o) {
      out.push({
        stepIndex: i,
        title: o.title ?? d?.title ?? "",
        body: o.body ?? d?.body ?? "",
        targetSelector: o.targetSelector ?? d?.targetSelector ?? "",
        placement: o.placement ?? d?.placement ?? "bottom",
        isActive: o.isActive,
        overrideId: o.id,
      });
    } else if (d) {
      out.push(d);
    }
  }
  return out;
}

export default function AdminToursEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePage, setActivePage] = useState<string>(PAGE_KEYS[0]);
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);

  const overridesQuery = useQuery<Override[]>({
    queryKey: ["/api/tours/overrides"],
    queryFn: async () => {
      const res = await fetch("/api/tours/overrides", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const overridesForPage = useMemo(
    () => (overridesQuery.data || []).filter(o => o.pageKey === activePage),
    [overridesQuery.data, activePage]
  );

  useEffect(() => {
    setSteps(mergeWithOverrides(activePage, overridesForPage));
  }, [activePage, overridesForPage]);

  const saveStep = useMutation({
    mutationFn: async (s: EditableStep) => {
      const res = await apiRequest("POST", "/api/tours/overrides", {
        pageKey: activePage,
        stepIndex: s.stepIndex,
        title: s.title,
        body: s.body,
        targetSelector: s.targetSelector,
        placement: s.placement,
        sortOrder: s.stepIndex,
        isActive: s.isActive,
      });
      return res.json();
    },
  });

  const deleteOverride = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/tours/overrides/${id}`, {});
      return res.json();
    },
  });

  const handleSave = async () => {
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = { ...steps[i], stepIndex: i };
        await saveStep.mutateAsync(s);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/tours/overrides"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/tours/overrides", activePage] });
      toast({ title: "Tour saved", description: `Updated ${steps.length} step(s) for ${activePage}` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm(`Reset all overrides for ${activePage} to defaults? This cannot be undone.`)) return;
    try {
      for (const o of overridesForPage) {
        await deleteOverride.mutateAsync(o.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/tours/overrides"] });
      toast({ title: "Reset complete", description: `Overrides cleared for ${activePage}` });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err?.message || "Unknown error", variant: "destructive" });
    }
  };

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...steps];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setSteps(next.map((s, idx) => ({ ...s, stepIndex: idx })));
    setDragIdx(null);
  };

  const addStep = () => {
    setSteps([
      ...steps,
      {
        stepIndex: steps.length,
        title: "New step",
        body: "Step description",
        targetSelector: "",
        placement: "bottom",
        isActive: true,
      },
    ]);
  };

  const updateField = (i: number, field: keyof EditableStep, value: any) => {
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };

  const removeStep = (i: number) => {
    const next = steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stepIndex: idx }));
    setSteps(next);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6" data-testid="admin-tours-editor">
      <aside className="space-y-1">
        <h3 className="text-sm font-semibold mb-3">Pages</h3>
        {PAGE_KEYS.map(pk => (
          <button
            key={pk}
            onClick={() => setActivePage(pk)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm ${activePage === pk ? "bg-amber-500 text-white" : "hover:bg-muted"}`}
            data-testid={`admin-tour-page-${pk}`}
          >
            {pk}
          </button>
        ))}
      </aside>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Steps for "{activePage}"</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreview(true)} data-testid="button-tour-preview">
              <Eye className="w-4 h-4 mr-1" /> Preview
            </Button>
            <Button size="sm" variant="outline" onClick={handleResetDefaults} data-testid="button-tour-reset">
              <RotateCcw className="w-4 h-4 mr-1" /> Reset defaults
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-tour-save">
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((s, i) => (
            <Card
              key={i}
              className="p-4"
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(i)}
              data-testid={`admin-tour-step-${i}`}
            >
              <div className="flex items-start gap-3">
                <div className="cursor-grab text-muted-foreground pt-2">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                    <Input
                      value={s.title}
                      onChange={(e) => updateField(i, "title", e.target.value)}
                      placeholder="Title"
                      data-testid={`input-step-title-${i}`}
                    />
                    <Select value={s.placement} onValueChange={(v) => updateField(i, "placement", v)}>
                      <SelectTrigger className="w-32" data-testid={`select-step-placement-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={s.body}
                    onChange={(e) => updateField(i, "body", e.target.value)}
                    placeholder="Body"
                    rows={2}
                    data-testid={`input-step-body-${i}`}
                  />
                  <Input
                    value={s.targetSelector}
                    onChange={(e) => updateField(i, "targetSelector", e.target.value)}
                    placeholder='Target selector (e.g. [data-tour="swipe-card"])'
                    className="font-mono text-xs"
                    data-testid={`input-step-target-${i}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(i)}
                  data-testid={`button-remove-step-${i}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Button variant="outline" onClick={addStep} className="w-full" data-testid="button-add-step">
          <Plus className="w-4 h-4 mr-1" /> Add step
        </Button>
      </div>
      {preview && (
        <SpotlightTour pageKey={activePage} isAuthenticated={true} preview onPreviewClose={() => setPreview(false)} />
      )}
    </div>
  );
}
