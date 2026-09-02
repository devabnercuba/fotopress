import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCompetitionMutations, type Competition, type CompetitionInput } from "@/lib/queries";
import { SPORT_SUGGESTIONS } from "@/lib/sports";

const TYPES = [
  "Futebol de Campo",
  "Futsal",
  "Futebol Feminino",
  "Futebol de Base",
  "Beach Soccer",
  "Outro",
];

const CATEGORIES = ["Futebol", "Futsal", "Feminino", "Base", "Outros"];

const GENDERS = ["Masculino", "Feminino", "Misto"];
const NO_GENDER = "__none__";

function emptyForm(name = ""): CompetitionInput {
  return {
    name,
    short_name: "",
    category: "Futebol",
    state: "",
    country: "Brasil",
    season: String(new Date().getFullYear()),
    type: "Futebol de Campo",
    logo_url: "",
    description: "",
    active: true,
    sport_key: "Futebol",
    gender: null,
  };
}

/**
 * Cadastro e edição de campeonato.
 * Usado na tela Campeonatos e dentro do formulário de Novo Jogo.
 */
export function CompetitionFormDialog({
  open,
  onOpenChange,
  competition,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition?: Competition | null;
  initialName?: string;
  onCreated?: (competition: Competition) => void;
}) {
  const { create, update } = useCompetitionMutations();
  const [form, setForm] = useState<CompetitionInput>(() => emptyForm());

  useEffect(() => {
    if (!open) return;
    if (competition) {
      setForm({
        name: competition.name,
        short_name: competition.short_name ?? "",
        category: competition.category,
        state: competition.state ?? "",
        country: competition.country ?? "Brasil",
        season: competition.season,
        type: competition.type ?? "Futebol de Campo",
        logo_url: competition.logo_url ?? "",
        description: competition.description ?? "",
        active: competition.active ?? true,
        sport_key: competition.sport_key ?? "Futebol",
        gender: competition.gender ?? null,
      });
    } else {
      setForm(emptyForm(initialName ?? ""));
    }
  }, [open, competition, initialName]);

  const set = (patch: Partial<CompetitionInput>) => setForm((f) => ({ ...f, ...patch }));

  function submit() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do campeonato.");
      return;
    }
    const payload: CompetitionInput = {
      ...form,
      name: form.name.trim(),
      short_name: form.short_name?.trim() || null,
      state: form.state?.trim().toUpperCase() || null,
      country: form.country.trim() || "Brasil",
      season: form.season.trim() || String(new Date().getFullYear()),
      type: form.type?.trim() || null,
      logo_url: form.logo_url?.trim() || null,
      description: form.description?.trim() || null,
    };

    if (competition) {
      update.mutate(
        { id: competition.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Campeonato atualizado.");
            onOpenChange(false);
          },
          onError: () => toast.error("Não foi possível salvar o campeonato."),
        },
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: (created) => {
        toast.success("Campeonato disponível.");
        onCreated?.(created);
        onOpenChange(false);
      },
      onError: () => toast.error("Não foi possível criar o campeonato."),
    });
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{competition ? "Editar campeonato" : "Novo campeonato"}</DialogTitle>
          <DialogDescription>
            Campeonatos organizam os jogos, as cores da agenda e os filtros do aplicativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="comp-name">Nome</Label>
            <Input
              id="comp-name"
              maxLength={120}
              placeholder="Campeonato Catarinense"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-short">Nome curto</Label>
              <Input
                id="comp-short"
                maxLength={40}
                placeholder="Catarinense"
                value={form.short_name ?? ""}
                onChange={(e) => set({ short_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-season">Temporada</Label>
              <Input
                id="comp-season"
                maxLength={9}
                value={form.season}
                onChange={(e) => set({ season: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type ?? ""} onValueChange={(v) => set({ type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set({ category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Modalidade</Label>
              <Select value={form.sport_key} onValueChange={(v) => set({ sport_key: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {SPORT_SUGGESTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select
                value={form.gender ?? NO_GENDER}
                onValueChange={(v) => set({ gender: v === NO_GENDER ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Não informar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GENDER}>Não informar</SelectItem>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-country">País</Label>
              <Input
                id="comp-country"
                maxLength={60}
                value={form.country}
                onChange={(e) => set({ country: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-state">Estado</Label>
              <Input
                id="comp-state"
                maxLength={2}
                placeholder="SC"
                value={form.state ?? ""}
                onChange={(e) => set({ state: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comp-desc">Descrição</Label>
            <Textarea
              id="comp-desc"
              rows={3}
              maxLength={400}
              value={form.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Campeonato ativo</p>
              <p className="text-xs text-muted-foreground">
                Inativos continuam no histórico, mas saem dos destaques.
              </p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => set({ active: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {competition ? "Salvar" : "Criar campeonato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
