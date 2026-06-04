"use client";

import { Check, Layers, MapPin, ShieldQuestion, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FirstRunExplainer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MapPin className="size-5 text-primary" />
            Kan jag tälta här?
          </DialogTitle>
          <DialogDescription className="text-left">
            En hjälp för att tänka rätt under allemansrätten – inte ett facit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              <span className="font-medium">Appen visar underlag:</span>{" "}
              byggnader, brukad mark, fastighetsgränser, naturreservat,
              eldningsförbud och väder runt din position.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              <span className="font-medium">Den ger ingen dom.</span> Om du får
              tälta är situationsberoende. Vi ritar ingen grön “tälta här”-zon,
              eftersom det skulle bli fel i kantfallen.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              <span className="font-medium">Du avgör.</span> Tidskänslig info
              (väder, eldningsförbud) tidsstämplas, och vi länkar till officiella
              källor istället för att återge regler som kan bli inaktuella.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <X className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Hemfridszonen runt hus är ingen exakt linje. En ev. zon i appen är
              bara vägledande.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Jag förstår
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
