import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_TIME_OPTIONS,
  useCoverageReminders,
  type ReminderLeadTime,
  getLeadTimeLabel,
} from "@/lib/coverage-reminders";
import { useCoverages, type Coverage } from "@/lib/coverages";
import { useEventCoverages, type SportEvent } from "@/lib/events";
import { AgendaMatchSheet } from "@/components/agenda-match-sheet";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { isRadarEnabled } from "@/lib/features";
import { useRadars } from "@/lib/radar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Configurações de Notificações — FotoPress" },
      {
        name: "description",
        content:
          "Gerencie suas preferências de alertas push, tempo de antecedência e notificações de coberturas esportivas.",
      },
      { property: "og:title", content: "Configurações de Notificações — FotoPress" },
      {
        property: "og:description",
        content:
          "Configure lembretes com 15, 30, 60 minutos de antecedência e autorize notificações no navegador.",
      },
    ],
  }),
  component: NotificacoesPage,
});

export function NotificacoesPage() {
  const {
    config,
    updateConfig,
    permission,
    isSupported,
    requestNotificationPermission,
    sendTestReminder,
    upcomingReminders,
    toggleCoverageReminder,
    setCoverageLeadTime,
  } = useCoverageReminders();

  const { data: coverages = [] } = useCoverages();
  const { data: eventCoverages = [] } = useEventCoverages();
  const { data: radars = {} } = useRadars();

  const [selectedCoverage, setSelectedCoverage] = useState<Coverage | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isDelayedTesting, setIsDelayedTesting] = useState(false);

  // Canais adicionais de preferência armazenados localmente
  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyEvents, setNotifyEvents] = useState(true);
  const [notifySound, setNotifySound] = useState(true);

  const activeRemindersCount = upcomingReminders.filter((r) => r.isEnabled && !r.isPast).length;
  const totalUpcomingCount = upcomingReminders.filter((r) => !r.isPast).length;

  const handleToggleGlobalPush = async (enabled: boolean) => {
    if (enabled && permission !== "granted") {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    updateConfig({ enabled });
    if (enabled) {
      toast.success("Lembretes automáticos ativados com sucesso!");
    } else {
      toast.info("Lembretes automáticos desativados.");
    }
  };

  const handleSelectLeadTime = (val: string | number) => {
    const minutes = Number(val) as ReminderLeadTime;
    updateConfig({ defaultLeadTimeMinutes: minutes });
    toast.success(`Antecedência padrão ajustada para ${getLeadTimeLabel(minutes)}.`);
  };

  const handleDirectTest = async () => {
    setIsTesting(true);
    try {
      await sendTestReminder(0);
      toast.success("Notificação de teste enviada!");
    } catch {
      toast.error("Não foi possível enviar a notificação.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelayedTest = async () => {
    setIsDelayedTesting(true);
    try {
      await sendTestReminder(5);
      toast.info("Aguarde 5 segundos. Você pode alternar de aba para testar em segundo plano.");
    } catch {
      toast.error("Não foi possível agendar o teste.");
    } finally {
      setTimeout(() => setIsDelayedTesting(false), 2000);
    }
  };

  const handleOpenCoverage = (item: (typeof upcomingReminders)[0]) => {
    if (item.kind === "match") {
      const matchCov = coverages.find((c) => c.id === item.id);
      if (matchCov) setSelectedCoverage(matchCov);
    } else {
      const evCov = eventCoverages.find((c) => c.id === item.id);
      if (evCov?.event) setSelectedEvent(evCov.event);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header com navegação */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/configuracoes"
            className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="size-3" /> Configurações
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Notificações</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="size-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Preferências de Notificação
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure lembretes de coberturas esportivas, tempo de antecedência e permissões no
              navegador.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
              <Link to="/agenda">
                <CalendarCheck2 className="size-3.5 text-primary" />
                Minha Agenda
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
              <Link to="/configuracoes">
                <Sliders className="size-3.5" />
                Geral
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Banner de Permissão do Navegador */}
      <section
        id="notification-permission-card"
        className={cn(
          "rounded-xl border p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4",
          !isSupported
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : permission === "granted"
              ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100"
              : permission === "denied"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-primary/30 bg-primary/5 text-foreground",
        )}
      >
        <div className="flex items-start gap-3.5">
          {!isSupported ? (
            <ShieldAlert className="size-5 text-destructive shrink-0 mt-0.5" />
          ) : permission === "granted" ? (
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : permission === "denied" ? (
            <ShieldAlert className="size-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <Bell className="size-5 text-primary shrink-0 mt-0.5" />
          )}

          <div className="space-y-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              {!isSupported
                ? "Navegador incompatível com a Web Notification API"
                : permission === "granted"
                  ? "Notificações push autorizadas no navegador"
                  : permission === "denied"
                    ? "Permissão de notificações bloqueada no seu navegador"
                    : "Autorização de notificações pendente"}
              {permission === "granted" && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] py-0"
                >
                  Pronto para uso
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              {!isSupported
                ? "Este navegador não suporta a Web Notification API. Use o Google Chrome, Microsoft Edge, Firefox ou Safari atualizado para receber avisos."
                : permission === "granted"
                  ? "Seu dispositivo está liberado para emitir avisos automáticos na tela antes do início de cada cobertura confirmada."
                  : permission === "denied"
                    ? "Você bloqueou as notificações deste site. Para reativar, clique no ícone de ajustes/cadeado na barra de endereços do navegador e marque 'Permitir notificações'."
                    : "Para que o FotoPress avise você antes das partidas mesmo se você estiver em outra aba, autorize a permissão no navegador."}
            </p>
          </div>
        </div>

        {isSupported && permission !== "granted" && (
          <Button
            id="btn-authorize-browser-notifications"
            size="sm"
            onClick={requestNotificationPermission}
            className="shrink-0 text-xs font-semibold"
          >
            {permission === "denied" ? "Como desbloquear" : "Autorizar notificações"}
          </Button>
        )}
      </section>

      {/* Seção Principal de Configuração: Toggle + Antecedência */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Card 1: Toggle Geral dos Lembretes */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="master-reminder-toggle"
                    className="text-base font-semibold cursor-pointer"
                  >
                    Lembretes automáticos de coberturas
                  </Label>
                  {config.enabled && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] py-0 px-2">
                      Ativo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dispara alertas com som e vibração no computador ou smartphone antes do apito
                  inicial dos jogos e eventos agendados na sua conta.
                </p>
              </div>

              <Switch
                id="master-reminder-toggle"
                checked={config.enabled}
                onCheckedChange={handleToggleGlobalPush}
                disabled={!isSupported}
              />
            </div>

            {/* Sub-opções quando o toggle está ativo */}
            <div
              className={cn(
                "pt-4 border-t border-border space-y-4 transition-opacity",
                !config.enabled && "opacity-50 pointer-events-none",
              )}
            >
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Modalidades monitoradas
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface/40 p-3">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="size-4 text-primary" />
                    <div>
                      <div className="text-xs font-medium">Partidas de futebol</div>
                      <div className="text-[11px] text-muted-foreground">
                        Jogos confirmados na agenda
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={notifyMatches}
                    onCheckedChange={setNotifyMatches}
                    disabled={!config.enabled}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface/40 p-3">
                  <div className="flex items-center gap-2.5">
                    <CalendarCheck2 className="size-4 text-primary" />
                    <div>
                      <div className="text-xs font-medium">Outros eventos esportivos</div>
                      <div className="text-[11px] text-muted-foreground">
                        Corridas, vôlei, basquete, etc.
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={notifyEvents}
                    onCheckedChange={setNotifyEvents}
                    disabled={!config.enabled}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Tempo de Antecedência do Aviso */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <h3 className="text-base font-semibold">Tempo de Antecedência do Aviso</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha com quanto tempo de antecedência você deseja receber o alerta antes do
                horário marcado para início da partida ou evento.
              </p>
            </div>

            {/* Seletor dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-surface/50">
              <div className="space-y-0.5">
                <Label htmlFor="lead-time-select" className="text-xs font-semibold text-foreground">
                  Antecedência padrão selecionada:
                </Label>
                <div className="text-xs text-primary font-medium">
                  {getLeadTimeLabel(config.defaultLeadTimeMinutes)}
                </div>
              </div>

              <Select
                value={String(config.defaultLeadTimeMinutes)}
                onValueChange={handleSelectLeadTime}
                disabled={!config.enabled}
              >
                <SelectTrigger
                  id="lead-time-select"
                  className="w-full sm:w-[260px] h-9 text-xs bg-card"
                >
                  <SelectValue placeholder="Selecione a antecedência" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Atalhos Rápidos: 15m, 30m, 60m, 2h, 24h */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Escolha rápida de tempo de aviso:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LEAD_TIME_OPTIONS.map((opt) => {
                  const isSelected = config.defaultLeadTimeMinutes === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!config.enabled}
                      onClick={() => handleSelectLeadTime(opt.value)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary/40"
                          : "border-border bg-surface/60 text-muted-foreground hover:bg-surface hover:text-foreground",
                        !config.enabled && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span className="text-xs">{opt.shortLabel}</span>
                      {opt.value === 30 && (
                        <span className="mt-0.5 text-[9px] font-normal text-muted-foreground">
                          Recomendado
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg bg-surface/70 border border-border/70 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
              <Info className="size-4 shrink-0 text-primary mt-0.5" />
              <span>
                <strong>Dica profissional:</strong> O tempo padrão será aplicado a todas as novas
                coberturas confirmadas. Você também pode alterar o tempo individualmente na lista de
                coberturas abaixo para jogos que exijam deslocamento mais longo.
              </span>
            </div>
          </section>

          {/* Card 3: Teste de Notificação */}
          <section className="rounded-xl border border-dashed border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Volume2 className="size-4 text-primary" />
                  Testar Envio de Alerta
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Simule o recebimento de uma notificação para verificar como o alerta aparece no
                  seu monitor ou aparelho móvel.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Button
                id="btn-test-notification-direct"
                size="sm"
                variant="default"
                onClick={handleDirectTest}
                disabled={isTesting || !isSupported}
                className="gap-1.5 text-xs"
              >
                <Send className="size-3.5" />
                {isTesting ? "Emitindo alerta..." : "Testar alerta agora"}
              </Button>

              <Button
                id="btn-test-notification-delayed-5s"
                size="sm"
                variant="outline"
                onClick={handleDelayedTest}
                disabled={isDelayedTesting || !isSupported}
                className="gap-1.5 text-xs"
              >
                <Clock className="size-3.5 text-muted-foreground" />
                {isDelayedTesting ? "Aguardando 5s..." : "Testar em 5 segundos (segundo plano)"}
              </Button>
            </div>
          </section>
        </div>

        {/* Barra Lateral: Resumo de Métricas & Lembretes Ativos */}
        <div className="space-y-6">
          {/* Card de Resumo */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold">Resumo do Sistema</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-xs">
                <span className="text-muted-foreground">Estado dos lembretes:</span>
                <span
                  className={cn(
                    "font-semibold",
                    config.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500",
                  )}
                >
                  {config.enabled ? "Ativados" : "Desativados"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-xs">
                <span className="text-muted-foreground">Antecedência padrão:</span>
                <span className="font-semibold text-foreground">
                  {getLeadTimeLabel(config.defaultLeadTimeMinutes)}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-xs">
                <span className="text-muted-foreground">Lembretes programados:</span>
                <span className="font-semibold text-primary">
                  {activeRemindersCount}{" "}
                  <span className="font-normal text-muted-foreground">de {totalUpcomingCount}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Mecanismo:</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Web Notification API
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button asChild variant="secondary" size="sm" className="w-full text-xs gap-1.5">
                <Link to="/agenda">
                  <CalendarCheck2 className="size-3.5" />
                  Ir para a Minha Agenda
                </Link>
              </Button>
            </div>
          </div>

          {/* Dica de Integração com Google Agenda */}
          <div className="rounded-xl border border-border bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>Sincronização com Google Calendar</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Você também pode adicionar qualquer evento ou partida ao seu Google Agenda diretamente
              pelo botão "Adicionar ao Google Calendar" presente em cada card.
            </p>
          </div>
        </div>
      </div>

      {/* Seção: Lembretes Programados por Cobertura Individual */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Coberturas com Lembretes Individuais
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ajuste o tempo de antecedência ou desative lembretes de coberturas específicas.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {upcomingReminders.length}{" "}
            {upcomingReminders.length === 1 ? "evento agendado" : "eventos agendados"}
          </span>
        </div>

        {upcomingReminders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center bg-surface/20">
            <CalendarCheck2 className="size-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-xs font-medium text-foreground">Nenhuma cobertura agendada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Adicione partidas e eventos na Minha Agenda para visualizar e personalizar os
              lembretes aqui.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3 text-xs">
              <Link to="/jogos">Ver Jogos e Eventos</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <ul className="divide-y divide-border">
              {upcomingReminders.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-surface/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCoverage(item)}
                        className="font-semibold text-sm text-foreground hover:underline text-left truncate cursor-pointer"
                      >
                        {item.title}
                      </button>
                      <span className="rounded bg-surface px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground shrink-0 border border-border/50">
                        {item.subtitle}
                      </span>
                      {item.isNotified && (
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Disparado
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{item.venue}</span>
                      <span>·</span>
                      <span>
                        Início:{" "}
                        <strong className="text-foreground font-medium">
                          {format(item.eventDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </strong>
                      </span>
                      <span>·</span>
                      <span
                        className={cn(
                          item.isEnabled ? "text-primary font-medium" : "text-muted-foreground",
                        )}
                      >
                        Aviso previsto:{" "}
                        {format(item.reminderDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={String(item.leadTimeMinutes)}
                      onValueChange={(v) =>
                        setCoverageLeadTime(item.id, Number(v) as ReminderLeadTime)
                      }
                      disabled={!item.isEnabled || !config.enabled}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_TIME_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      variant={item.isEnabled ? "secondary" : "outline"}
                      className={cn(
                        "h-8 gap-1.5 text-xs",
                        item.isEnabled && "text-primary border-primary/30",
                      )}
                      onClick={() => toggleCoverageReminder(item.id, item.isEnabled)}
                    >
                      {item.isEnabled ? (
                        <>
                          <Bell className="size-3.5 text-primary" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <BellOff className="size-3.5 text-muted-foreground" />
                          <span>Pausado</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => handleOpenCoverage(item)}
                    >
                      Detalhes
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Sheets de detalhes das coberturas */}
      <AgendaMatchSheet
        coverage={selectedCoverage}
        radar={isRadarEnabled() && selectedCoverage ? radars[selectedCoverage.match_id] : null}
        onOpenChange={(open) => !open && setSelectedCoverage(null)}
      />

      <EventDetailSheet
        event={selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
    </div>
  );
}
