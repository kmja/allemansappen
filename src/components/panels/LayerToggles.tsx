"use client";

import { CheckCircle2, CircleAlert, CircleDashed, Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AMENITY_META, OVERLAYS, type OverlayConfig } from "@/lib/map/layers";
import type { DataStatus, OverlayId, OverpassKind } from "@/lib/types";

function hintFor(
  overlay: OverlayConfig,
  enabled: boolean,
  statuses: Record<OverpassKind, DataStatus>,
  propertyConfigured: boolean,
): string | null {
  if (overlay.source === "lantmateriet" && !propertyConfigured) {
    return "Kräver konfigurerad Lantmäteriet-åtkomst (se README).";
  }
  if (!enabled) return null;
  if (overlay.id === "hemfridszon") {
    return "Beräknas från byggnadslagret – endast vägledande, ingen juridisk gräns.";
  }
  if (overlay.source === "overpass" && overlay.overpassKind) {
    switch (statuses[overlay.overpassKind]) {
      case "loading":
        return "Hämtar data…";
      case "error":
        return "Kunde inte hämta (offline?).";
      case "zoom":
        return "Zooma in för att ladda.";
      case "empty":
        return "Inget hittat i kartvyn.";
      default:
        return null;
    }
  }
  return null;
}

function StatusIcon({ status }: { status: DataStatus }) {
  switch (status) {
    case "loading":
      return (
        <Loader2
          className="size-3.5 animate-spin text-muted-foreground"
          aria-label="Hämtar"
        />
      );
    case "ready":
      return (
        <CheckCircle2 className="size-3.5 text-primary" aria-label="Laddat" />
      );
    case "error":
      return (
        <CircleAlert className="size-3.5 text-destructive" aria-label="Fel" />
      );
    case "empty":
      return (
        <CircleDashed
          className="size-3.5 text-muted-foreground"
          aria-label="Inget hittat"
        />
      );
    default:
      return null;
  }
}

export function LayerToggles({
  enabled,
  onToggle,
  statuses,
  propertyConfigured,
}: {
  enabled: Record<OverlayId, boolean>;
  onToggle: (id: OverlayId) => void;
  statuses: Record<OverpassKind, DataStatus>;
  propertyConfigured: boolean;
}) {
  return (
    <div className="px-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Lager hämtas från OpenStreetMap när du är online. Allt är underlag för
        din egen bedömning – inga gränser är facit.
      </p>
      <div className="divide-y">
        {OVERLAYS.map((overlay) => {
          const disabled =
            overlay.source === "lantmateriet" && !propertyConfigured;
          const isOn = enabled[overlay.id] && !disabled;
          const hint = hintFor(
            overlay,
            enabled[overlay.id],
            statuses,
            propertyConfigured,
          );
          return (
            <div key={overlay.id} className="flex items-start gap-3 py-3">
              <span
                aria-hidden
                className="mt-1 size-3 shrink-0 rounded-sm border"
                style={{ backgroundColor: overlay.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{overlay.label}</span>
                  <div className="flex items-center gap-2">
                    {isOn &&
                      overlay.source === "overpass" &&
                      overlay.overpassKind && (
                        <StatusIcon status={statuses[overlay.overpassKind]} />
                      )}
                    <Switch
                      checked={isOn}
                      disabled={disabled}
                      onCheckedChange={() => onToggle(overlay.id)}
                      aria-label={overlay.label}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {overlay.description}
                </p>
                {hint && (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    {hint}
                  </p>
                )}
                {overlay.id === "amenities" && (
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                    {Object.entries(AMENITY_META)
                      .filter(([k]) => k !== "other")
                      .map(([k, m]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: m.color }}
                            aria-hidden
                          />
                          {m.label}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Separator className="my-3" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Byggnadslagret hjälper dig att hålla avstånd till bostäder
        (hemfridszon). Brukad mark visar åkrar och ängar att undvika.
      </p>
    </div>
  );
}
