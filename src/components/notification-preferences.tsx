import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
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
  Sparkles,
} from "lucide-react";
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
} from "@/lib/coverage-reminders";
import { cn } from "@/lib/utils";

interface NotificationPreferencesProps {
  className?: string;
  showCardWrapper?: boolean;
}

export function NotificationPreferences({
  className,
  showCardWrapper = true,
}: NotificationPreferencesProps) {
  const {
    config,
    updateConfig,
    permission,
    isSupported,
    requestNotificationPermission,
    sendTestReminder,
    upcomingReminders,
  } = useCoverageReminders();

  const [isTesting, setIsTesting] = useState(false);
  const [isDelayedTesting, setIsDelayedTesting] = useState(false);

  const activeRemindersCount = upcomingReminders.filter((r) => r.isEnabled && !r.isPast).length;
  const totalUpcomingCount = upcomingReminders.filter((r) => !r.isPast).length;

  const handleToggleGlobalPush = async (enabled: boolean) => {
    if (enabled && permission !== "granted") {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }
    updateConfig({ enabled });
  };

  const handleSelectLeadTime = (val: string) => {
    const minutes = Number(val) as ReminderLeadTime;
    updateConfig({ defaultLeadTimeMinutes: minutes });
  };

  const handleDirectTest = async () => {
    setIsTesting(true);
    try {
      await sendTestReminder(0);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelayedTest = async () => {
    setIsDelayedTesting(true);
    try {
      await sendTestReminder(5);
    } finally {
      setIsDelayedTesting(false);
    }
  };

  const content = (
    <div
      id="notification-preferences-container"
      className={cn("space-y-6 text-foreground", className)}
    >
      {/* Header & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" />
            <h3 className="text-base font-semibold">Preferências de Notificações</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gerencie o envio de alertas automáticos via Web Notification API para as coberturas
            esportivas agendadas na sua conta.
          </p>
        </div>

        {/* Status da Permissão do Navegador */}
        <div className="shrink-0">
          {!isSupported ? (
            <Badge
              variant="outline"
              className="border-destructive/30 text-destructive bg-destructive/10 text-xs"
            >
              <ShieldAlert className="size-3.5 mr-1" />
              Navegador não suportado
            </Badge>
          ) : permission === "granted" ? (
            <Badge
              variant="outline"
              className="border-comp-green/40 text-comp-green bg-comp-green/10 text-xs py-1"
            >
              <ShieldCheck className="size-3.5 mr-1" />
              Notificações ativas no navegador
            </Badge>
          ) : permission === "denied" ? (
            <Badge
              variant="outline"
              className="border-destructive/40 text-destructive bg-destructive/10 text-xs py-1"
            >
              <ShieldAlert className="size-3.5 mr-1" />
              Bloqueado no navegador
            </Badge>
          ) : (
            <Button
              id="btn-request-notification-permission"
              size="sm"
              variant="outline"
              onClick={() => requestNotificationPermission()}
              className="h-8 text-xs border-comp-yellow/50 text-comp-yellow hover:bg-comp-yellow/10"
            >
              <Bell className="size-3.5 mr-1.5" />
              Autorizar no Navegador
            </Button>
          )}
        </div>
      </div>

      {/* Chave de Notificações Push para Eventos Agendados */}
      <div
        id="scheduled-events-push-setting"
        className="rounded-lg border border-border/80 bg-surface/50 p-4 transition-colors hover:bg-surface/80"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="toggle-scheduled-events-push"
                className="text-sm font-medium cursor-pointer"
              >
                Notificações push para eventos agendados
              </Label>
              {config.enabled && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Dispara lembretes de cobertura com vibração e alerta no desktop ou celular antes do
              início das partidas confirmadas na sua agenda.
            </p>
          </div>
          <Switch
            id="toggle-scheduled-events-push"
            checked={config.enabled}
            onCheckedChange={handleToggleGlobalPush}
            disabled={!isSupported}
          />
        </div>

        {permission === "denied" && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive border border-destructive/20">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>
              As notificações foram bloqueadas nas permissões do seu navegador. Clique no cadeado na
              barra de endereço e permita notificações para o FotoPress.
            </span>
          </div>
        )}
      </div>

      {/* Configuração de Antecedência do Lembrete (30 min padrão) */}
      <div
        id="notification-lead-time-setting"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center rounded-lg border border-border/80 bg-surface/50 p-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary" />
            <Label htmlFor="select-default-lead-time" className="text-sm font-medium">
              Antecedência padrão do alerta
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Momento exato antes do horário de início do evento em que a notificação será disparada.
          </p>
        </div>

        <div className="sm:text-right">
          <Select
            value={String(config.defaultLeadTimeMinutes)}
            onValueChange={handleSelectLeadTime}
            disabled={!config.enabled}
          >
            <SelectTrigger
              id="select-default-lead-time"
              className="w-full sm:w-[240px] ml-auto h-9 text-xs"
            >
              <SelectValue placeholder="Selecione o tempo" />
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
      </div>

      {/* Resumo de Coberturas Monitoradas & Atalhos */}
      <div id="notification-monitoring-summary" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/80 bg-card p-3.5 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarCheck2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Lembretes monitorados</div>
            <div className="text-sm font-semibold">
              {activeRemindersCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                de {totalUpcomingCount} eventos próximos
              </span>
            </div>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs">
            <Link to="/agenda" title="Ir para a Minha Agenda">
              Agenda
              <ExternalLink className="size-3 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-3.5 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-comp-green/10 text-comp-green">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Disparo automático</div>
            <div className="text-sm font-semibold">Web Notification API</div>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs">
            <Link to="/alertas" title="Acessar painel de lembretes">
              Painel
              <ExternalLink className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Teste de Notificações */}
      <div
        id="notification-testing-section"
        className="rounded-lg border border-dashed border-border/90 bg-surface/30 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Teste de Notificação Push
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envie um alerta de simulação de 30 minutos antes para validar a exibição do alerta na
              sua tela.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            id="btn-test-notification-now"
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleDirectTest}
            disabled={isTesting || !isSupported}
            className="h-8 text-xs gap-1.5"
          >
            <Send className="size-3.5" />
            {isTesting ? "Enviando alerta..." : "Testar alerta agora"}
          </Button>

          <Button
            id="btn-test-notification-delayed"
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDelayedTest}
            disabled={isDelayedTesting || !isSupported}
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Clock className="size-3.5" />
            {isDelayedTesting ? "Aguarde 5s..." : "Testar em 5 segundos (segundo plano)"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!showCardWrapper) {
    return content;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">{content}</div>
  );
}
