import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  ExternalLink,
  Info,
  MessageCircle,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LEAD_TIME_OPTIONS,
  useCoverageReminders,
  type ReminderLeadTime,
} from "@/lib/coverage-reminders";
import { AgendaMatchSheet } from "@/components/agenda-match-sheet";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { useCoverages, type Coverage } from "@/lib/coverages";
import { useEventCoverages, type SportEvent } from "@/lib/events";
import { isRadarEnabled } from "@/lib/features";
import { useRadars } from "@/lib/radar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({
    meta: [
      { title: "Lembretes e Alertas — FotoPress" },
      {
        name: "description",
        content:
          "Gerencie os lembretes push automáticos antes do início das suas coberturas esportivas agendadas.",
      },
      { property: "og:title", content: "Lembretes e Alertas — FotoPress" },
      {
        property: "og:description",
        content:
          "Receba avisos push das coberturas agendadas com antecedência configurável no navegador e celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AlertasPage,
});

const UPCOMING_ROADMAP = [
  {
    icon: CalendarClock,
    title: "Jogos da semana",
    text: "Resumo semanal automático com as coberturas confirmadas para os próximos 7 dias.",
  },
  {
    icon: BellRing,
    title: "Prazos de credenciamento",
    text: "Avisos antes do encerramento do período de envio de pedidos para federações e clubes.",
  },
  {
    icon: Users,
    title: "Follow-up de atletas e clientes",
    text: "Lembrete automático para enviar prévias e fotos para contatos que contrataram a cobertura.",
  },
  {
    icon: MessageCircle,
    title: "Notificações no WhatsApp",
    text: "Receba lembretes diretamente pelo WhatsApp da sua equipe ou fotógrafo.",
  },
  {
    icon: Radar,
    title: "Radar da partida",
    text: "Alertas de desfalques, escalações e informações meteorológicas antes de ir a campo.",
  },
  {
    icon: Sparkles,
    title: "Regras inteligentes",
    text: "Defina gatilhos baseados em distância, clima e importância da partida.",
  },
];

function AlertasPage() {
  const {
    config,
    updateConfig,
    permission,
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

  const isGranted = permission === "granted";
  const isDenied = permission === "denied";

  const handleTest = async (delaySeconds: number) => {
    setIsTesting(true);
    await sendTestReminder(delaySeconds);
    setTimeout(() => setIsTesting(false), 1000);
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

  const activeRemindersCount = upcomingReminders.filter((i) => i.isEnabled).length;
  const nextReminder = upcomingReminders.find((i) => i.isEnabled && !i.isPast);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BellRing className="size-4" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Lembretes & Alertas</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Receba notificações push no seu dispositivo antes do início de cada cobertura agendada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link to="/agenda">
              <CalendarCheck className="size-3.5 text-primary" />
              <span>Minha Agenda</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleTest(5)}
            disabled={isTesting}
            className="gap-1.5 text-xs"
            title="Dispara uma notificação de teste em 5 segundos"
          >
            <Clock className="size-3.5" />
            <span>Testar em 5s</span>
          </Button>
        </div>
      </header>

      {/* Banner de Permissão do Navegador */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition-colors",
          isGranted
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
            : isDenied
              ? "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
              : "border-primary/30 bg-primary/5 text-foreground",
        )}
      >
        <div className="flex items-start gap-3">
          {isGranted ? (
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : isDenied ? (
            <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Bell className="size-5 text-primary shrink-0 mt-0.5 animate-bounce" />
          )}
          <div>
            <div className="text-sm font-semibold">
              {isGranted
                ? "Notificações push ativas e autorizadas"
                : isDenied
                  ? "Permissão de notificações bloqueada no seu navegador"
                  : "Autorize as notificações push do FotoPress"}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              {isGranted
                ? "Seu dispositivo está pronto para receber alertas automáticos de partidas e eventos antes do apito inicial."
                : isDenied
                  ? "As notificações foram bloqueadas. Para receber avisos, clique no ícone de cadeado na barra de endereços do navegador e permita as notificações."
                  : "Para ser avisado com antecedência antes de cada partida, clique no botão ao lado para autorizar o recebimento de alertas."}
            </p>
          </div>
        </div>

        {!isGranted && (
          <Button
            size="sm"
            onClick={requestNotificationPermission}
            className="shrink-0 text-xs font-semibold"
          >
            {isDenied ? "Verificar permissão" : "Autorizar notificações"}
          </Button>
        )}
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Coberturas Agendadas</div>
          <div className="text-2xl font-bold mt-1 text-foreground">{upcomingReminders.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Partidas e eventos confirmados na agenda
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Lembretes Ativos</div>
          <div className="text-2xl font-bold mt-1 text-primary">{activeRemindersCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {config.enabled ? "Sistema de alertas ligado" : "Alertas pausados globalmente"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Próximo Alerta Previsto</div>
          <div className="text-sm font-bold mt-1 truncate text-foreground">
            {nextReminder
              ? format(nextReminder.reminderDate, "dd/MM 'às' HH:mm", { locale: ptBR })
              : "Nenhum no momento"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {nextReminder ? nextReminder.title : "Adicione partidas à agenda"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="lembretes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lembretes" className="gap-2">
            <Bell className="size-3.5" />
            <span>Lembretes de Coberturas</span>
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-2">
            <Sparkles className="size-3.5" />
            <span>Próximos Alertas (Roadmap)</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Gestão de Lembretes */}
        <TabsContent value="lembretes" className="space-y-6 mt-0">
          {/* Configuração Geral */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Label
                  htmlFor="page-master-toggle"
                  className="text-sm font-semibold cursor-pointer"
                >
                  Disparar lembretes push automaticamente
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Emite alertas no navegador e celular antes do horário agendado de cada cobertura.
                </p>
              </div>
              <Switch
                id="page-master-toggle"
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border">
              <div>
                <Label className="text-xs font-semibold">Antecedência padrão dos lembretes</Label>
                <p className="text-[11px] text-muted-foreground">
                  Tempo antes do início para receber o aviso (pode ser personalizado por partida).
                </p>
              </div>
              <Select
                value={String(config.defaultLeadTimeMinutes)}
                onValueChange={(v) =>
                  updateConfig({ defaultLeadTimeMinutes: Number(v) as ReminderLeadTime })
                }
              >
                <SelectTrigger className="w-48 text-xs">
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
            </div>

            {/* Teste de Notificação */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border bg-surface/50 -mx-5 -mb-5 p-4 rounded-b-xl">
              <div className="text-xs">
                <span className="font-semibold text-foreground">Testar envio de lembrete</span>
                <p className="text-muted-foreground text-[11px]">
                  Verifique como o lembrete aparece no seu sistema operacional.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest(0)}
                  disabled={isTesting}
                  className="text-xs gap-1.5"
                >
                  <Volume2 className="size-3.5" />
                  Testar agora
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleTest(5)}
                  disabled={isTesting}
                  className="text-xs gap-1.5"
                  title="Permite minimizar a tela para testar o recebimento em segundo plano"
                >
                  <Clock className="size-3.5" />
                  Testar em 5s (em 2º plano)
                </Button>
              </div>
            </div>
          </section>

          {/* Tabela / Lista de Lembretes Agendados */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Coberturas Agendadas e Lembretes Programados
              </h2>
              <span className="text-xs text-muted-foreground">
                {upcomingReminders.length}{" "}
                {upcomingReminders.length === 1 ? "cobertura" : "coberturas"}
              </span>
            </div>

            {upcomingReminders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card">
                <CalendarCheck className="size-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <h3 className="text-sm font-medium text-foreground">
                  Nenhuma cobertura na Minha Agenda
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Aprove jogos ou eventos na listagem para agendar coberturas. Os lembretes push
                  serão configurados automaticamente para cada uma.
                </p>
                <Button asChild size="sm" className="mt-4 text-xs">
                  <Link to="/jogos">Ver Jogos e Eventos</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <ul className="divide-y divide-border">
                  {upcomingReminders.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-surface/50 transition-colors"
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
                          <span className="rounded bg-surface px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground shrink-0">
                            {item.subtitle}
                          </span>
                          {item.isNotified && (
                            <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Lembrete enviado
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1">
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
                            Disparo do alerta:{" "}
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
                          disabled={!item.isEnabled}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_TIME_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={String(opt.value)}
                                className="text-xs"
                              >
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
                          title={
                            item.isEnabled
                              ? "Desativar lembrete desta cobertura"
                              : "Ativar lembrete desta cobertura"
                          }
                        >
                          {item.isEnabled ? (
                            <>
                              <Bell className="size-3.5 text-primary" />
                              <span>Ativo</span>
                            </>
                          ) : (
                            <>
                              <BellOff className="size-3.5 text-muted-foreground" />
                              <span>Desativado</span>
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => handleOpenCoverage(item)}
                          title="Ver detalhes da cobertura"
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
        </TabsContent>

        {/* Tab 2: Próximos Alertas (Roadmap) */}
        <TabsContent value="roadmap" className="mt-0 space-y-4">
          <div className="rounded-xl border border-dashed border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Central de Alertas em Evolução</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Além dos lembretes push antes do evento (já operacionais nesta página), estamos
              preparando novos módulos de automação inteligente para o FotoPress.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING_ROADMAP.map((item) => (
              <article
                key={item.title}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
                    <item.icon className="size-4" />
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Em breve
                  </span>
                </div>
                <h4 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheets de detalhes das partidas/eventos */}
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
