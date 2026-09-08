import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";

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
import { useProfile, useProfileMutation } from "@/lib/profile";
import { useSettings, useSettingsMutation } from "@/lib/settings";
import { SPORT_OPTIONS, sportLabel } from "@/lib/sport-preferences";
import { ACCENTS, useTheme, type AccentId } from "@/lib/theme";

/**
 * Onboarding do fotógrafo esportivo (Fase 1: Personalização Multiesportiva).
 * Fluxo seguro de 4 etapas:
 * 1. Boas-vindas
 * 2. Nome, sobrenome e cidade
 * 3. Escolha obrigatória da modalidade principal
 * 4. Modalidades adicionais e cor de destaque
 *
 * Regras:
 * - Usuários existentes com onboarded=true não veem o diálogo.
 * - Fechar o diálogo NÃO marca onboarded como concluído.
 * - 'Pular por enquanto' mantém futebol e índigo como padrões.
 * - profiles.onboarded só é marcado true após sucesso do salvamento de app_settings.
 */
export function OnboardingDialog() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const saveProfile = useProfileMutation();
  const saveSettings = useSettingsMutation();
  const { accent: currentAccent, setAccent } = useTheme();

  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Etapa 2: Dados básicos
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");

  // Etapa 3: Modalidade principal obrigatória (default futebol)
  const [primarySport, setPrimarySport] = useState<string>("futebol");

  // Etapa 4: Modalidades adicionais e cor
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [selectedAccent, setSelectedAccent] = useState<AccentId>("indigo");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setCity(profile.city ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (settings?.primary_sport) {
      setPrimarySport(settings.primary_sport);
    }
    if (Array.isArray(settings?.sports) && settings.sports.length > 0) {
      const primary = settings.primary_sport || "futebol";
      setAdditionalSports(settings.sports.filter((s) => s !== primary));
    }
    if (settings?.accent && ACCENTS.some((a) => a.id === settings.accent)) {
      setSelectedAccent(settings.accent as AccentId);
    } else if (currentAccent) {
      setSelectedAccent(currentAccent);
    }
  }, [settings, currentAccent]);

  const open = !!profile && !profile.onboarded && !closed;
  if (!profile) return null;

  const toggleAdditionalSport = (key: string) => {
    setAdditionalSports((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  };

  const handleSkip = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      if (settings?.id) {
        await saveSettings.mutateAsync({
          id: settings.id,
          primary_sport: "futebol",
          sports: ["futebol"],
          accent: "indigo",
        });
      }

      await saveProfile.mutateAsync({
        id: profile.id,
        onboarded: true,
        first_name: firstName.trim() || profile.first_name,
        last_name: lastName.trim() || profile.last_name,
        city: city.trim() || profile.city,
      });

      setAccent("indigo");
      toast.success("Configuração concluída com preferências padrão (Futebol).");
      setClosed(true);
    } catch (error) {
      console.error("Erro ao pular onboarding:", error);
      toast.error("Não foi possível salvar as configurações. O onboarding continuará pendente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const chosenPrimary = primarySport.trim() || "futebol";
      const sanitizedAdditionals = additionalSports.filter((s) => s !== chosenPrimary);
      const combinedSports = Array.from(new Set([chosenPrimary, ...sanitizedAdditionals]));

      // 1. Salva app_settings com modalidade principal, lista sem duplicações e cor de destaque
      if (settings?.id) {
        await saveSettings.mutateAsync({
          id: settings.id,
          primary_sport: chosenPrimary,
          sports: combinedSports,
          accent: selectedAccent,
        });
      }

      // 2. Marca profiles.onboarded somente após sucesso no app_settings
      await saveProfile.mutateAsync({
        id: profile.id,
        onboarded: true,
        first_name: firstName.trim() || profile.first_name,
        last_name: lastName.trim() || profile.last_name,
        city: city.trim() || profile.city,
      });

      setAccent(selectedAccent);
      toast.success("FotoPress configurado com sucesso para suas modalidades!");
      setClosed(true);
    } catch (error) {
      console.error("Erro ao concluir onboarding:", error);
      toast.error("Não foi possível salvar as configurações. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Fechar o diálogo NÃO marca o onboarding como concluído
        if (!v) setClosed(true);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {/* Etapa 1: Boas-vindas */}
        {step === 0 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Bem-vindo ao FotoPress 👋</DialogTitle>
              <DialogDescription>
                A plataforma exclusiva para fotógrafos esportivos organizarem coberturas, jogos,
                eventos e pautas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>
                Vamos personalizar sua experiência de acordo com o esporte que você fotografa. O
                FotoPress se adapta às suas modalidades esportivas mantendo toda a sua rotina
                organizada.
              </p>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                <span className="font-semibold text-foreground">Aviso importante:</span> O FotoPress
                é exclusivo para fotografia esportiva (futebol, corrida, quadra, praia, lutas e
                esportes ao ar livre).
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={handleSkip} disabled={isSaving}>
                Pular por enquanto
              </Button>
              <Button onClick={() => setStep(1)} disabled={isSaving}>
                Começar personalização
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Etapa 2: Dados básicos */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Seus dados básicos</DialogTitle>
              <DialogDescription>
                Como seus clientes e colegas de imprensa devem identificar seu perfil.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 py-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ob-first">Nome</Label>
                <Input
                  id="ob-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={profile.first_name ?? "Seu nome"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-last">Sobrenome</Label>
                <Input
                  id="ob-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={profile.last_name ?? "Seu sobrenome"}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ob-city">Cidade / Região principal de atuação</Label>
                <Input
                  id="ob-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Florianópolis, São Paulo, Rio de Janeiro..."
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(0)} disabled={isSaving}>
                Voltar
              </Button>
              <Button onClick={() => setStep(2)} disabled={isSaving}>
                Avançar: Modalidade principal
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Etapa 3: Escolha obrigatória da modalidade principal */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Sua modalidade esportiva principal
              </DialogTitle>
              <DialogDescription>
                Selecione o esporte que representa seu foco principal de coberturas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="primary-sport-select">Modalidade principal *</Label>
                <Select
                  value={primarySport}
                  onValueChange={(val) => {
                    setPrimarySport(val);
                    // Remove da lista de adicionais caso estivesse selecionada
                    setAdditionalSports((prev) => prev.filter((s) => s !== val));
                  }}
                >
                  <SelectTrigger id="primary-sport-select" className="w-full">
                    <SelectValue placeholder="Selecione sua modalidade principal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {SPORT_OPTIONS.map((sport) => (
                      <SelectItem key={sport.key} value={sport.key}>
                        {sport.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Atalhos rápidos das modalidades mais fotografadas */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Escolha rápida:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "futebol",
                    "corrida",
                    "futsal",
                    "beach-tennis",
                    "ciclismo",
                    "volei",
                    "basquete",
                    "crossfit",
                  ].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPrimarySport(key);
                        setAdditionalSports((prev) => prev.filter((s) => s !== key));
                      }}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        primarySport === key
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {sportLabel(key)}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                A modalidade principal orienta a terminologia do sistema e a prioridade das suas
                pautas. Você poderá alterar isso a qualquer momento nas Configurações.
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={isSaving}>
                Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!primarySport || isSaving}>
                Avançar: Outras modalidades
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Etapa 4: Modalidades adicionais e cor de destaque */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Outras modalidades e aparência
              </DialogTitle>
              <DialogDescription>
                Você também fotografa outros esportes? Escolha também sua cor de destaque.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Modalidades secundárias */}
              <div className="space-y-2">
                <Label>Outras modalidades que você também cobre (opcional):</Label>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border/70 p-2.5">
                  {SPORT_OPTIONS.filter((s) => s.key !== primarySport).map((sport) => {
                    const isSelected = additionalSports.includes(sport.key);
                    return (
                      <button
                        key={sport.key}
                        type="button"
                        onClick={() => toggleAdditionalSport(sport.key)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                        {sport.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cor de destaque */}
              <div className="space-y-2">
                <Label>Cor de destaque da interface:</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccent(a.id);
                        setAccent(a.id);
                      }}
                      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                        selectedAccent === a.id
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span
                        className="mr-2 inline-block size-2.5 rounded-full align-middle"
                        style={{ background: `oklch(0.6 ${a.chroma} ${a.hue})` }}
                      />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={isSaving}>
                Voltar
              </Button>
              <Button onClick={handleComplete} disabled={isSaving}>
                {isSaving ? "Salvando…" : "Concluir configuração"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
