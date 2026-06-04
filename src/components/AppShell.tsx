"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Info, Layers, Loader2, LocateFixed } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { FirstRunExplainer } from "@/components/panels/FirstRunExplainer";
import { Disclaimer } from "@/components/panels/Disclaimer";

import { OVERLAYS } from "@/lib/map/layers";
import { PROPERTY_LAYER_ENABLED } from "@/lib/config";
import { useHydrated, usePersistentState } from "@/lib/hooks";
import type {
  DataStatus,
  LngLat,
  OverlayId,
  OverpassKind,
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

  const [layersOpen, setLayersOpen] = useState(false);
  const [principlesOpen, setPrinciplesOpen] = useState(false);
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

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-muted">
      <MapView
        enabled={enabled}
        propertyConfigured={propertyConfigured}
        onViewChange={setView}
        onLocate={setLocated}
        onStatusChange={setStatuses}
        registerLocate={registerLocate}
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
        <div className="pointer-events-auto mx-auto w-full max-w-md">
          <FireBanBanner county={county} onChangeCounty={setCounty} />
        </div>
      </div>

      {/* Bottom-left: weather */}
      <div className="absolute bottom-9 left-3 z-10 max-w-[70%]">
        <WeatherCard anchor={anchor} />
      </div>

      {/* Persistent honest framing */}
      <div className="absolute inset-x-0 bottom-2 z-10 px-3">
        <Disclaimer />
      </div>

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
