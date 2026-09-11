import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SportSelect } from "@/components/sport-select";
import { EVENT_STATUS, useEventMutations, type EventStatus, type SportEvent } from "@/lib/events";

const EMPTY = {
  name: "",
  sport: null as string | null,
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  venue: "",
  city: "",
  state: "",
  organizer: "",
  official_url: "",
  accreditation_required: false,
  notes: "",
  status: "scheduled" as EventStatus,
};

/** Cadastro/edição manual de um evento esportivo. */
export function EventFormDialog({
  open,
  onOpenChange,
  event,
  sports = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: SportEvent | null;
  sports?: (string | null | undefined)[];
}) {
  const { save } = useEventMutations();
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        name: event.name,
        sport: event.sport,
        start_date: event.start_date,
        start_time: event.start_time?.slice(0, 5) ?? "",
        end_date: event.end_date ?? "",
        end_time: event.end_time?.slice(0, 5) ?? "",
        venue: event.venue ?? "",
        city: event.city ?? "",
        state: event.state ?? "",
        organizer: event.organizer ?? "",
        official_url: event.official_url ?? "",
        accreditation_required: event.accreditation_required,
        notes: event.notes ?? "",
        status: event.status,
      });
      setCategories(event.categories.map((c) => c.name));
    } else {
      setForm(EMPTY);
      setCategories([]);
    }
    setNewCategory("");
  }, [open, event]);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setCategories((c) =>
      c.some((x) => x.toLowerCase() === name.toLowerCase()) ? c : [...c, name],
    );
    setNewCategory("");
  }

  function submit() {
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome do evento.");
      return;
    }
    if (!form.sport) {
      toast.error("Selecione a modalidade.");
      return;
    }
    if (!form.start_date) {
      toast.error("Informe a data inicial.");
      return;
    }
    save.mutate(
      {
        ...(event ? { id: event.id } : {}),
        name: form.name.trim(),
        sport: form.sport,
        start_date: form.start_date,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        venue: form.venue.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        organizer: form.organizer.trim() || null,
        official_url: form.official_url.trim() || null,
        accreditation_required: form.accreditation_required,
        notes: form.notes.trim() || null,
        status: form.status,
        categories,
      },
      {
        onSuccess: () => {
          toast.success(event ? "Evento atualizado." : "Evento cadastrado.");
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível salvar o evento."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            Eventos esportivos que não seguem o formato tradicional de mandante × visitante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Informações
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="event-name">Nome do evento *</Label>
              <Input
                id="event-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Corrida de Bombinhas 2026"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="event-sport">Esporte *</Label>
                <span className="text-[11px] text-muted-foreground">
                  Ex: Futebol, Vôlei, Corrida
                </span>
              </div>
              <SportSelect
                id="event-sport"
                value={form.sport}
                onChange={(sport) => set("sport", sport)}
                extra={sports}
                noneLabel="Selecionar esporte (ex: Futebol, Vôlei...)"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground">Sugestões:</span>
                {["Futebol", "Vôlei", "Basquete", "Corrida", "Futsal", "Beach Tennis"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("sport", s)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                      form.sport?.toLowerCase() === s.toLowerCase()
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-date">Data inicial *</Label>
                <Input
                  id="event-start-date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-start-time">Horário inicial</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-date">Data final</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-time">Horário final</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as EventStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Local
            </p>
            <Input
              placeholder="Local (ex.: Praia de Bombas)"
              value={form.venue}
              onChange={(e) => set("venue", e.target.value)}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-3">
              <Input
                placeholder="Cidade"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
              <Input
                placeholder="UF"
                maxLength={2}
                value={form.state}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
              />
            </div>
            <Input
              placeholder="Organizador"
              value={form.organizer}
              onChange={(e) => set("organizer", e.target.value)}
            />
            <Input
              placeholder="Link oficial"
              value={form.official_url}
              onChange={(e) => set("official_url", e.target.value)}
            />
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Categorias
            </p>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <span
                    key={c}
                    className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs"
                  >
                    {c}
                    <button
                      type="button"
                      aria-label={`Remover ${c}`}
                      onClick={() => setCategories((list) => list.filter((x) => x !== c))}
                    >
                      <X className="size-3 opacity-60" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="5 km, Open, Sub-17…"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCategory}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Categorias são opcionais.</p>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Credenciamento
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.accreditation_required}
                onCheckedChange={(v) => set("accreditation_required", v === true)}
              />
              Credenciamento necessário?
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Observações
            </p>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anotações internas sobre o evento"
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : event ? "Salvar alterações" : "Cadastrar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
