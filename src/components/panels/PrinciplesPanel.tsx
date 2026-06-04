"use client";

import {
  ExternalLink,
  Flame,
  House,
  Leaf,
  MoonStar,
  SquareDashed,
  TreePine,
  TriangleAlert,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ALLEMANSRATTEN_INTRO,
  OFFICIAL_LINKS,
  PRINCIPLES,
} from "@/lib/allemansratten";

const ICONS: Record<string, LucideIcon> = {
  House,
  SquareDashed,
  Wheat,
  TreePine,
  MoonStar,
  Flame,
  Leaf,
};

export function PrinciplesPanel() {
  return (
    <div className="px-4 pb-4">
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
        {ALLEMANSRATTEN_INTRO}
      </p>

      <Accordion type="single" collapsible className="w-full">
        {PRINCIPLES.map((p) => {
          const Icon = ICONS[p.icon] ?? Leaf;
          return (
            <AccordionItem key={p.id} value={p.id}>
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">{p.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {p.summary}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-7 text-muted-foreground">
                {p.detail}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="mt-4 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
          <span>
            Det här är principer att tillämpa – inte ett facit. Appen avgör inte
            om du får tälta på en viss plats. Bedöm alltid situationen på plats.
          </span>
        </p>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Officiella källor
        </h3>
        <div className="flex flex-col gap-2">
          {OFFICIAL_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-2 text-sm"
            >
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="text-primary group-hover:underline">
                  {link.label}
                </span>
                {link.note && (
                  <span className="block text-xs text-muted-foreground">
                    {link.note}
                  </span>
                )}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
