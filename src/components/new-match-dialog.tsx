import { useQueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableCompetitionSelect } from "@/components/searchable-competition-select";
import { supabase } from "@/integrations/supabase/client";
import { participantLabels } from "@/lib/sport-form-config";
import { useSportPreferences } from "@/lib/sport-preferences";
import { useSportTerminology } from "@/lib/sport-terminology";
import { cn } from "@/lib/utils";

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
    if (!v) {
      setPendingMatchId(null);
      setIsSubmitting(false);
    }
  };

  const [form, setForm] = useState(EMPTY);
  const [needsAccreditation, setNeedsAccreditation] = useState(true);
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (patch: Partial<typeof EMPTY>) => {
    setPendingMatchId(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  async function submit() {
    if (isSubmitting) return;

    const missing = Object.entries(form).find(([, v]) => !String(v).trim());
    if (missing) {
      toast.error("Preencha todos os campos.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (needsAccreditation) {
        // Fluxo padrão com credenciamento necessário
        let matchId = pendingMatchId;
        if (!matchId) {
          const { data, error } = await supabase
            .from("matches")
            .insert({
              competition_id: form.competition_id || null,
              date: form.date,
              time: form.time,
              home_team: form.home_team.trim(),
              away_team: form.away_team.trim(),
              venue: form.venue.trim() || null,
              city: form.city.trim() || null,
              state: form.state.trim().toUpperCase() || null,
              source: "Cadastro Manual",
            })
            .select("id")
            .single();

          if (error) throw error;
          matchId = data.id;
        }

        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["coverages"] });
        qc.invalidateQueries({ queryKey: ["agenda"] });
        toast.success(
          isFutebol ? "Jogo cadastrado." : `${terminology.coverageSingular} cadastrado(a).`,
        );
        setForm(EMPTY);
        setPendingMatchId(null);
        setNeedsAccreditation(true);
        setOpen(false);
      } else {
        // Fluxo com credenciamento dispensado
        let matchId = pendingMatchId;
        if (!matchId) {
          const { data, error } = await supabase
            .from("matches")
            .insert({
              competition_id: form.competition_id || null,
              date: form.date,
              time: form.time,
              home_team: form.home_team.trim(),
              away_team: form.away_team.trim(),
              venue: form.venue.trim() || null,
              city: form.city.trim() || null,
              state: form.state.trim().toUpperCase() || null,
              source: "Cadastro Manual",
            })
            .select("id")
            .single();

          if (error) throw error;
          matchId = data.id;
          setPendingMatchId(matchId);
        }

        // Etapa 2: Vincular cobertura ao usuário com credenciamento dispensado a realizar
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        const { error: coverageError } = await supabase.from("coverages").upsert(
          {
            match_id: matchId,
            ...(uid ? { user_id: uid } : {}),
            credential_status: "exempt",
            completed_at: null,
          },
          { onConflict: "match_id" },
        );

        if (coverageError) {
          console.error("Erro ao vincular cobertura dispensada:", coverageError);
          toast.error(
            "A partida foi cadastrada, mas houve uma falha ao incluir na Minha Agenda. Clique em Salvar novamente para concluir a inclusão sem duplicar a partida.",
          );
          return;
        }

        // Sucesso completo confirmado
        setPendingMatchId(null);
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["coverages"] });
        qc.invalidateQueries({ queryKey: ["agenda"] });
        toast.success(
          "Partida cadastrada e adicionada à Minha Agenda com credenciamento dispensado.",
        );
        setForm(EMPTY);
        setNeedsAccreditation(true);
        setOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(
        isFutebol
          ? "Não foi possível cadastrar o jogo."
          : `Não foi possível cadastrar ${terminology.coverageSingular.toLowerCase()}.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const triggerLabel = isFutebol ? "Nova partida" : `Nova partida`;
  const dialogTitle = isFutebol ? "Novo jogo" : `Nova partida / ${terminology.coverageSingular}`;
  const dialogDescription = isFutebol
    ? "Cadastre uma partida manualmente, sem depender de importação."
    : `Cadastre ${terminology.coverageSingular.toLowerCase()} manualmente, sem depender de importação.`;
  const submitLabel = isSubmitting
    ? "Salvando..."
    : isFutebol
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

            {/* Pergunta obrigatória de credenciamento */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3.5">
              <div className="space-y-1">
                <Label className="text-sm font-semibold flex items-center gap-1">
                  <span>Esta cobertura precisa de credenciamento?</span>
                  <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isFutebol
                    ? "Defina se esta partida exige credenciamento oficial ou se você possui acesso livre para cobertura."
                    : "Defina se esta cobertura exige credenciamento oficial ou se você possui acesso livre."}
                </p>
              </div>

              <RadioGroup
                value={needsAccreditation ? "sim" : "nao"}
                onValueChange={(val) => {
                  setNeedsAccreditation(val === "sim");
                  setPendingMatchId(null);
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
              >
                <label
                  htmlFor="match-accreditation-yes"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                    needsAccreditation
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border hover:bg-surface text-muted-foreground",
                  )}
                >
                  <RadioGroupItem value="sim" id="match-accreditation-yes" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground">Sim (Padrão)</div>
                    <p className="text-[11px] text-muted-foreground">
                      Exige credenciamento. Você poderá solicitar e acompanhar a aprovação.
                    </p>
                  </div>
                </label>

                <label
                  htmlFor="match-accreditation-no"
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                    !needsAccreditation
                      ? "border-sky-500 bg-sky-500/5 text-foreground ring-1 ring-sky-500"
                      : "border-border hover:bg-surface text-muted-foreground",
                  )}
                >
                  <RadioGroupItem value="nao" id="match-accreditation-no" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground">Não (Dispensado)</div>
                    <p className="text-[11px] text-muted-foreground">
                      Credenciamento dispensado. Adiciona direto à Minha Agenda a realizar.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
