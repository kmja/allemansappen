"use client";

import {
  AlertOctagon,
  CheckCircle2,
  CircleDashed,
  Flame,
  House,
  Loader2,
  LocateFixed,
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
  onUseMyLocation,
}: {
  assessment: PositionAssessment | null;
  onUseMyLocation?: () => void;
}) {
  const picked = assessment?.located && assessment.origin === "picked";
  return (
    <div className="px-4 pb-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Appen väger ihop underlagen runt en plats. Den ger ingen dom – grönt
        betyder bara att appen inte hittar något hinder, inte att det garanterat
        är okej att tälta. Du avgör. Tryck och håll på kartan för att bedöma en
        annan punkt.
      </p>

      {!assessment?.located ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-3 text-xs text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          Tryck på platsknappen – eller tryck och håll på kartan – för att
          bedöma en plats.
        </div>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              {picked ? (
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
              ) : (
                <LocateFixed
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
              )}
              {picked ? "Vald punkt på kartan" : "Din plats"}
            </span>
            {picked && onUseMyLocation && (
              <button
                type="button"
                onClick={onUseMyLocation}
                className="text-xs font-medium text-primary hover:underline"
              >
                Använd min plats
              </button>
            )}
          </div>
          <div className="divide-y">
            {assessment.rules.map((rule) => (
              <Row key={rule.id} rule={rule} />
            ))}
          </div>
        </>
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

function CompactRow({ rule }: { rule: RuleAssessment }) {
  const v = VERDICT_META[rule.verdict];
  const RuleIcon = RULE_ICON[rule.id];
  return (
    <div className="flex items-center gap-2">
      <RuleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate text-xs font-medium">{rule.label}</span>
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
  );
}

/** Bold at-a-glance verdict line — "whether you're in the clear". */
function VerdictHeadline({ assessment }: { assessment: PositionAssessment }) {
  let Icon: IconType = Scale;
  let cls = "text-warning";
  let text = "Inga tydliga hinder – du avgör";
  let spin = false;
  if (!assessment.positionInView) {
    Icon = MapPin;
    cls = "text-muted-foreground";
    text =
      assessment.origin === "picked"
        ? "Punkten är utanför kartvyn"
        : "Centrera kartan på din plats";
  } else if (assessment.rules.some((r) => r.verdict === "checking")) {
    Icon = Loader2;
    cls = "text-muted-foreground";
    text = "Hämtar underlag…";
    spin = true;
  } else if (tally(assessment.rules).avoid > 0) {
    Icon = AlertOctagon;
    cls = "text-destructive";
    text = "Något att undvika här";
  }
  return (
    <div className={cn("flex items-center gap-2 text-sm font-semibold", cls)}>
      <Icon
        className={cn("size-4 shrink-0", spin && "animate-spin")}
        aria-hidden
      />
      {text}
    </div>
  );
}

/**
 * Prominent, always-visible assessment card. Surfaces the at-a-glance verdict
 * plus every rule's status for the selected/detected point, so the user never
 * has to open anything to see whether they're in the clear.
 */
export function AssessmentCard({
  assessment,
  onOpenDetails,
  onUseMyLocation,
}: {
  assessment: PositionAssessment | null;
  onOpenDetails: () => void;
  onUseMyLocation?: () => void;
}) {
  const card =
    "pointer-events-auto w-full max-w-md rounded-xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur";

  if (!assessment?.located) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          Tryck på platsknappen – eller tryck och håll på kartan – för att bedöma
          en plats.
        </div>
      </div>
    );
  }

  const picked = assessment.origin === "picked";
  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-2">
        <VerdictHeadline assessment={assessment} />
        <button
          type="button"
          onClick={onOpenDetails}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Detaljer
        </button>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {picked ? (
          <MapPin className="size-3 shrink-0" aria-hidden />
        ) : (
          <LocateFixed className="size-3 shrink-0" aria-hidden />
        )}
        <span>{picked ? "Vald punkt på kartan" : "Din plats"}</span>
        {picked && onUseMyLocation && (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={onUseMyLocation}
              className="font-medium text-primary hover:underline"
            >
              Använd min plats
            </button>
          </>
        )}
      </div>

      <div className="mt-2 grid gap-2">
        {assessment.rules.map((rule) => (
          <CompactRow key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  );
}
