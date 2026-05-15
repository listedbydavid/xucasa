import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TOUR_REGISTRY, type TourStep } from "./tour-definitions";

type SpotlightTourProps = {
  pageKey: string;
  isAuthenticated: boolean;
  preview?: boolean;
  onPreviewClose?: () => void;
};

type Rect = { top: number; left: number; width: number; height: number };

type Override = {
  id: number;
  pageKey: string;
  stepIndex: number;
  title: string | null;
  body: string | null;
  targetSelector: string | null;
  placement: string | null;
  isActive: boolean;
};

const SPOTLIGHT_PAD = 8;

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

function mergeSteps(defaults: TourStep[], overrides: Override[]): TourStep[] {
  if (!overrides?.length) return defaults;
  const byIdx = new Map<number, Override>();
  for (const o of overrides) byIdx.set(o.stepIndex, o);
  const maxIdx = Math.max(defaults.length - 1, ...overrides.map(o => o.stepIndex));
  const out: TourStep[] = [];
  for (let i = 0; i <= maxIdx; i++) {
    const d = defaults[i];
    const o = byIdx.get(i);
    if (!d && !o) continue;
    if (!o) { out.push(d); continue; }
    if (o.isActive === false) continue;
    out.push({
      title: o.title ?? d?.title ?? "",
      body: o.body ?? d?.body ?? "",
      target: o.targetSelector ?? d?.target ?? "",
      placement: (o.placement as TourStep["placement"]) ?? d?.placement ?? "bottom",
    });
  }
  return out;
}

export default function SpotlightTour({ pageKey, isAuthenticated, preview, onPreviewClose }: SpotlightTourProps) {
  const queryClient = useQueryClient();
  const definition = TOUR_REGISTRY[pageKey];
  const [visible, setVisible] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const tickRef = useRef<number | null>(null);

  const progressQuery = useQuery<{ progress: any; globalSkip: boolean }>({
    queryKey: ["/api/tours/progress", pageKey],
    queryFn: async () => {
      const res = await fetch(`/api/tours/progress/${encodeURIComponent(pageKey)}`, { credentials: "include" });
      if (!res.ok) return { progress: null, globalSkip: false };
      return res.json();
    },
    enabled: isAuthenticated && !preview && !!definition,
    staleTime: 60_000,
  });

  const overridesQuery = useQuery<Override[]>({
    queryKey: ["/api/tours/overrides", pageKey],
    queryFn: async () => {
      const res = await fetch(`/api/tours/overrides/${encodeURIComponent(pageKey)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!definition,
    staleTime: 60_000,
  });

  const steps = useMemo<TourStep[]>(() => {
    if (!definition) return [];
    return mergeSteps(definition.steps, overridesQuery.data || []);
  }, [definition, overridesQuery.data]);

  const updateProgress = useMutation({
    mutationFn: async (body: { currentStep?: number; completed?: boolean; skipped?: boolean }) => {
      const res = await apiRequest("POST", `/api/tours/progress/${encodeURIComponent(pageKey)}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tours/progress", pageKey] });
    },
  });

  const skipAll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tours/skip-all", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tours/progress", pageKey] });
    },
  });

  useEffect(() => {
    if (preview) {
      setStepIdx(0);
      setVisible(true);
      return;
    }
    if (!isAuthenticated || !definition || progressQuery.isLoading) return;
    const data = progressQuery.data;
    if (!data) return;
    if (data.globalSkip) return;
    const p = data.progress;
    if (p?.completed || p?.skipped) return;
    const resumeStep = typeof p?.currentStep === "number" ? p.currentStep : 0;
    setStepIdx(Math.min(resumeStep, Math.max(0, steps.length - 1)));
    const t = window.setTimeout(() => setVisible(true), 800);
    return () => window.clearTimeout(t);
  }, [preview, isAuthenticated, definition, progressQuery.isLoading, progressQuery.data, steps.length]);

  useEffect(() => {
    if (!visible) {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      setTargetRect(null);
      return;
    }
    const step = steps[stepIdx];
    if (!step) return;
    const tick = () => {
      const el = document.querySelector(step.target);
      if (el) {
        setTargetRect(getRect(el));
      } else {
        setTargetRect(null);
      }
      tickRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    };
  }, [visible, stepIdx, steps]);

  if (!definition || steps.length === 0 || !visible) return null;
  const step = steps[stepIdx];
  if (!step) return null;

  const handleNext = () => {
    if (stepIdx >= steps.length - 1) {
      setVisible(false);
      if (preview) {
        onPreviewClose?.();
        return;
      }
      updateProgress.mutate({ currentStep: stepIdx, completed: true });
      return;
    }
    const next = stepIdx + 1;
    setStepIdx(next);
    if (!preview) updateProgress.mutate({ currentStep: next });
  };
  const handleBack = () => {
    if (stepIdx <= 0) return;
    const prev = stepIdx - 1;
    setStepIdx(prev);
    if (!preview) updateProgress.mutate({ currentStep: prev });
  };
  const handleSkip = () => {
    setVisible(false);
    if (preview) {
      onPreviewClose?.();
      return;
    }
    skipAll.mutate();
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const mobile = isMobile();

  const maskRect = targetRect
    ? {
        x: targetRect.left - SPOTLIGHT_PAD,
        y: targetRect.top - SPOTLIGHT_PAD,
        w: targetRect.width + SPOTLIGHT_PAD * 2,
        h: targetRect.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  const tooltipPos = (() => {
    if (mobile) return { bottom: 0 as number, left: 0, width: vw } as any;
    if (!targetRect) return { top: vh / 2 - 100, left: vw / 2 - 180 };
    const placement = step.placement || "bottom";
    const TIP_W = 360, TIP_H = 200, GAP = 16;
    let top = 0, left = 0;
    if (placement === "bottom") {
      top = targetRect.top + targetRect.height + GAP;
      left = Math.max(16, Math.min(vw - TIP_W - 16, targetRect.left + targetRect.width / 2 - TIP_W / 2));
    } else if (placement === "top") {
      top = Math.max(16, targetRect.top - TIP_H - GAP);
      left = Math.max(16, Math.min(vw - TIP_W - 16, targetRect.left + targetRect.width / 2 - TIP_W / 2));
    } else if (placement === "right") {
      top = Math.max(16, Math.min(vh - TIP_H - 16, targetRect.top + targetRect.height / 2 - TIP_H / 2));
      left = targetRect.left + targetRect.width + GAP;
      if (left + TIP_W > vw - 16) left = Math.max(16, targetRect.left - TIP_W - GAP);
    } else {
      top = Math.max(16, Math.min(vh - TIP_H - 16, targetRect.top + targetRect.height / 2 - TIP_H / 2));
      left = Math.max(16, targetRect.left - TIP_W - GAP);
      if (left < 16) left = targetRect.left + targetRect.width + GAP;
    }
    return { top, left, width: TIP_W };
  })();

  const progressPct = ((stepIdx + 1) / steps.length) * 100;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "auto" }}
      data-testid="spotlight-tour"
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
      >
        <defs>
          <mask id={`xucasa-tour-mask-${pageKey}`}>
            <rect width="100%" height="100%" fill="white" />
            {maskRect && (
              <rect
                x={maskRect.x}
                y={maskRect.y}
                width={maskRect.w}
                height={maskRect.h}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask={`url(#xucasa-tour-mask-${pageKey})`}
        />
        {maskRect && (
          <rect
            x={maskRect.x}
            y={maskRect.y}
            width={maskRect.w}
            height={maskRect.h}
            rx={8}
            ry={8}
            fill="none"
            stroke="rgb(245 158 11)"
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
        )}
      </svg>

      {mobile ? (
        <div
          className="fixed bottom-0 left-0 right-0 bg-background rounded-t-xl shadow-2xl border-t border-border p-5 pb-6"
          style={{ zIndex: 9999 }}
          data-testid="spotlight-tour-tooltip"
        >
          <TooltipBody
            step={step}
            stepIdx={stepIdx}
            total={steps.length}
            progressPct={progressPct}
            onBack={handleBack}
            onSkip={handleSkip}
            onNext={handleNext}
          />
        </div>
      ) : (
        <Card
          className="absolute shadow-2xl p-4"
          style={{ ...(tooltipPos as any), zIndex: 9999, position: "fixed" }}
          data-testid="spotlight-tour-tooltip"
        >
          <TooltipBody
            step={step}
            stepIdx={stepIdx}
            total={steps.length}
            progressPct={progressPct}
            onBack={handleBack}
            onSkip={handleSkip}
            onNext={handleNext}
          />
        </Card>
      )}
    </div>
  );
}

function TooltipBody({
  step,
  stepIdx,
  total,
  progressPct,
  onBack,
  onSkip,
  onNext,
}: {
  step: TourStep;
  stepIdx: number;
  total: number;
  progressPct: number;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  const isLast = stepIdx >= total - 1;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-medium leading-tight" data-testid="tour-step-title">{step.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5" data-testid="tour-step-body">{step.body}</p>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground" data-testid="tour-step-progress">Step {stepIdx + 1} of {total}</div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={stepIdx === 0}
          data-testid="button-tour-back"
        >
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="text-muted-foreground"
          data-testid="button-tour-skip"
        >
          Skip
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          className="bg-amber-500 hover:bg-amber-600 text-white"
          data-testid="button-tour-next"
        >
          {isLast ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}
