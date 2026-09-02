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
import { CategorySelect } from "@/components/category-select";
import { SportSelect } from "@/components/sport-select";
import { TeamCrest } from "@/components/team-crest";
import { DEFAULT_SPORT_KEY, useTeamMutations, useTeams, type Team } from "@/lib/teams";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GENDERS = ["Masculino", "Feminino", "Misto"];
const NO_GENDER = "__none__";

const EMPTY = {
  name: "",
  short_name: "",
  abbreviation: "",
  sport_key: "Futebol",
  category: null as string | null,
  gender: null as string | null,
  city: "",
  state: "",
};

/**
 * Criação e edição do clube. Criar e editar compartilham exatamente os mesmos
 * campos estruturais — nome, modalidade, categoria e gênero definem a
 * identidade da equipe.
 */
export function TeamEditDialog({
  team,
  mode = "edit",
  open,
  onOpenChange,
}: {
  team: Team | null;
  mode?: "edit" | "create";
  /** Necessário no modo criação (no modo edição, `team` já controla). */
  open?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { save, create, removeLogo } = useTeamMutations();
  const { data: teams = [] } = useTeams();
  const [logo, setLogo] = useState<File | null>(null);
  const [form, setForm] = useState(EMPTY);

  const isCreate = mode === "create";
  const isOpen = isCreate ? !!open : !!team;

  useEffect(() => {
    if (!isOpen) return;
    setLogo(null);
    if (isCreate || !team) {
      setForm(EMPTY);
      return;
    }
    setForm({
      name: team.name,
      short_name: team.short_name ?? "",
      abbreviation: team.abbreviation ?? "",
      sport_key: team.sport_key || DEFAULT_SPORT_KEY,
      category: team.category,
      gender: team.gender,
      city: team.city ?? "",
      state: team.state ?? "",
    });
  }, [team, isCreate, isOpen]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const pending = save.isPending || create.isPending;

  function submit() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do clube.");
      return;
    }
    if (!form.sport_key.trim()) {
      toast.error("Informe a modalidade do clube.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      short_name: form.short_name.trim() || null,
      abbreviation: form.abbreviation.trim().toUpperCase() || null,
      sport_key: form.sport_key.trim(),
      category: form.category,
      gender: form.gender,
      city: form.city.trim() || null,
      state: form.state.trim().toUpperCase() || null,
      logo,
    };

    if (isCreate) {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success("Clube cadastrado.");
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(
            error instanceof Error && error.message === "DUPLICATE"
              ? "Já existe um clube com este nome, modalidade e categoria."
              : "Não foi possível cadastrar o clube.",
          ),
      });
      return;
    }

    if (!team) return;
    save.mutate(
      { id: team.id, ...payload },
      {
        onSuccess: () => {
          toast.success("Clube atualizado.");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível salvar o clube."),
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Novo clube" : "Editar clube"}</DialogTitle>
          <DialogDescription>
            Nome, modalidade, categoria e gênero identificam a equipe. O escudo enviado aqui tem
            prioridade sobre o escudo capturado das origens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {team && !isCreate && <TeamCrest name={team.name} teamId={team.id} size="lg" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="team-logo">Escudo</Label>
              <Input
                id="team-logo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              />
            </div>
            {!isCreate && team?.logo_local && (
              <Button
                variant="ghost"
                size="sm"
                disabled={removeLogo.isPending}
                onClick={() =>
                  removeLogo.mutate(team.id, {
                    onSuccess: () => toast.success("Escudo enviado removido."),
                  })
                }
              >
                Remover
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-name">Nome *</Label>
            <Input
              id="team-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-short">Nome curto</Label>
              <Input
                id="team-short"
                value={form.short_name}
                onChange={(e) => set({ short_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-abbr">Sigla</Label>
              <Input
                id="team-abbr"
                maxLength={3}
                value={form.abbreviation}
                onChange={(e) => set({ abbreviation: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Modalidade *</Label>
            <SportSelect
              value={form.sport_key}
              extra={teams.map((t) => t.sport_key)}
              onChange={(sport) => set({ sport_key: sport ?? "" })}
              noneLabel="Selecione a modalidade"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <CategorySelect value={form.category} onChange={(category) => set({ category })} />
            </div>
            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select
                value={form.gender ?? NO_GENDER}
                onValueChange={(v) => set({ gender: v === NO_GENDER ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem gênero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GENDER}>Sem gênero</SelectItem>
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
              <Label htmlFor="team-city">Cidade</Label>
              <Input
                id="team-city"
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-state">Estado</Label>
              <Input
                id="team-state"
                maxLength={2}
                value={form.state}
                onChange={(e) => set({ state: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isCreate ? "Cadastrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
