import { CalendarPlus, Plus, Trophy } from "lucide-react";
import { useState } from "react";

import { EventFormDialog } from "@/components/event-form-dialog";
import { NewMatchDialog } from "@/components/new-match-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * CTA global "+ Novo": só escolhe o tipo de cobertura e abre os formulários
 * já existentes (NewMatchDialog / EventFormDialog). Sem lógica de banco.
 */
export function QuickCreate({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [choosing, setChoosing] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  const pick = (what: "match" | "event") => {
    setChoosing(false);
    if (what === "match") setMatchOpen(true);
    else setEventOpen(true);
  };

  return (
    <>
      {compact ? (
        <Button size="icon" variant="ghost" aria-label="Novo" onClick={() => setChoosing(true)}>
          <Plus className="size-5" />
        </Button>
      ) : (
        <Button size="sm" className={className} onClick={() => setChoosing(true)}>
          <Plus className="size-4" /> Novo
        </Button>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que deseja cadastrar?</DialogTitle>
            <DialogDescription>
              Escolha entre uma partida tradicional ou um evento esportivo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => pick("match")}
              className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <CalendarPlus className="mt-0.5 size-5 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">Nova partida</span>
                <span className="block text-xs text-muted-foreground">
                  Cadastre um jogo com mandante e visitante.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => pick("event")}
              className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <Trophy className="mt-0.5 size-5 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">Novo evento</span>
                <span className="block text-xs text-muted-foreground">
                  Cadastre corridas, torneios e outras coberturas esportivas.
                </span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <NewMatchDialog open={matchOpen} onOpenChange={setMatchOpen} hideTrigger />
      <EventFormDialog open={eventOpen} onOpenChange={setEventOpen} />
    </>
  );
}
