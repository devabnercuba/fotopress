import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarSync,
  CalendarCheck,
  CalendarDays,
  RefreshCw,
  Share2,
  Smartphone,
} from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/calendario-externo")({
  head: () => ({
    meta: [
      { title: "Integração de Calendário — FotoPress" },
      {
        name: "description",
        content:
          "Sincronize suas coberturas aprovadas com Google Agenda, Apple e Outlook. Em breve no FotoPress.",
      },
      { property: "og:title", content: "Integração de Calendário — FotoPress" },
      {
        property: "og:description",
        content: "Suas coberturas no mesmo calendário que você já usa todos os dias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={CalendarSync}
      title="Integração de Calendário"
      tagline="Suas coberturas no calendário que você já usa."
      message="Vamos sincronizar automaticamente os jogos aprovados com Google Agenda, Apple Calendar e Outlook."
      feature="calendario-externo"
      items={[
        {
          icon: CalendarDays,
          title: "Google Agenda",
          text: "Coberturas aprovadas aparecem direto na sua agenda.",
        },
        {
          icon: CalendarCheck,
          title: "Apple e Outlook",
          text: "Assinatura por link iCal para qualquer aplicativo.",
        },
        {
          icon: RefreshCw,
          title: "Sincronização automática",
          text: "Mudou o horário do jogo? O evento muda junto.",
        },
        {
          icon: Smartphone,
          title: "Lembretes no celular",
          text: "Notificações nativas antes de cada partida.",
        },
        {
          icon: Share2,
          title: "Compartilhamento",
          text: "Envie sua agenda para assessorias e parceiros.",
        },
        {
          icon: CalendarSync,
          title: "Local e detalhes",
          text: "Estádio, cidade e observações vão no evento.",
        },
      ]}
    />
  ),
});
