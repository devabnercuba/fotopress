import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Clock, Eye, Moon, ShieldAlert, ShieldCheck, Sun, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/image-upload-field";
import { PlanCard } from "@/components/access-status";
import { useProfile, useProfileMutation, type Profile } from "@/lib/profile";
import { useCompetitions } from "@/lib/queries";
import { useSettings, useSettingsMutation, type AppSettings } from "@/lib/settings";
import { SPORT_OPTIONS } from "@/lib/sport-preferences";
import { ACCENTS, useTheme, type AccentId } from "@/lib/theme";
import { Checkbox } from "@/components/ui/checkbox";
import { formatWhatsapp, isValidWhatsapp, maskWhatsapp, normalizeWhatsapp } from "@/lib/whatsapp";
import { NotificationPreferences } from "@/components/notification-preferences";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Cobertura esportiva" },
      {
        name: "description",
        content: "Perfil, dados de fotógrafo, preferências de cobertura e aparência do app.",
      },
      { property: "og:title", content: "Configurações — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Ajuste perfil, preferências e aparência da sua agenda de coberturas.",
      },
    ],
  }),
  component: SettingsPage,
});

const STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm font-medium">{title}</div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              active
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsPage() {
  const { mode, setMode, accent, setAccent, highContrast, setHighContrast } = useTheme();
  const { data: settings, isLoading } = useSettings();
  const { data: competitions = [] } = useCompetitions();
  const save = useSettingsMutation();
  const { data: profile } = useProfile();
  const saveProfile = useProfileMutation();

  const [form, setForm] = useState<AppSettings | null>(null);
  const [profileForm, setProfileForm] = useState<Profile | null>(null);
  const [whatsappInput, setWhatsappInput] = useState("");
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (settings) {
      // Impede que um valor antigo do cache sobrescreva o formulário se o usuário estiver editando
      if (!form || !isDirtyRef.current) {
        setForm(settings);
        if (settings.accent && ACCENTS.some((a) => a.id === settings.accent)) {
          setAccent(settings.accent as AccentId);
        }
      }
    }
  }, [settings, form, setAccent]);

  useEffect(() => {
    if (profile) {
      setProfileForm(profile);
      setWhatsappInput(formatWhatsapp(profile.whatsapp) ?? "");
    }
  }, [profile]);

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const set = (patch: Partial<AppSettings>) => {
    isDirtyRef.current = true;
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const setProfile = (patch: Partial<Profile>) =>
    setProfileForm((p) => (p ? { ...p, ...patch } : p));

  const saveImage = (key: "photo_url" | "logo_url", url: string | null) => {
    setProfile({ [key]: url } as Partial<Profile>);
    if (profileForm) saveProfile.mutate({ ...profileForm, [key]: url });
  };

  /** Sincroniza a modalidade principal garantindo que sports permaneça consistente e sem duplicação */
  const handlePrimarySportChange = (newPrimary: string) => {
    isDirtyRef.current = true;
    const currentPrimary = form?.primary_sport || "futebol";
    const currentAdditionals = (form?.sports ?? []).filter(
      (s) => s !== currentPrimary && s !== newPrimary,
    );
    const updatedSports = Array.from(new Set([newPrimary, ...currentAdditionals]));
    setForm((f) =>
      f
        ? {
            ...f,
            primary_sport: newPrimary,
            sports: updatedSports,
          }
        : f,
    );
  };

  /** Alterna modalidades adicionais sem permitir que a modalidade principal seja desativada ou duplicada */
  const toggleAdditionalSport = (key: string) => {
    isDirtyRef.current = true;
    const currentPrimary = form?.primary_sport || "futebol";
    const currentAdditionals = (form?.sports ?? []).filter((s) => s !== currentPrimary);
    const nextAdditionals = currentAdditionals.includes(key)
      ? currentAdditionals.filter((s) => s !== key)
      : [...currentAdditionals, key];
    const updatedSports = Array.from(new Set([currentPrimary, ...nextAdditionals]));
    setForm((f) => (f ? { ...f, sports: updatedSports } : f));
  };

  const toggle = (key: "favorite_competitions" | "favorite_states", id: string) => {
    isDirtyRef.current = true;
    setForm((f) =>
      f
        ? {
            ...f,
            [key]: f[key].includes(id) ? f[key].filter((v) => v !== id) : [...f[key], id],
          }
        : f,
    );
  };

  const isSaving = save.isPending || saveProfile.isPending;

  const submit = async () => {
    if (!form) return;
    if (whatsappInput.trim() && !isValidWhatsapp(whatsappInput)) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }

    try {
      if (profileForm) {
        await saveProfile.mutateAsync({
          ...profileForm,
          whatsapp: normalizeWhatsapp(whatsappInput),
        });
      }

      // Garante o envio explícito das modalidades e cor de destaque
      const currentPrimary = form.primary_sport || "futebol";
      const currentSports = form.sports?.length ? form.sports : [currentPrimary];
      const currentAccent = form.accent || accent || "indigo";

      const payload: AppSettings = {
        ...form,
        primary_sport: currentPrimary,
        sports: currentSports,
        accent: currentAccent,
      };

      // Executa a mutation e aguarda a confirmação do Supabase com o registro retornado
      const updated = await save.mutateAsync(payload);

      // Atualiza formulário com dados confirmados e limpa dirty flag
      isDirtyRef.current = false;
      setForm(updated);

      // Re-aplica a cor persistida no banco
      if (updated.accent && ACCENTS.some((a) => a.id === updated.accent)) {
        setAccent(updated.accent as AccentId);
      }

      toast.success("Configurações salvas.");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Não foi possível salvar as configurações.");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Perfil, fotógrafo, preferências e aparência.
          </p>
        </div>
        <Button onClick={submit} disabled={isSaving}>
          {isSaving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </header>

      <PlanCard />

      <div id="perfil" className="scroll-mt-6">
        <Section title="Perfil" description="Seus dados pessoais e identidade visual no FotoPress.">
          <ImageUploadField
            label="Foto de perfil"
            value={profileForm?.photo_url ?? null}
            folder="perfil"
            round
            hint="PNG, JPG ou WEBP. Você poderá recortar antes de salvar."
            onChange={(url) => saveImage("photo_url", url)}
          />
          <ImageUploadField
            label="Logo profissional"
            value={profileForm?.logo_url ?? null}
            folder="logos"
            aspect={16 / 9}
            hint="Usada em créditos e materiais próprios."
            onChange={(url) => saveImage("logo_url", url)}
          />
          <Field
            id="p-first"
            label="Nome"
            value={profileForm?.first_name ?? ""}
            onChange={(v) => setProfile({ first_name: v })}
          />
          <Field
            id="p-last"
            label="Sobrenome"
            value={profileForm?.last_name ?? ""}
            onChange={(v) => setProfile({ last_name: v })}
          />
          <Field
            id="p-pro"
            label="Nome profissional"
            placeholder="Ex.: Fotógrafo esportivo"
            value={profileForm?.professional_name ?? ""}
            onChange={(v) => setProfile({ professional_name: v })}
          />
          <Field
            id="p-email"
            label="E-mail"
            type="email"
            value={profileForm?.email ?? ""}
            onChange={(v) => setProfile({ email: v })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="p-whatsapp">WhatsApp</Label>
            <Input
              id="p-whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(47) 99999-9999"
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(maskWhatsapp(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              {profileForm && !profileForm.whatsapp
                ? "Complete seu WhatsApp para receber suporte e acompanhamento."
                : "Usado apenas para suporte e acompanhamento da sua experiência."}
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                className="mt-0.5"
                checked={profileForm?.feedback_whatsapp_opt_in ?? false}
                onCheckedChange={(v) => setProfile({ feedback_whatsapp_opt_in: v === true })}
              />
              <span>
                Aceito receber contato pelo WhatsApp para compartilhar minha experiência e ajudar a
                melhorar o FotoPress.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                className="mt-0.5"
                checked={profileForm?.founder_community_interest ?? false}
                onCheckedChange={(v) => setProfile({ founder_community_interest: v === true })}
              />
              <span>
                Tenho interesse em participar futuramente da comunidade de Fundadores do FotoPress
                no WhatsApp.
              </span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={profileForm?.state ?? ""}
              onValueChange={(v) => setProfile({ state: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            id="p-city"
            label="Cidade"
            value={profileForm?.city ?? ""}
            onChange={(v) => setProfile({ city: v })}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-bio">Bio</Label>
            <Textarea
              id="p-bio"
              rows={3}
              value={profileForm?.bio ?? ""}
              onChange={(e) => setProfile({ bio: e.target.value })}
            />
          </div>
        </Section>
      </div>

      <Section title="Fotógrafo">
        <Field
          id="f-agency"
          label="Agência"
          value={form.agency ?? ""}
          onChange={(v) => set({ agency: v })}
        />
        <Field
          id="f-credit"
          label="Crédito padrão"
          value={form.default_credit ?? ""}
          placeholder="Foto: Nome/Agência"
          onChange={(v) => set({ default_credit: v })}
        />
        <Field
          id="f-ig"
          label="Instagram"
          value={form.instagram ?? ""}
          onChange={(v) => set({ instagram: v })}
        />
        <Field
          id="f-site"
          label="Site"
          value={form.website ?? ""}
          onChange={(v) => set({ website: v })}
        />
      </Section>

      <Section
        title="Modalidades"
        description="Escolha sua modalidade principal e outras que você também cobre para deixar o FotoPress perfeitamente organizado."
      >
        <div className="space-y-4 sm:col-span-2">
          {/* Seletor exclusivo de Modalidade Principal */}
          <div className="space-y-2">
            <Label htmlFor="primary-sport-select">Modalidade principal</Label>
            <Select
              value={form.primary_sport || "futebol"}
              onValueChange={handlePrimarySportChange}
            >
              <SelectTrigger id="primary-sport-select" className="w-full sm:w-80">
                <SelectValue placeholder="Selecione sua modalidade principal" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {SPORT_OPTIONS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define a prioridade das suas coberturas e orienta os termos da sua interface.
            </p>
          </div>

          {/* Chips para Outras modalidades que você cobre */}
          <div className="space-y-2">
            <Label>Outras modalidades que você cobre</Label>
            <Chips
              options={SPORT_OPTIONS.filter((s) => s.key !== (form.primary_sport || "futebol")).map(
                (s) => ({ id: s.key, label: s.label }),
              )}
              selected={(form.sports ?? []).filter((s) => s !== (form.primary_sport || "futebol"))}
              onToggle={toggleAdditionalSport}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Isso muda apenas a organização da interface. Alterar ou desativar modalidades{" "}
            <strong>nunca apaga</strong> jogos, eventos, fontes, atletas ou histórico existentes.
            Sem nenhuma escolha secundária, focamos na sua modalidade principal.
          </p>
        </div>
      </Section>

      <Section title="Preferências" description="Usadas para priorizar coberturas e filtros.">
        <Field
          id="pref-radius"
          label="Raio máximo (km)"
          type="number"
          value={form.max_radius_km === null ? "" : String(form.max_radius_km)}
          onChange={(v) => set({ max_radius_km: v ? Number(v) : null })}
        />
        <Field
          id="pref-value"
          label="Valor mínimo (R$)"
          type="number"
          value={form.min_value === null ? "" : String(form.min_value)}
          onChange={(v) => set({ min_value: v ? Number(v) : null })}
        />
        <div className="space-y-2 sm:col-span-2">
          <Label>Campeonatos favoritos</Label>
          <Chips
            options={competitions.map((c) => ({ id: c.id, label: c.name }))}
            selected={form.favorite_competitions}
            onToggle={(id) => toggle("favorite_competitions", id)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Estados favoritos</Label>
          <Chips
            options={STATES.map((s) => ({ id: s, label: s }))}
            selected={form.favorite_states}
            onToggle={(id) => toggle("favorite_states", id)}
          />
        </div>
      </Section>

      <Section
        title="Lembretes & Notificações Push"
        description="Avisos automáticos no navegador antes do início das suas coberturas agendadas."
      >
        <div className="sm:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2.5">
              <Bell className="size-4 text-primary" />
              <div>
                <div className="text-xs font-semibold text-foreground">
                  Página Dedicada de Notificações
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Ajuste avançado de tempo de aviso (15, 30, 60 min), canais e testes.
                </div>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Link to="/notificacoes">
                <span>Abrir página completa</span>
                <span className="sr-only">de notificações</span>
              </Link>
            </Button>
          </div>
          <NotificationPreferences showCardWrapper={false} />
        </div>
      </Section>

      <Section title="Aparência">
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <div className="flex items-center gap-3">
            {mode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <div>
              <div className="text-sm font-medium">Tema escuro</div>
              <div className="text-xs text-muted-foreground">Alternar entre claro e escuro</div>
            </div>
          </div>
          <Switch
            checked={mode === "dark"}
            onCheckedChange={(checked) => {
              setMode(checked ? "dark" : "light");
              set({ theme: checked ? "dark" : "light" });
            }}
          />
        </div>

        <div
          id="config-high-contrast-card"
          className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-3.5 sm:col-span-2"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Modo Alto Contraste</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    highContrast
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {highContrast ? "Ativo" : "Desativado"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Alterna a classe CSS{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                  high-contrast
                </code>{" "}
                no elemento root, proporcionando bordas nítidas e máxima legibilidade para
                acessibilidade ou uso sob luz solar intensa.
              </div>
            </div>
          </div>
          <Switch
            id="high-contrast-toggle"
            aria-label="Ativar modo de alto contraste para acessibilidade"
            checked={highContrast}
            onCheckedChange={(checked) => setHighContrast(checked)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Cor principal</Label>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAccent(a.id);
                  set({ accent: a.id });
                }}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  (form.accent || accent) === a.id
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <span
                  className="mr-2 inline-block size-2 rounded-full align-middle"
                  style={{ background: `oklch(0.6 ${a.chroma} ${a.hue})` }}
                />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Idioma</Label>
          <Select value={form.language} onValueChange={(v) => set({ language: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="es-ES">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Primeiro dia da semana</Label>
          <Select
            value={String(form.first_day_of_week)}
            onValueChange={(v) => set({ first_day_of_week: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Domingo</SelectItem>
              <SelectItem value="1">Segunda-feira</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>
    </div>
  );
}
