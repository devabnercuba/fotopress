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
  const targetUrl = data.url || "/agenda";
  const targetTab = data.tab || "updates";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Se houver uma aba aberta, foca nela e navega ou abre novidades
      for (const client of windowClients) {
        if ("focus" in client) {
          if (data.type === "COVERAGE_REMINDER" || targetUrl.includes("/agenda")) {
            client.postMessage({
              type: "NAVIGATE_TO",
              url: targetUrl,
            });
            if ("navigate" in client && !client.url.includes("/agenda")) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }

          client.postMessage({
            type: "OPEN_UPDATES_PANEL",
            tab: targetTab,
            updateId: data.updateId,
          });
          return client.focus();
        }
      }

      // Se o aplicativo estiver fechado, abre uma nova janela navegando com a URL de destino
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

  if (event.data.type === "SCHEDULE_COVERAGE_REMINDER") {
    const delay = event.data.delay || 0;
    const title = event.data.title || "FotoPress: Lembrete de Cobertura";
    const body = event.data.body || "Sua cobertura agendada está próxima do início.";
    const data = event.data.data || { url: "/agenda", type: "COVERAGE_REMINDER" };

    setTimeout(
      () => {
        self.registration.showNotification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: event.data.tag || "fotopress-coverage-reminder",
          renotify: true,
          data,
        });
      },
      Math.max(0, delay),
    );
  }
});
