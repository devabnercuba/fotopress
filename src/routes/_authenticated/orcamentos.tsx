import { createFileRoute } from "@tanstack/react-router";
import { Calculator, FileText, Percent, Send, UserSquare2, Wallet } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — FotoPress" },
      {
        name: "description",
        content: "Crie propostas profissionais para seus clientes direto do FotoPress. Em breve.",
      },
      { property: "og:title", content: "Orçamentos — FotoPress" },
      {
        property: "og:description",
        content: "Propostas profissionais de cobertura esportiva, criadas em minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={Calculator}
      title="Orçamentos"
      tagline="Crie propostas profissionais para seus clientes."
      message="Em breve você poderá criar, personalizar e enviar orçamentos diretamente pelo FotoPress."
      feature="orcamentos"
      items={[
        {
          icon: UserSquare2,
          title: "Selecionar cliente",
          text: "Comece a proposta a partir dos seus contatos e atletas.",
        },
        {
          icon: Wallet,
          title: "Produtos e serviços",
          text: "Monte a proposta com itens cadastrados, quantidade e preço.",
        },
        {
          icon: Percent,
          title: "Descontos e totais",
          text: "Subtotal, desconto e total calculados automaticamente.",
        },
        {
          icon: FileText,
          title: "Exportar em PDF",
          text: "Documento com sua identidade visual pronto para enviar.",
        },
        {
          icon: Send,
          title: "Envio ao cliente",
          text: "Compartilhe a proposta com poucos cliques.",
        },
        {
          icon: Calculator,
          title: "Histórico",
          text: "Acompanhe propostas enviadas, aceitas e recusadas.",
        },
      ]}
    />
  ),
});
