"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Flame } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/data/client";
import { loadCache, saveCache } from "@/lib/cache";
import { formatCheckedAt } from "@/lib/geo";
import { COUNTIES } from "@/lib/lanstyrelser";
import type { FireBanResult } from "@/lib/types";

export function FireBanBanner({
  county,
  onChangeCounty,
}: {
  county: string | null;
  onChangeCounty: (code: string | null) => void;
}) {
  const [data, setData] = useState<FireBanResult | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    const key = `fireban:${county ?? "none"}`;
    const qs = county ? `?county=${encodeURIComponent(county)}` : "";
    getJson<FireBanResult>(`/api/fire-ban${qs}`, ac.signal)
      .then((res) => {
        setData(res);
        saveCache(key, res);
      })
      .catch(() => {
        // Offline: fall back to the last cached value for this county.
        if (ac.signal.aborted) return;
        const cached = loadCache<FireBanResult>(key);
        if (cached) setData(cached.value);
      });
    return () => ac.abort();
  }, [county]);

  const headline = data?.headline ?? "Kontrollera eldningsförbud lokalt";

  return (
    <Card
      className={cn(
        "pointer-events-auto gap-0 border-l-4 px-3 py-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/90",
        "border-l-[var(--warning)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <Flame className="size-5 shrink-0 text-[var(--warning)]" />
        <span className="flex-1 text-sm font-medium leading-tight">
          {headline}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {data?.detail ??
              "Eldningsförbud beslutas lokalt och ändras snabbt – kontrollera alltid hos din länsstyrelse innan du eldar."}
          </p>

          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Ditt län</span>
            <select
              value={county ?? ""}
              onChange={(e) => onChangeCounty(e.target.value || null)}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            >
              <option value="">Välj län…</option>
              {COUNTIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            {(data?.links ?? []).map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {link.label}
              </a>
            ))}
          </div>

          {data?.checkedAt && (
            <div className="text-[10px] text-muted-foreground">
              Kontrollerad {formatCheckedAt(data.checkedAt)} · Källa:{" "}
              {data.source}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
