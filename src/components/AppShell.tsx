"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  BookOpen,
  Info,
  Layers,
  Loader2,
  LocateFixed,
  MapPinOff,
  WifiOff,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LayerToggles } from "@/components/panels/LayerToggles";
import { PrinciplesPanel } from "@/components/panels/PrinciplesPanel";
import { FireBanBanner } from "@/components/panels/FireBanBanner";
import { WeatherCard } from "@/components/panels/WeatherCard";
import {
  AssessmentCard,
  PositionAssessmentPanel,
} from "@/components/panels/PositionAssessment";
import { FirstRunExplainer } from "@/components/panels/FirstRunExplainer";
import { Disclaimer } from "@/components/panels/Disclaimer";

import { OVERLAYS } from "@/lib/map/layers";
import { PROPERTY_LAYER_ENABLED } from "@/lib/config";
import { useHydrated, useOnline, usePersistentState } from "@/lib/hooks";
import type {
  DataStatus,
  LngLat,
  OverlayId,
  OverpassKind,
  PositionAssessment,
} from "@/lib/types";
import type { ViewState } from "@/components/map/MapView";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  ),
});

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pointer-events-auto size-10 rounded-full shadow-md ring-1 ring-border backdrop-blur supports-[backdrop-filter]:bg-secondary/85"
    >
      {children}
    </Button>
  );
}

export function AppShell() {
  const propertyConfigured = PROPERTY_LAYER_ENABLED;

  const defaultEnabled = useMemo(
    () =>
      Object.fromEntries(
        OVERLAYS.map((o) => [o.id, o.defaultEnabled]),
      ) as Record<OverlayId, boolean>,
    [],
  );

  const [enabled, setEnabled] = usePersistentState<Record<OverlayId, boolean>>(
    "fch:overlays",
    defaultEnabled,
  );
  const [county, setCounty] = usePersistentState<string | null>(
    "fch:county",
    null,
  );
  const [seenIntro, setSeenIntro] = usePersistentState<boolean>(
    "fch:seen-intro",
    false,
  );
  const hydrated = useHydrated();

  const [statuses, setStatuses] = useState<Record<OverpassKind, DataStatus>>({
    buildings: "idle",
    landuse: "idle",
    reserves: "idle",
  });
  const [view, setView] = useState<ViewState | null>(null);
  const [located, setLocated] = useState<LngLat | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<PositionAssessment | null>(null);

  const handleLocate = useCallback((coords: LngLat) => {
    setLocated(coords);
    setLocateError(null);
  }, []);

  const [layersOpen, setLayersOpen] = useState(false);
  const [principlesOpen, setPrinciplesOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  // null = "not decided" → open on first run once hydrated; boolean = user choice.
  const [introOpen, setIntroOpen] = useState<boolean | null>(null);
  const introVisible = introOpen ?? (hydrated && !seenIntro);

  const locateRef = useRef<(() => void) | null>(null);
  const registerLocate = useCallback((fn: () => void) => {
    locateRef.current = fn;
  }, []);

  const toggle = useCallback(
    (id: OverlayId) => setEnabled((prev) => ({ ...prev, [id]: !prev[id] })),
    [setEnabled],
  );

  const handleIntroChange = (open: boolean) => {
    setIntroOpen(open);
    if (!open) setSeenIntro(true);
  };

  const anchor = located ?? view?.center ?? null;
  const online = useOnline();

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-muted">
      <MapView
        enabled={enabled}
        propertyConfigured={propertyConfigured}
        onViewChange={setView}
        onLocate={handleLocate}
        onStatusChange={setStatuses}
        registerLocate={registerLocate}
        onLocateError={setLocateError}
        onAssessment={setAssessment}
      />

      {/* Top overlay: controls + fire-ban banner */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="flex justify-end gap-2">
          <ControlButton label="Min plats" onClick={() => locateRef.current?.()}>
            <LocateFixed className="size-5" />
          </ControlButton>
          <ControlButton label="Lager" onClick={() => setLayersOpen(true)}>
            <Layers className="size-5" />
          </ControlButton>
          <ControlButton
            label="Allemansrätten"
            onClick={() => setPrinciplesOpen(true)}
          >
            <BookOpen className="size-5" />
          </ControlButton>
          <ControlButton label="Om appen" onClick={() => setIntroOpen(true)}>
            <Info className="size-5" />
          </ControlButton>
        </div>
        {!online && (
          <div className="pointer-events-auto mx-auto">
            <Badge
              variant="warning"
              className="gap-1 shadow-md ring-1 ring-border"
            >
              <WifiOff className="size-3" /> Offline – visar sparad data
            </Badge>
          </div>
        )}
        {locateError && (
          <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-md bg-card/95 px-3 py-1.5 text-xs shadow-md ring-1 ring-border backdrop-blur">
            <MapPinOff className="size-4 shrink-0 text-[var(--warning)]" />
            <span className="flex-1">{locateError}</span>
            <button
              type="button"
              aria-label="Stäng"
              onClick={() => setLocateError(null)}
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="pointer-events-auto mx-auto w-full max-w-md">
          <FireBanBanner county={county} onChangeCounty={setCounty} />
        </div>
      </div>

      {/* Bottom: prominent assessment, weather, persistent honest framing */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-3">
        <AssessmentCard
          assessment={assessment}
          onOpenDetails={() => setAssessOpen(true)}
          onUseMyLocation={() => locateRef.current?.()}
        />
        <div className="pointer-events-auto w-full max-w-md">
          <WeatherCard anchor={anchor} />
        </div>
        <div className="w-full max-w-md">
          <Disclaimer />
        </div>
      </div>

      <Sheet open={assessOpen} onOpenChange={setAssessOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle>Kan jag tälta här?</SheetTitle>
            <SheetDescription>
              Bedömning för din plats – underlag, inte ett facit.
            </SheetDescription>
          </SheetHeader>
          <PositionAssessmentPanel
            assessment={assessment}
            onUseMyLocation={() => {
              locateRef.current?.();
              setAssessOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={layersOpen} onOpenChange={setLayersOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle>Lager</SheetTitle>
            <SheetDescription>
              Välj vilka underlag som visas på kartan.
            </SheetDescription>
          </SheetHeader>
          <LayerToggles
            enabled={enabled}
            onToggle={toggle}
            statuses={statuses}
            propertyConfigured={propertyConfigured}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={principlesOpen} onOpenChange={setPrinciplesOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Allemansrätten</SheetTitle>
            <SheetDescription>
              Principer att tillämpa – inte ett facit.
            </SheetDescription>
          </SheetHeader>
          <PrinciplesPanel />
        </SheetContent>
      </Sheet>

      <FirstRunExplainer open={introVisible} onOpenChange={handleIntroChange} />
    </div>
  );
}
