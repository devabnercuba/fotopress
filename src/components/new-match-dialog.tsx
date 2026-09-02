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
      toast.success("Jogo cadastrado.");
      setForm(EMPTY);
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível cadastrar o jogo."),
  });

  function submit() {
    const missing = Object.entries(form).find(([, v]) => !String(v).trim());
    if (missing) {
      toast.error("Preencha todos os campos.");
      return;
    }
    create.mutate();
  }

  return (
    <>
      {!hideTrigger && (
        <Button size="sm" className={className} onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nova partida
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo jogo</DialogTitle>
            <DialogDescription>
              Cadastre uma partida manualmente, sem depender de importação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Campeonato</Label>
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
                <Label htmlFor="match-home">Mandante</Label>
                <Input
                  id="match-home"
                  maxLength={80}
                  value={form.home_team}
                  onChange={(e) => set({ home_team: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="match-away">Visitante</Label>
                <Input
                  id="match-away"
                  maxLength={80}
                  value={form.away_team}
                  onChange={(e) => set({ away_team: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="match-venue">Estádio</Label>
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
              Salvar jogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
