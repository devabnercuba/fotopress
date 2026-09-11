import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { showSystemNotification, registerServiceWorker } from "./push-notifications";
import { useCoverages, useCoverageMutations, type Coverage } from "./coverages";
import { useEventCoverages, useEventCoverageMutations, type EventCoverage } from "./events";

export type ReminderLeadTime = 15 | 30 | 60 | 120 | 1440;

export const LEAD_TIME_OPTIONS: { value: ReminderLeadTime; label: string; shortLabel: string }[] = [
  { value: 15, label: "15 minutos antes", shortLabel: "15m antes" },
  { value: 30, label: "30 minutos antes (recomendado)", shortLabel: "30m antes" },
  { value: 60, label: "1 hora antes", shortLabel: "1h antes" },
  { value: 120, label: "2 horas antes", shortLabel: "2h antes" },
  { value: 1440, label: "24 horas antes (1 dia)", shortLabel: "1 dia antes" },
];

export function getLeadTimeLabel(minutes: ReminderLeadTime | number): string {
  const match = LEAD_TIME_OPTIONS.find((o) => o.value === minutes);
  if (match) return match.label;
  if (minutes < 60) return `${minutes} minutos antes`;
  const hours = Math.round(minutes / 60);
  return `${hours} hora${hours > 1 ? "s" : ""} antes`;
}

export function getLeadTimeShortLabel(minutes: ReminderLeadTime | number): string {
  const match = LEAD_TIME_OPTIONS.find((o) => o.value === minutes);
  if (match) return match.shortLabel;
  if (minutes < 60) return `${minutes}m antes`;
  const hours = Math.round(minutes / 60);
  return `${hours}h antes`;
}

export interface ReminderConfig {
  enabled: boolean;
  defaultLeadTimeMinutes: ReminderLeadTime;
  /** Custom lead times per coverage ID */
  customLeadTimes: Record<string, ReminderLeadTime>;
  /** Explicitly disabled coverage IDs */
  disabledCoverageIds: string[];
}

const REMINDER_CONFIG_KEY = "fotopress:coverage_reminders_config";
const NOTIFIED_KEYS_KEY = "fotopress:notified_reminders_keys";

export function getStoredReminderConfig(): ReminderConfig {
  if (typeof window === "undefined") {
    return {
      enabled: true,
      defaultLeadTimeMinutes: 30,
      customLeadTimes: {},
      disabledCoverageIds: [],
    };
  }

  try {
    const raw = window.localStorage.getItem(REMINDER_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? true,
        defaultLeadTimeMinutes: parsed.defaultLeadTimeMinutes ?? 30,
        customLeadTimes: parsed.customLeadTimes ?? {},
        disabledCoverageIds: parsed.disabledCoverageIds ?? [],
      };
    }
  } catch (err) {
    console.error("Erro ao ler configuração de lembretes:", err);
  }

  return {
    enabled: true,
    defaultLeadTimeMinutes: 30,
    customLeadTimes: {},
    disabledCoverageIds: [],
  };
}

export function saveStoredReminderConfig(config: ReminderConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMINDER_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("fotopress:reminders_config_updated", { detail: config }));
  } catch (err) {
    console.error("Erro ao salvar configuração de lembretes:", err);
  }
}

export function getNotifiedKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEYS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

export function markReminderAsNotified(key: string) {
  if (typeof window === "undefined") return;
  try {
    const map = getNotifiedKeys();
    map[key] = new Date().toISOString();
    window.localStorage.setItem(NOTIFIED_KEYS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Calcula a data e hora de início do evento e a data/hora exata do lembrete.
 */
export function getCoverageEventDates(
  dateStr: string,
  timeStr?: string | null,
  leadTimeMinutes: number = 30,
): { eventDate: Date; reminderDate: Date } | null {
  try {
    const cleanTime = timeStr ? timeStr.slice(0, 5) : "12:00";
    const [hours, mins] = cleanTime.split(":").map(Number);
    const eventDate = parseISO(dateStr);
    eventDate.setHours(hours || 0, mins || 0, 0, 0);

    if (isNaN(eventDate.getTime())) return null;

    const reminderDate = new Date(eventDate.getTime() - leadTimeMinutes * 60 * 1000);
    return { eventDate, reminderDate };
  } catch {
    return null;
  }
}

export interface UpcomingCoverageAlertOptions {
  title: string;
  venue?: string;
  city?: string;
  startTime?: string | null;
  startDate?: string;
  leadTimeMinutes?: number; // padrão 30
  coverageId?: string;
  url?: string;
}

/**
 * Função utilitária que utiliza a Web Notification API para enviar alertas
 * lembrando o usuário de uma cobertura próxima, disparando 30 minutos antes do horário de início do evento.
 */
export async function sendUpcomingCoverageNotification(
  options: UpcomingCoverageAlertOptions,
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Web Notification API não suportada neste navegador.");
    return false;
  }

  // Verifica permissão da Web Notification API
  if (Notification.permission !== "granted") {
    console.warn("Permissão da Web Notification API não foi concedida.");
    return false;
  }

  const leadMinutes = options.leadTimeMinutes ?? 30;
  const leadLabel = leadMinutes === 30 ? "30 minutos" : `${leadMinutes} minutos`;
  const timeFormatted = options.startTime ? options.startTime.slice(0, 5) : "";
  const location = [options.venue, options.city].filter(Boolean).join(" · ");
  const locationText = location ? ` no ${location}` : "";
  const timeText = timeFormatted ? ` às ${timeFormatted}` : "";

  const title = options.title.startsWith("⏰")
    ? options.title
    : `⏰ Lembrete de Cobertura: ${options.title}`;

  const body = `Sua cobertura agendada começa em ${leadLabel}${timeText}${locationText}. Prepare credenciais, colete e equipamentos!`;
  const targetUrl = options.url || "/agenda";
  const tag = options.coverageId
    ? `coverage-reminder-${options.coverageId}`
    : "coverage-reminder-30m";

  try {
    // 1. Tenta via Service Worker Registration (Web Notification API em SW)
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag,
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url: targetUrl, type: "COVERAGE_REMINDER", coverageId: options.coverageId },
        } as NotificationOptions);
        return true;
      }
    }

    // 2. Web Notification API nativa padrão da Window
    const notification = new Notification(title, {
      body,
      icon: "/favicon.png",
      tag,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = targetUrl;
      notification.close();
    };

    return true;
  } catch (err) {
    console.error("Erro ao enviar alerta via Web Notification API:", err);
    return false;
  }
}

/**
 * Agenda um lembrete para disparar exatamente 30 minutos antes do evento utilizando a Web Notification API.
 */
export function schedule30MinCoverageReminder(
  options: UpcomingCoverageAlertOptions,
  onTriggered?: () => void,
): (() => void) | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;

  const dates = options.startDate
    ? getCoverageEventDates(options.startDate, options.startTime, options.leadTimeMinutes ?? 30)
    : null;

  if (!dates) return null;

  const delayMs = dates.reminderDate.getTime() - Date.now();

  if (delayMs <= 0) {
    if (Date.now() <= dates.eventDate.getTime() + 30 * 60 * 1000) {
      sendUpcomingCoverageNotification(options);
      onTriggered?.();
    }
    return null;
  }

  const timerId = window.setTimeout(async () => {
    await sendUpcomingCoverageNotification(options);
    onTriggered?.();
  }, delayMs);

  return () => window.clearTimeout(timerId);
}

export interface UpcomingReminderItem {
  id: string;
  kind: "match" | "event";
  title: string;
  subtitle: string;
  venue: string;
  eventDate: Date;
  reminderDate: Date;
  leadTimeMinutes: ReminderLeadTime;
  isEnabled: boolean;
  isNotified: boolean;
  isPast: boolean;
}

/**
 * Hook para gerenciar configurações e estado de lembretes de cobertura.
 */
export function useCoverageReminders() {
  const [config, setConfig] = useState<ReminderConfig>(getStoredReminderConfig);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const { data: coverages = [] } = useCoverages();
  const { data: eventCoverages = [] } = useEventCoverages();
  const coverageMutations = useCoverageMutations();
  const eventCoverageMutations = useEventCoverageMutations();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "Notification" in window && "serviceWorker" in navigator;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }

    const handleUpdate = () => {
      setConfig(getStoredReminderConfig());
    };

    window.addEventListener("fotopress:reminders_config_updated", handleUpdate);
    return () => {
      window.removeEventListener("fotopress:reminders_config_updated", handleUpdate);
    };
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notificações não são suportadas neste navegador.");
      return false;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        await registerServiceWorker();
        toast.success("Notificações push autorizadas com sucesso!");
        return true;
      } else if (res === "denied") {
        toast.error("Permissão de notificações bloqueada no seu navegador.");
        return false;
      }
    } catch (err) {
      console.error("Erro ao solicitar permissão:", err);
    }
    return false;
  }, []);

  const updateConfig = useCallback((patch: Partial<ReminderConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveStoredReminderConfig(next);
      return next;
    });
  }, []);

  /**
   * Alterna o status do lembrete de uma cobertura, sincronizando tanto no banco de dados
   * (campo reminder_enabled) quanto no estado local do dispositivo.
   */
  const toggleCoverageReminder = useCallback(
    async (coverageId: string, currentEnabled: boolean, kind: "match" | "event" = "match") => {
      const nextState = !currentEnabled;

      // Se for ativar e o navegador ainda não autorizou, solicita autorização
      if (nextState && permission !== "granted") {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }

      // 1. Sincroniza no banco de dados Supabase via mutation
      if (kind === "event") {
        eventCoverageMutations.setReminderEnabled.mutate({ id: coverageId, enabled: nextState });
      } else {
        coverageMutations.setReminderEnabled.mutate({ id: coverageId, enabled: nextState });
      }

      // 2. Sincroniza localmente
      setConfig((prev) => {
        let newDisabled = [...prev.disabledCoverageIds];
        if (!nextState) {
          if (!newDisabled.includes(coverageId)) newDisabled.push(coverageId);
        } else {
          newDisabled = newDisabled.filter((id) => id !== coverageId);
        }
        const next = { ...prev, disabledCoverageIds: newDisabled };
        saveStoredReminderConfig(next);
        return next;
      });

      if (nextState) {
        toast.success("Lembrete ativado! Você receberá alerta 30 minutos antes do evento.", {
          duration: 3000,
        });
      } else {
        toast.info("Lembrete desativado para esta cobertura.", { duration: 2500 });
      }
    },
    [permission, requestNotificationPermission, coverageMutations, eventCoverageMutations],
  );

  const setCoverageLeadTime = useCallback((coverageId: string, leadTime: ReminderLeadTime) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        customLeadTimes: {
          ...prev.customLeadTimes,
          [coverageId]: leadTime,
        },
      };
      saveStoredReminderConfig(next);
      return next;
    });
  }, []);

  const isCoverageReminderActive = useCallback(
    (coverageId: string, itemReminderEnabled?: boolean | null): boolean => {
      if (!config.enabled) return false;
      if (itemReminderEnabled === false) return false;
      return !config.disabledCoverageIds.includes(coverageId);
    },
    [config.enabled, config.disabledCoverageIds],
  );

  const getCoverageLeadTime = useCallback(
    (coverageId: string): ReminderLeadTime => {
      return config.customLeadTimes[coverageId] ?? config.defaultLeadTimeMinutes;
    },
    [config.customLeadTimes, config.defaultLeadTimeMinutes],
  );

  /**
   * Envia uma notificação de teste imediata ou com atraso de X segundos utilizando a Web Notification API.
   */
  const sendTestReminder = useCallback(
    async (delaySeconds: number = 0) => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        toast.error("Notificações não são suportadas neste navegador.");
        return;
      }

      if (Notification.permission !== "granted") {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }

      const sampleTitle = "⏰ Lembrete de Cobertura (30 min antes)";
      const sampleBody = `Flamengo × Fluminense começa em 30 minutos no Maracanã. Prepare seu crachá e equipamentos!`;

      if (delaySeconds > 0) {
        toast.info(
          `Lembrete de teste agendado para daqui a ${delaySeconds}s! Você pode minimizar ou trocar de aba.`,
          { duration: 5000 },
        );

        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SCHEDULE_COVERAGE_REMINDER",
            delay: delaySeconds * 1000,
            title: sampleTitle,
            body: sampleBody,
            url: "/agenda",
            data: { url: "/agenda", type: "COVERAGE_REMINDER" },
          });
        } else {
          setTimeout(() => {
            sendUpcomingCoverageNotification({
              title: "Flamengo × Fluminense",
              venue: "Maracanã",
              startTime: "16:00",
              leadTimeMinutes: 30,
              url: "/agenda",
            });
          }, delaySeconds * 1000);
        }
      } else {
        const sent = await sendUpcomingCoverageNotification({
          title: "Flamengo × Fluminense",
          venue: "Maracanã",
          startTime: "16:00",
          leadTimeMinutes: 30,
          url: "/agenda",
        });

        if (sent) {
          toast.success("Notificação enviada via Web Notification API! Clique nela para abrir.");
        }
      }
    },
    [requestNotificationPermission],
  );

  /**
   * Lista unificada e calculada de todos os lembretes de coberturas agendadas.
   */
  const upcomingReminders = useMemo<UpcomingReminderItem[]>(() => {
    const list: UpcomingReminderItem[] = [];
    const notifiedMap = getNotifiedKeys();
    const now = new Date();

    // Partidas aprovadas não concluídas
    for (const c of coverages) {
      if (c.credential_status !== "approved" || c.completed_at || !c.match) continue;
      const m = c.match;
      const leadTime = config.customLeadTimes[c.id] ?? config.defaultLeadTimeMinutes;
      const isEnabled =
        config.enabled &&
        c.reminder_enabled !== false &&
        !config.disabledCoverageIds.includes(c.id);
      const dates = getCoverageEventDates(m.date, m.time, leadTime);
      if (!dates) continue;

      const notificationKey = `match_${c.id}_${m.date}_${m.time}_${leadTime}`;
      const isNotified = !!notifiedMap[notificationKey];
      const isPast = dates.eventDate.getTime() < now.getTime();

      list.push({
        id: c.id,
        kind: "match",
        title: `${m.home_team} × ${m.away_team}`,
        subtitle: m.competition?.name || "Partida esportiva",
        venue: [m.venue, m.city, m.state].filter(Boolean).join(" · ") || "Local a definir",
        eventDate: dates.eventDate,
        reminderDate: dates.reminderDate,
        leadTimeMinutes: leadTime,
        isEnabled,
        isNotified,
        isPast,
      });
    }

    // Eventos aprovados não concluídos
    for (const c of eventCoverages) {
      if (c.credential_status !== "approved" || c.completed_at || !c.event) continue;
      const e = c.event;
      const leadTime = config.customLeadTimes[c.id] ?? config.defaultLeadTimeMinutes;
      const isEnabled =
        config.enabled &&
        c.reminder_enabled !== false &&
        !config.disabledCoverageIds.includes(c.id);
      const dates = getCoverageEventDates(e.start_date, e.start_time, leadTime);
      if (!dates) continue;

      const notificationKey = `event_${c.id}_${e.start_date}_${e.start_time || ""}_${leadTime}`;
      const isNotified = !!notifiedMap[notificationKey];
      const isPast = dates.eventDate.getTime() < now.getTime();

      list.push({
        id: c.id,
        kind: "event",
        title: e.name,
        subtitle: e.sport ? e.sport.toUpperCase() : "Evento esportivo",
        venue: [e.venue, e.city, e.state].filter(Boolean).join(" · ") || "Local a definir",
        eventDate: dates.eventDate,
        reminderDate: dates.reminderDate,
        leadTimeMinutes: leadTime,
        isEnabled,
        isNotified,
        isPast,
      });
    }

    // Ordena pelo horário do lembrete (mais próximos primeiro)
    return list.sort((a, b) => a.reminderDate.getTime() - b.reminderDate.getTime());
  }, [coverages, eventCoverages, config]);

  return {
    config,
    updateConfig,
    isSupported,
    permission,
    requestNotificationPermission,
    toggleCoverageReminder,
    setCoverageLeadTime,
    isCoverageReminderActive,
    getCoverageLeadTime,
    sendTestReminder,
    upcomingReminders,
  };
}

/**
 * Daemon / Serviço de monitoramento em segundo plano que roda no app layout.
 * Checa a cada 30 segundos se alguma cobertura agendada atingiu o momento de lembrete
 * (por padrão 30 minutos antes) e envia a notificação utilizando a Web Notification API.
 */
export function useCoverageRemindersDaemon() {
  const { data: coverages = [] } = useCoverages();
  const { data: eventCoverages = [] } = useEventCoverages();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Registra o Service Worker assim que possível para garantir suporte push
    registerServiceWorker();

    const checkReminders = () => {
      const config = getStoredReminderConfig();
      if (!config.enabled) return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

      const now = Date.now();
      const notifiedMap = getNotifiedKeys();

      // Checa partidas
      for (const c of coverages) {
        if (c.credential_status !== "approved" || c.completed_at || !c.match) continue;
        if (c.reminder_enabled === false) continue;
        if (config.disabledCoverageIds.includes(c.id)) continue;

        const m = c.match;
        const leadTime = config.customLeadTimes[c.id] ?? config.defaultLeadTimeMinutes;
        const dates = getCoverageEventDates(m.date, m.time, leadTime);
        if (!dates) continue;

        const reminderTimestamp = dates.reminderDate.getTime();
        const eventTimestamp = dates.eventDate.getTime();

        // Dispara se estamos no intervalo entre o horário do lembrete e até 30 minutos após o início do jogo
        const isTimeForReminder =
          now >= reminderTimestamp && now <= eventTimestamp + 30 * 60 * 1000;
        const notificationKey = `match_${c.id}_${m.date}_${m.time}_${leadTime}`;

        if (isTimeForReminder && !notifiedMap[notificationKey]) {
          markReminderAsNotified(notificationKey);

          const timeLabel = getLeadTimeLabel(leadTime);
          const title = `⏰ Lembrete: ${m.home_team} × ${m.away_team}`;
          const body = `Início às ${m.time.slice(0, 5)} (${timeLabel}) no ${m.venue || m.city || "estádio"}. Prepare suas credenciais e equipamentos!`;

          // Dispara via Web Notification API utilitária
          sendUpcomingCoverageNotification({
            title: `${m.home_team} × ${m.away_team}`,
            venue: m.venue || m.city || "estádio",
            city: m.city || undefined,
            startTime: m.time,
            startDate: m.date,
            leadTimeMinutes: leadTime,
            coverageId: c.id,
            url: "/agenda",
          });

          // Mostra aviso na interface também caso o usuário esteja com a aba em foco
          toast.info(title, {
            description: body,
            duration: 8000,
          });
        }
      }

      // Checa eventos genéricos
      for (const c of eventCoverages) {
        if (c.credential_status !== "approved" || c.completed_at || !c.event) continue;
        if (c.reminder_enabled === false) continue;
        if (config.disabledCoverageIds.includes(c.id)) continue;

        const e = c.event;
        const leadTime = config.customLeadTimes[c.id] ?? config.defaultLeadTimeMinutes;
        const dates = getCoverageEventDates(e.start_date, e.start_time, leadTime);
        if (!dates) continue;

        const reminderTimestamp = dates.reminderDate.getTime();
        const eventTimestamp = dates.eventDate.getTime();

        const isTimeForReminder =
          now >= reminderTimestamp && now <= eventTimestamp + 30 * 60 * 1000;
        const notificationKey = `event_${c.id}_${e.start_date}_${e.start_time || ""}_${leadTime}`;

        if (isTimeForReminder && !notifiedMap[notificationKey]) {
          markReminderAsNotified(notificationKey);

          const timeLabel = getLeadTimeLabel(leadTime);
          const timeFormatted = e.start_time ? `às ${e.start_time.slice(0, 5)}` : "hoje";
          const title = `⏰ Lembrete: ${e.name}`;
          const body = `Começa ${timeFormatted} (${timeLabel}) no ${e.venue || e.city || "local"}. Confira os detalhes na Minha Agenda!`;

          // Dispara via Web Notification API utilitária
          sendUpcomingCoverageNotification({
            title: e.name,
            venue: e.venue || e.city || "local",
            city: e.city || undefined,
            startTime: e.start_time,
            startDate: e.start_date,
            leadTimeMinutes: leadTime,
            coverageId: c.id,
            url: "/agenda",
          });

          toast.info(title, {
            description: body,
            duration: 8000,
          });
        }
      }
    };

    // Executa imediatamente ao montar ou atualizar listas
    checkReminders();

    // Roda verificação contínua a cada 30 segundos
    const interval = window.setInterval(checkReminders, 30000);
    return () => window.clearInterval(interval);
  }, [coverages, eventCoverages]);
}
