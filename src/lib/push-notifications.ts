import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { openNewsUpdatesPanel } from "./updates-panel-context";

const PUSH_PREF_KEY = "fotopress:push_notifications_enabled";
const LAST_NOTIFIED_PUSH_KEY = "fotopress:last_push_notified_id";

/**
 * Registra o Service Worker caso o navegador tenha suporte.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.warn("Falha ao registrar Service Worker do FotoPress:", error);
    return null;
  }
}

/**
 * Verifica se a URL atual contém requisição para abrir o painel de novidades
 * (originado de um clique em notificação push em segundo plano).
 */
export function checkUrlForUpdatesModalTrigger(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get("openUpdates") === "true" || window.location.hash === "#updates") {
    // Abre a Central de Atualizações
    openNewsUpdatesPanel("updates");

    // Limpa o parâmetro da barra de endereço para não reabrir em recarregamentos
    url.searchParams.delete("openUpdates");
    const cleanUrl = url.pathname + (url.search ? url.search : "");
    window.history.replaceState({}, document.title, cleanUrl);
    return true;
  }
  return false;
}

/**
 * Configura os ouvintes globais de mensagens do Service Worker.
 */
export function setupServiceWorkerMessageListener() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "OPEN_UPDATES_PANEL") {
      openNewsUpdatesPanel(event.data.tab || "updates");
    }
  });

  // Verifica na inicialização se abriu por link de notificação
  checkUrlForUpdatesModalTrigger();
}

/**
 * Dispara uma notificação do sistema via Service Worker se permitido
 */
export async function showSystemNotification(
  title: string,
  options?: {
    body?: string;
    url?: string;
    tab?: "updates" | "releases";
    updateId?: string;
    tag?: string;
  },
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration) {
      await registration.showNotification(title, {
        body: options?.body || "Novidades disponíveis na Agenda Esportiva.",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: options?.tag || "fotopress-update-alert",
        renotify: true,
        data: {
          url: options?.url || "/?openUpdates=true",
          tab: options?.tab || "updates",
          updateId: options?.updateId,
        },
      });
      return true;
    }
  } catch (error) {
    console.warn("Erro ao exibir notificação via Service Worker:", error);
    // Fallback para Notification API nativa
    try {
      new Notification(title, {
        body: options?.body,
        icon: "/favicon.png",
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Hook para gerenciar estado e permissões de notificações Push / Service Worker
 */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      const savedPref = window.localStorage.getItem(PUSH_PREF_KEY);
      setIsEnabled(Notification.permission === "granted" && savedPref !== "false");
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Notificações não são suportadas pelo seu navegador atual.");
      return false;
    }

    setIsPending(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        window.localStorage.setItem(PUSH_PREF_KEY, "true");
        setIsEnabled(true);
        toast.success("Notificações em segundo plano ativadas com sucesso!");

        // Registra o SW garantido
        await registerServiceWorker();

        // Envia notificação de confirmação
        await showSystemNotification("FotoPress - Notificações Ativadas!", {
          body: "Você será avisado sobre novidades e atualizações mesmo quando o app estiver fechado.",
          tab: "updates",
        });

        return true;
      } else if (result === "denied") {
        window.localStorage.setItem(PUSH_PREF_KEY, "false");
        setIsEnabled(false);
        toast.error(
          "Notificações bloqueadas nas configurações do navegador. Libere a permissão para receber alertas.",
        );
        return false;
      }
    } catch (err) {
      console.error("Erro ao solicitar permissão de notificações:", err);
      toast.error("Não foi possível solicitar permissão de notificações.");
    } finally {
      setIsPending(false);
    }
    return false;
  }, [isSupported]);

  const sendTestNotification = useCallback(
    async (delaySeconds: number = 0) => {
      if (!isSupported) {
        toast.error("Notificações do sistema não são suportadas neste navegador.");
        return;
      }

      if (permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return;
      }

      if (delaySeconds > 0) {
        toast.info(
          `Notificação agendada para daqui a ${delaySeconds}s! Você pode minimizar ou trocar de aba para testar.`,
          { duration: 5000 },
        );

        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "TEST_NOTIFICATION_DELAYED",
            delay: delaySeconds * 1000,
            title: "FotoPress - Nova atualização disponível!",
            body: "Clique aqui para abrir o modal de novidades diretamente.",
            data: { url: "/?openUpdates=true", tab: "updates" },
          });
        } else {
          setTimeout(() => {
            showSystemNotification("FotoPress - Nova atualização disponível!", {
              body: "Clique aqui para abrir a Central de Atualizações.",
              url: "/?openUpdates=true",
              tab: "updates",
            });
          }, delaySeconds * 1000);
        }
      } else {
        const sent = await showSystemNotification("FotoPress - Nova atualização disponível!", {
          body: "Clique aqui para conferir as novas funcionalidades e melhorias na Agenda Esportiva.",
          url: "/?openUpdates=true",
          tab: "updates",
        });

        if (sent) {
          toast.success(
            "Notificação enviada com sucesso! Clique nela para testar o redirecionamento.",
          );
        }
      }
    },
    [isSupported, permission, requestPermission],
  );

  const togglePushPreference = useCallback(async () => {
    if (permission !== "granted") {
      return await requestPermission();
    }

    const next = !isEnabled;
    setIsEnabled(next);
    window.localStorage.setItem(PUSH_PREF_KEY, next ? "true" : "false");
    if (next) {
      toast.success("Notificações em segundo plano ativadas.");
    } else {
      toast.info("Notificações em segundo plano desativadas no aplicativo.");
    }
    return next;
  }, [permission, isEnabled, requestPermission]);

  return {
    isSupported,
    permission,
    isEnabled,
    isPending,
    requestPermission,
    sendTestNotification,
    togglePushPreference,
  };
}
