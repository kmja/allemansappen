"use client";

import type { ReactNode } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  CircleDashed,
  Flame,
  House,
  Loader2,
  MapPin,
  Scale,
  TreePine,
  Wheat,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  PositionAssessment,
  RuleAssessment,
  RuleId,
  RuleVerdict,
} from "@/lib/types";

type IconType = typeof CheckCircle2;

const VERDICT_META: Record<
  RuleVerdict,
  { Icon: IconType; cls: string; spin?: boolean }
> = {
  clear: { Icon: CheckCircle2, cls: "text-primary" },
  avoid: { Icon: AlertOctagon, cls: "text-destructive" },
  judgment: { Icon: Scale, cls: "text-warning" },
  checking: { Icon: Loader2, cls: "text-muted-foreground", spin: true },
  unknown: { Icon: CircleDashed, cls: "text-muted-foreground" },
};

const RULE_ICON: Record<RuleId, IconType> = {
  reserve: TreePine,
  cultivated: Wheat,
  hemfridszon: House,
  fire: Flame,
};

function Row({ rule }: { rule: RuleAssessment }) {
  const v = VERDICT_META[rule.verdict];
  const RuleIcon = RULE_ICON[rule.id];
  return (
    <div className="flex items-start gap-3 py-3">
      <RuleIcon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{rule.label}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
              v.cls,
            )}
          >
            <v.Icon
              className={cn("size-3.5", v.spin && "animate-spin")}
              aria-hidden
            />
            {rule.headline}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{rule.detail}</p>
      </div>
    </div>
  );
}

/** Body of the "Kan jag tälta här?" sheet (header supplied by the caller). */
export function PositionAssessmentPanel({
  assessment,
}: {
  assessment: PositionAssessment | null;
}) {
  return (
    <div className="px-4 pb-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Appen väger ihop underlagen runt din plats. Den ger ingen dom – grönt
        betyder bara att appen inte hittar något hinder, inte att det garanterat
        är okej att tälta. Du avgör.
      </p>

      {!assessment?.located ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-3 text-xs text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          Tryck på platsknappen för att bedöma din plats.
        </div>
      ) : (
        <div className="divide-y">
          {assessment.rules.map((rule) => (
            <Row key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      <Separator className="my-3" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Tidskänsligt (väder, eldningsförbud) kan ändras snabbt. Vid minsta
        tvekan: fråga markägaren eller välj en annan plats.
      </p>
    </div>
  );
}

function tally(rules: RuleAssessment[]) {
  let clear = 0;
  let judgment = 0;
  let avoid = 0;
  for (const r of rules) {
    if (r.verdict === "clear") clear++;
    else if (r.verdict === "judgment") judgment++;
    else if (r.verdict === "avoid") avoid++;
  }
  return { clear, judgment, avoid };
}

function Count({
  Icon,
  cls,
  n,
}: {
  Icon: IconType;
  cls: string;
  n: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", cls)}>
      <Icon className="size-3.5" aria-hidden />
      {n}
    </span>
  );
}

/**
 * Always-visible chip summarising the position assessment. Doubles as the
 * "are overlays still loading?" indicator. Tapping opens the full checklist.
 */
export function AssessmentSummary({
  assessment,
  onOpen,
}: {
  assessment: PositionAssessment | null;
  onOpen: () => void;
}) {
  const base =
    "pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-xs shadow-md ring-1 ring-border backdrop-blur transition-colors hover:bg-card";

  let content: ReactNode;
  if (!assessment?.located) {
    content = (
      <>
        <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="font-medium">Bedöm din plats</span>
      </>
    );
  } else if (!assessment.positionInView) {
    content = (
      <>
        <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
        <span>Centrera kartan på din plats</span>
      </>
    );
  } else if (assessment.rules.some((r) => r.verdict === "checking")) {
    content = (
      <>
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        <span>Hämtar underlag för din plats…</span>
      </>
    );
  } else {
    const t = tally(assessment.rules);
    content = (
      <>
        <span className="font-medium">Kan jag tälta här?</span>
        <span className="flex items-center gap-2">
          <Count Icon={CheckCircle2} cls="text-primary" n={t.clear} />
          <Count Icon={Scale} cls="text-warning" n={t.judgment} />
          <Count Icon={AlertOctagon} cls="text-destructive" n={t.avoid} />
        </span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={base}
      aria-label="Visa bedömning av din plats"
    >
      {content}
    </button>
  );
}
