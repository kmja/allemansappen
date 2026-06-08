"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { APP_VERSION, BUILD_TIME, COMMIT_SHA } from "@/lib/version";
import type {
  DataStatus,
  LngLat,
  OverlayId,
  OverpassKind,
  PositionAssessment,
} from "@/lib/types";
import type { ViewState } from "@/components/map/MapView";

const f = (n: number, d = 5) => n.toFixed(d);

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
}

/**
 * Developer overlay: build metadata, live runtime state, and shortcuts. Toggled
 * with the `d` key or the version badge.
 */
export function DebugPanel({
  open,
  onClose,
  online,
  view,
  located,
  statuses,
  enabled,
  assessment,
}: {
  open: boolean;
  onClose: () => void;
  online: boolean;
  view: ViewState | null;
  located: LngLat | null;
  statuses: Record<OverpassKind, DataStatus>;
  enabled: Record<OverlayId, boolean>;
  assessment: PositionAssessment | null;
}) {
  if (!open) return null;

  const overlayKinds: OverpassKind[] = ["buildings", "landuse", "reserves"];

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-30 max-h-[80dvh] w-[min(92vw,340px)] overflow-y-auto rounded-lg bg-card/95 p-3 font-mono text-[11px] leading-relaxed shadow-lg ring-1 ring-border backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Debug</span>
        <button type="button" onClick={onClose} aria-label="Stäng debug">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-0.5">
        <Row k="version" v={`v${APP_VERSION}`} />
        {COMMIT_SHA && <Row k="commit" v={COMMIT_SHA} />}
        {BUILD_TIME && (
          <Row k="build" v={new Date(BUILD_TIME).toLocaleString("sv-SE")} />
        )}
        <Row k="online" v={online ? "yes" : "no"} />
        <Row k="mode" v={assessment?.located ? assessment.origin : "—"} />
        <Row
          k="in view"
          v={assessment ? String(assessment.positionInView) : "—"}
        />
        <Row
          k="located"
          v={located ? `${f(located.lat)}, ${f(located.lng)}` : "—"}
        />
        <Row
          k="assessed"
          v={
            assessment?.point
              ? `${f(assessment.point.lat)}, ${f(assessment.point.lng)}`
              : "—"
          }
        />
        <Row
          k="center/zoom"
          v={
            view
              ? `${f(view.center.lat, 4)}, ${f(view.center.lng, 4)} @ ${view.zoom.toFixed(1)}`
              : "—"
          }
        />
      </div>

      <div className="mt-2 border-t pt-2">
        <div className="mb-1 text-muted-foreground">overlays</div>
        {overlayKinds.map((k) => (
          <Row key={k} k={k} v={`${enabled[k] ? "on" : "off"} · ${statuses[k]}`} />
        ))}
        <Row k="byggnadszon" v={enabled.hemfridszon ? "on" : "off"} />
        <Row k="property" v={enabled.property ? "on" : "off"} />
      </div>

      <div className="mt-2 border-t pt-2">
        <div className="mb-1 text-muted-foreground">rulings</div>
        {assessment?.located ? (
          assessment.rules.map((r) => (
            <Row key={r.id} k={r.id} v={`${r.verdict} · ${r.headline}`} />
          ))
        ) : (
          <Row k="—" v="ingen punkt" />
        )}
      </div>

      <div className="mt-2 border-t pt-2">
        <div className="mb-1 text-muted-foreground">shortcuts</div>
        <Row k="d" v="toggla debug" />
        <Row k="l" v="min plats" />
        <Row k="tryck" v="placera nål" />
        <Row k="håll på nål" v="flytta nålen" />
        <Row k="esc" v="stäng debug" />
      </div>
    </div>
  );
}
