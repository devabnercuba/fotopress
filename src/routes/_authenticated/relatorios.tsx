import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CalendarRange, FileSpreadsheet, Palette, Trophy, Users } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — FotoPress" },
      {
        name: "description",
        content:
          "Relatórios personalizados das suas coberturas, clientes, jogos e resultados. Em breve no FotoPress.",
      },
      { property: "og:title", content: "Relatórios — FotoPress" },
      {
        property: "og:description",
        content: "Uma visão completa da sua rotina profissional de cobertura esportiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={BarChart3}
      title="Relatórios"
      tagline="Tenha uma visão completa da sua rotina profissional."
      message="Estamos preparando uma ferramenta completa para você criar relatórios personalizados sobre suas coberturas, clientes, jogos e resultados."
      feature="relatorios"
      items={[
        {
          icon: CalendarRange,
          title: "Coberturas por período",
          text: "Filtre por datas e acompanhe o volume de trabalho ao longo do tempo.",
        },
        {
          icon: Trophy,
          title: "Por clube e campeonato",
          text: "Veja onde sua atuação está concentrada em cada temporada.",
        },
        {
          icon: Users,
          title: "Clientes e atletas",
          text: "Relacione entregas e coberturas com cada cliente atendido.",
        },
        {
          icon: FileSpreadsheet,
          title: "Exportação",
          text: "Gere PDF, Excel ou CSV a partir dos filtros escolhidos.",
        },
        {
          icon: Palette,
          title: "Layout personalizado",
          text: "Título, logo e cores do seu perfil aplicados ao relatório.",
        },
        {
          icon: BarChart3,
          title: "Indicadores",
          text: "Jogos fotografados, fotos entregues e receita em um só painel.",
        },
      ]}
    />
  ),
});
