// Service Worker para notificações em segundo plano e PWA - FotoPress
const CACHE_NAME = "fotopress-sw-v1";

self.addEventListener("install", (event) => {
  // Ativa imediatamente o novo service worker sem esperar as abas antigas fecharem
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Assume o controle de todas as abas abertas imediatamente
  event.waitUntil(self.clients.claim());
});

// Manipulador de cliques em notificações do sistema
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || "/?openUpdates=true";
  const targetTab = data.tab || "updates";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Se houver uma aba aberta, foca nela e envia a mensagem para abrir o modal de novidades
      for (const client of windowClients) {
        if ("focus" in client) {
          client.postMessage({
            type: "OPEN_UPDATES_PANEL",
            tab: targetTab,
            updateId: data.updateId,
          });
          return client.focus();
        }
      }

      // Se o aplicativo estiver fechado, abre uma nova janela navegando com o parâmetro de novidades
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// Evento de Push padrão da Web (quando conectado a um servidor de WebPush)
self.addEventListener("push", (event) => {
  let payload = {
    title: "FotoPress - Nova atualização disponível!",
    body: "Confira as novidades e melhorias recém-lançadas na Agenda Esportiva.",
    data: { url: "/?openUpdates=true", tab: "updates" },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: payload.tag || "fotopress-update",
    renotify: true,
    data: payload.data || { url: "/?openUpdates=true", tab: "updates" },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Comunicação com o cliente (testes, agendamento de avisos quando o app é minimizado)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "TEST_NOTIFICATION_DELAYED") {
    const delay = event.data.delay || 3000;
    const title = event.data.title || "FotoPress: Nova funcionalidade!";
    const body =
      event.data.body || "Clique para abrir a Central de Atualizações e conferir as novidades.";
    const data = event.data.data || { url: "/?openUpdates=true", tab: "updates" };

    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: "fotopress-test-alert",
        renotify: true,
        data,
      });
    }, delay);
  }
});
