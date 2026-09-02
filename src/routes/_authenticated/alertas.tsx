import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellRing, CalendarClock, MessageCircle, Radar, Users } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas — FotoPress" },
      {
        name: "description",
        content:
          "Avisos automáticos de credenciamento, jogos próximos e follow-up de clientes. Em breve no FotoPress.",
      },
      { property: "og:title", content: "Alertas — FotoPress" },
      {
        property: "og:description",
        content: "Nunca mais perca um prazo de credenciamento ou um retorno de cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={Bell}
      title="Alertas"
      tagline="Nunca mais perca um prazo ou um retorno."
      message="Vamos avisar você sobre prazos de credenciamento, jogos próximos e contatos que ficaram sem resposta."
      feature="alertas"
      items={[
        {
          icon: CalendarClock,
          title: "Jogos próximos",
          text: "Lembretes automáticos das coberturas da semana.",
        },
        {
          icon: BellRing,
          title: "Prazos de credenciamento",
          text: "Aviso antes do fechamento das solicitações.",
        },
        {
          icon: Users,
          title: "Follow-up de clientes",
          text: "Contatos sem resposta voltam para a sua lista.",
        },
        {
          icon: MessageCircle,
          title: "Notificações no WhatsApp",
          text: "Receba os avisos onde você já conversa com os clubes.",
        },
        {
          icon: Radar,
          title: "Radar da partida",
          text: "Notícias relevantes do jogo chegam antes da cobertura.",
        },
        {
          icon: Bell,
          title: "Regras personalizadas",
          text: "Você escolhe o que merece um alerta e com quanta antecedência.",
        },
      ]}
    />
  ),
});
