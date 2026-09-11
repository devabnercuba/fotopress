import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarCheck,
  Check,
  Clock,
  ExternalLink,
  Info,
  ShieldAlert,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  LEAD_TIME_OPTIONS,
  useCoverageReminders,
  type ReminderLeadTime,
} from "@/lib/coverage-reminders";
import { cn } from "@/lib/utils";

interface CoverageRemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoverageRemindersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
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

  const [isTesting, setIsTesting] = useState(false);

  const isGranted = permission === "granted";
  const isDenied = permission === "denied";

  const handleTest = async (delaySeconds: number) => {
    setIsTesting(true);
    await sendTestReminder(delaySeconds);
    setTimeout(() => setIsTesting(false), 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BellRing className="size-4" />
            </span>
            <DialogTitle className="text-xl">Lembretes de Coberturas Agendadas</DialogTitle>
          </div>
          <DialogDescription>
            Receba notificações push no seu navegador e celular antes do início dos jogos e eventos
            agendados na sua rotina.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Status da Permissão de Notificações do Navegador */}
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
              isGranted
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200"
                : isDenied
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200"
                  : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-3">
              {isGranted ? (
                <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isDenied ? (
                <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <Bell className="size-5 text-primary shrink-0" />
              )}
              <div>
                <div className="text-sm font-semibold">
                  {isGranted
                    ? "Notificações do navegador autorizadas"
                    : isDenied
                      ? "Notificações bloqueadas no navegador"
                      : "Permissão de notificações pendente"}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isGranted
                    ? "O FotoPress pode emitir alertas push antes das suas partidas mesmo em segundo plano."
                    : isDenied
                      ? "Para receber os alertas, clique no cadeado da barra de endereço e autorize as notificações."
                      : "Clique no botão para autorizar o recebimento de alertas das suas partidas."}
                </p>
              </div>
            </div>

            {!isGranted && (
              <Button
                size="sm"
                onClick={requestNotificationPermission}
                className="shrink-0 text-xs"
              >
                Autorizar notificações
              </Button>
            )}
          </div>

          {/* Configurações Gerais */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label
                  htmlFor="master-reminders-toggle"
                  className="text-sm font-semibold cursor-pointer"
                >
                  Ativar lembretes para coberturas agendadas
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dispara um alerta push informando horário, local e confronto da partida.
                </p>
              </div>
              <Switch
                id="master-reminders-toggle"
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border">
              <div>
                <Label className="text-xs font-medium">Antecedência padrão dos alertas</Label>
                <p className="text-[11px] text-muted-foreground">
                  Tempo antes do início para receber o aviso.
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
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border bg-surface/40 -mx-4 -mb-4 p-4 rounded-b-xl">
              <div className="text-xs">
                <span className="font-semibold text-foreground">Testar recebimento</span>
                <p className="text-muted-foreground text-[11px]">
                  Simule um alerta de cobertura para verificar no seu sistema.
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
                  title="Permite minimizar o navegador para testar a notificação em segundo plano"
                >
                  <Clock className="size-3.5" />
                  Testar em 5s (em 2º plano)
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Coberturas Agendadas com Lembretes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Próximas Coberturas ({upcomingReminders.length})
                </h3>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs gap-1 h-7">
                <Link to="/agenda" onClick={() => onOpenChange(false)}>
                  <span>Ver Minha Agenda</span>
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            </div>

            {upcomingReminders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <Info className="size-6 mx-auto mb-2 opacity-50" />
                <p>Nenhuma cobertura aprovada no momento.</p>
                <p className="mt-1">
                  Ao aprovar jogos ou eventos na Minha Agenda, seus lembretes aparecerão aqui.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {upcomingReminders.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs hover:bg-surface/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{item.title}</span>
                        <span className="rounded bg-surface px-1.5 py-0.2 text-[10px] text-muted-foreground shrink-0">
                          {item.subtitle}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2">
                        <span>{item.venue}</span>
                        <span>·</span>
                        <span className="font-medium text-foreground">
                          Início: {format(item.eventDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span>·</span>
                        <span className="text-primary font-medium">
                          Alerta: {format(item.reminderDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
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
                        <SelectTrigger className="w-32 h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_TIME_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                              className="text-xs"
                            >
                              {opt.shortLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="icon"
                        variant={item.isEnabled ? "secondary" : "ghost"}
                        className={cn(
                          "size-7",
                          item.isEnabled ? "text-primary" : "text-muted-foreground",
                        )}
                        onClick={() => toggleCoverageReminder(item.id, item.isEnabled)}
                        title={
                          item.isEnabled ? "Desativar lembrete desta cobertura" : "Ativar lembrete"
                        }
                      >
                        {item.isEnabled ? (
                          <Bell className="size-3.5" />
                        ) : (
                          <BellOff className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
