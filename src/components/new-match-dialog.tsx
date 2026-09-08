import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCompetitionSelect } from "@/components/searchable-competition-select";
import { supabase } from "@/integrations/supabase/client";
import { participantLabels } from "@/lib/sport-form-config";
import { useSportPreferences } from "@/lib/sport-preferences";
import { useSportTerminology } from "@/lib/sport-terminology";

const EMPTY = {
  competition_id: "",
  date: "",
  time: "",
  home_team: "",
  away_team: "",
  venue: "",
  city: "",
  state: "",
};

export function NewMatchDialog({
  className,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const qc = useQueryClient();
  const { primarySport } = useSportPreferences();
  const terminology = useSportTerminology();
  const participants = participantLabels(primarySport);
  const isFutebol = primarySport === "futebol";

  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [form, setForm] = useState(EMPTY);

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("matches").insert({
        competition_id: form.competition_id,
        date: form.date,
        time: form.time,
        home_team: form.home_team.trim(),
        away_team: form.away_team.trim(),
        venue: form.venue.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        source: "Cadastro Manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success(
        isFutebol ? "Jogo cadastrado." : `${terminology.coverageSingular} cadastrado(a).`,
      );
      setForm(EMPTY);
      setOpen(false);
    },
    onError: () =>
      toast.error(
        isFutebol
          ? "Não foi possível cadastrar o jogo."
          : `Não foi possível cadastrar ${terminology.coverageSingular.toLowerCase()}.`,
      ),
  });

  function submit() {
    const missing = Object.entries(form).find(([, v]) => !String(v).trim());
    if (missing) {
      toast.error("Preencha todos os campos.");
      return;
    }
    create.mutate();
  }

  const triggerLabel = isFutebol ? "Nova partida" : `Nova partida`;
  const dialogTitle = isFutebol ? "Novo jogo" : `Nova partida / ${terminology.coverageSingular}`;
  const dialogDescription = isFutebol
    ? "Cadastre uma partida manualmente, sem depender de importação."
    : `Cadastre ${terminology.coverageSingular.toLowerCase()} manualmente, sem depender de importação.`;
  const submitLabel = isFutebol
    ? "Salvar jogo"
    : `Salvar ${terminology.coverageSingular.toLowerCase()}`;

  return (
    <>
      {!hideTrigger && (
        <Button size="sm" className={className} onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {triggerLabel}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{terminology.competitionSingular}</Label>
              <SearchableCompetitionSelect
                value={form.competition_id || null}
                onChange={(v) => set({ competition_id: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="match-date">Data</Label>
                <Input
                  id="match-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => set({ date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="match-time">Hora</Label>
                <Input
                  id="match-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => set({ time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="match-home">{participants.homeLabel}</Label>
                <Input
                  id="match-home"
                  maxLength={80}
                  value={form.home_team}
                  onChange={(e) => set({ home_team: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="match-away">{participants.awayLabel}</Label>
                <Input
                  id="match-away"
                  maxLength={80}
                  value={form.away_team}
                  onChange={(e) => set({ away_team: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="match-venue">{terminology.venueLabel}</Label>
              <Input
                id="match-venue"
                maxLength={120}
                value={form.venue}
                onChange={(e) => set({ venue: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="match-city">Cidade</Label>
                <Input
                  id="match-city"
                  maxLength={80}
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="match-state">Estado</Label>
                <Input
                  id="match-state"
                  maxLength={2}
                  placeholder="SC"
                  value={form.state}
                  onChange={(e) => set({ state: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
