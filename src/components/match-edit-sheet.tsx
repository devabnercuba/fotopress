import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TeamCrest } from "@/components/team-crest";
import { TeamEditDialog } from "@/components/team-edit-dialog";
import { findTeam, teamIndex, useTeams, type Team } from "@/lib/teams";
import { useMatchMutations } from "@/lib/matches";
import { useCompetitions, type Match } from "@/lib/queries";

/** Edição de uma partida no drawer já existente do sistema. */
export function MatchEditSheet({
  match,
  onOpenChange,
}: {
  match: Match | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: competitions = [] } = useCompetitions();
  const { update } = useMatchMutations();
  const { data: teams = [] } = useTeams();
  const index = useMemo(() => teamIndex(teams), [teams]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({
    competition_id: "",
    date: "",
    time: "",
    home_team: "",
    away_team: "",
    venue: "",
    city: "",
    state: "",
    notes: "",
  });

  useEffect(() => {
    if (!match) return;
    setForm({
      competition_id: match.competition_id ?? "",
      date: match.date,
      time: match.time.slice(0, 5),
      home_team: match.home_team,
      away_team: match.away_team,
      venue: match.venue ?? "",
      city: match.city ?? "",
      state: match.state ?? "",
      notes: match.notes ?? "",
    });
  }, [match]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function submit() {
    if (!match) return;
    if (!form.date || !form.time || !form.home_team.trim() || !form.away_team.trim()) {
      toast.error("Campeonato, data, hora, mandante e visitante são obrigatórios.");
      return;
    }
    update.mutate(
      {
        id: match.id,
        competition_id: form.competition_id || null,
        date: form.date,
        time: form.time,
        home_team: form.home_team.trim(),
        away_team: form.away_team.trim(),
        venue: form.venue.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        notes: form.notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Jogo atualizado.");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível salvar o jogo."),
      },
    );
  }

  return (
    <Sheet open={!!match} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar jogo</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          <div className="space-y-1.5">
            <Label>Campeonato</Label>
            <Select value={form.competition_id} onValueChange={(v) => set({ competition_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campeonato" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-time">Horário</Label>
              <Input
                id="edit-time"
                type="time"
                value={form.time}
                onChange={(e) => set({ time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-home">Mandante</Label>
              <Input
                id="edit-home"
                value={form.home_team}
                onChange={(e) => set({ home_team: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-away">Visitante</Label>
              <Input
                id="edit-away"
                value={form.away_team}
                onChange={(e) => set({ away_team: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Escudos dos clubes</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {[form.home_team, form.away_team].filter(Boolean).map((name) => {
                const team = findTeam(index, name);
                return (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    className="justify-start gap-2"
                    disabled={!team}
                    onClick={() => team && setEditingTeam(team)}
                  >
                    <TeamCrest name={name} size="sm" />
                    <span className="truncate">{name}</span>
                    <ImagePlus className="ml-auto size-4 opacity-60" />
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Envie um escudo manualmente; ele tem prioridade sobre o escudo da origem.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-venue">Estádio</Label>
            <Input
              id="edit-venue"
              value={form.venue}
              onChange={(e) => set({ venue: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-city">Cidade</Label>
              <Input
                id="edit-city"
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-state">Estado</Label>
              <Input
                id="edit-state"
                maxLength={2}
                value={form.state}
                onChange={(e) => set({ state: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Observações</Label>
            <Textarea
              id="edit-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={update.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
      <TeamEditDialog team={editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)} />
    </Sheet>
  );
}
