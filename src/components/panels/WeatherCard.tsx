"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  WifiOff,
  Wind,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { getJson } from "@/lib/data/client";
import { loadCache, saveCache } from "@/lib/cache";
import { formatCheckedAt, roundCoord, timeAgo } from "@/lib/geo";
import { useOnline } from "@/lib/hooks";
import type { DataStatus, LngLat, WeatherResult } from "@/lib/types";

function WeatherSymbol({
  symbol,
  className,
}: {
  symbol: number | null;
  className?: string;
}) {
  if (symbol == null) return <Cloud className={className} />;
  if (symbol <= 2) return <Sun className={className} />;
  if (symbol <= 4) return <CloudSun className={className} />;
  if (symbol <= 6) return <Cloud className={className} />;
  if (symbol === 7) return <CloudFog className={className} />;
  if (symbol === 11 || symbol === 21)
    return <CloudLightning className={className} />;
  if ((symbol >= 15 && symbol <= 17) || (symbol >= 25 && symbol <= 27))
    return <CloudSnow className={className} />;
  return <CloudRain className={className} />;
}

export function WeatherCard({ anchor }: { anchor: LngLat | null }) {
  const [data, setData] = useState<WeatherResult | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<DataStatus>("idle");
  const online = useOnline();

  // Round to ~1 km so we only refetch on meaningful moves (SMHI's grid is
  // coarse anyway). null when we have no position yet.
  const lat = anchor ? roundCoord(anchor.lat, 2) : null;
  const lon = anchor ? roundCoord(anchor.lng, 2) : null;

  useEffect(() => {
    if (lat == null || lon == null) return;
    const ac = new AbortController();
    const key = `weather:${lat},${lon}`;

    getJson<WeatherResult>(`/api/weather?lat=${lat}&lon=${lon}`, ac.signal)
      .then((w) => {
        setData(w);
        setCachedAt(saveCache(key, w).cachedAt);
        setStatus("ready");
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        const cached = loadCache<WeatherResult>(key);
        if (cached) {
          setData(cached.value);
          setCachedAt(cached.cachedAt);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      });

    return () => ac.abort();
  }, [lat, lon]);

  if (!anchor) return null;

  return (
    <Card className="pointer-events-auto gap-0 px-3 py-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/85">
      {status === "error" && !data ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="size-4" />
          Väder ej tillgängligt
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <WeatherSymbol
            symbol={data?.symbol ?? null}
            className="size-7 text-primary"
          />
          <div className="leading-tight">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold">
                {data?.temperatureC != null
                  ? `${Math.round(data.temperatureC)}°`
                  : "–"}
              </span>
              <span className="text-xs text-muted-foreground">
                {data?.description ?? (status === "idle" ? "Hämtar…" : "")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Wind className="size-3" />
                {data?.windMs != null ? `${Math.round(data.windMs)} m/s` : "–"}
              </span>
              <span className="flex items-center gap-0.5">
                <Droplets className="size-3" />
                {data?.precipMm != null
                  ? `${data.precipMm.toFixed(1)} mm`
                  : "–"}
              </span>
            </div>
          </div>
        </div>
      )}
      {cachedAt && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {online ? "Uppdaterad " : "Senast "}
          {formatCheckedAt(cachedAt)} ({timeAgo(cachedAt)})
          {!online && " · offline"} · SMHI
        </div>
      )}
    </Card>
  );
}
