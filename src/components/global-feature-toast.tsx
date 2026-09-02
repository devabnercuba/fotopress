import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useLatestUnreadUpdate } from "@/lib/product-updates";
import { openNewsUpdatesPanel } from "@/lib/updates-panel-context";

const TOAST_SESSION_KEY = "fotopress:feature_toast_notified";

/**
 * Notificador global que exibe brevemente um toast de 'Nova funcionalidade disponível!'
 * quando os usuários acessam o app e possuem atualizações pendentes que ainda não viram.
 */
export function GlobalFeatureToast() {
  const { latest, totalUnread } = useLatestUnreadUpdate();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!latest || totalUnread === 0 || hasTriggeredRef.current) return;

    // Verifica se já alertamos o usuário nesta sessão para este update
    const alreadyNotified = window.sessionStorage.getItem(TOAST_SESSION_KEY);
    if (alreadyNotified === latest.id) return;

    hasTriggeredRef.current = true;

    // Exibe o toast com uma entrada suave logo após a renderização inicial da página
    const timer = setTimeout(() => {
      window.sessionStorage.setItem(TOAST_SESSION_KEY, latest.id);

      toast("Nova funcionalidade disponível!", {
        id: `new-feature-${latest.id}`,
        description:
          totalUnread > 1
            ? `${latest.title} (+${totalUnread - 1} outra${totalUnread - 1 > 1 ? "s" : ""})`
            : latest.title,
        icon: <Sparkles className="size-4 text-primary" />,
        duration: 7000,
        action: {
          label: "Ver novidades",
          onClick: () => {
            openNewsUpdatesPanel("updates");
          },
        },
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [latest, totalUnread]);

  return null;
}
