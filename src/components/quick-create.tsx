import { CalendarPlus, ChevronDown, Plus, Trophy } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSportPreferences } from "@/lib/sport-preferences";
import { usesMatchFirstWorkflow } from "@/lib/sport-form-config";
import { cn } from "@/lib/utils";

/**
 * CTA global "+ Novo":
 * - Para modalidades baseadas em partida (futebol, etc.): abre diálogo para escolher entre partida e evento.
 * - Para modalidades baseadas em evento/prova (corrida, etc.): o botão principal abre diretamente o EventFormDialog,
 *   mantendo acesso a nova partida via menu complementar sem excluir opções.
 */
export function QuickCreate({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { primarySport } = useSportPreferences();
  const matchFirst = usesMatchFirstWorkflow(primarySport);

  const [choosing, setChoosing] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  const pick = (what: "match" | "event") => {
    setChoosing(false);
    if (what === "match") setMatchOpen(true);
    else setEventOpen(true);
  };

  const handleMainClick = () => {
    if (matchFirst) {
      setChoosing(true);
    } else {
      setEventOpen(true);
    }
  };

  return (
    <>
      {compact ? (
        <Button size="icon" variant="ghost" aria-label="Novo" onClick={handleMainClick}>
          <Plus className="size-5" />
        </Button>
      ) : matchFirst ? (
        <Button size="sm" className={className} onClick={handleMainClick}>
          <Plus className="size-4" /> Novo
        </Button>
      ) : (
        <div className={cn("inline-flex items-center", className)}>
          <Button size="sm" className="flex-1 rounded-r-none" onClick={handleMainClick}>
            <Plus className="size-4" /> Novo
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="rounded-l-none border-l border-primary-foreground/20 px-2"
                aria-label="Outras opções de cadastro"
              >
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEventOpen(true)}>
                <Trophy className="mr-2 size-4" />
                Novo evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMatchOpen(true)}>
                <CalendarPlus className="mr-2 size-4" />
                Nova partida
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
