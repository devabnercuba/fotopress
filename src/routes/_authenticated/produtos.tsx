import { createFileRoute } from "@tanstack/react-router";
import { Camera, Film, ImageIcon, Package, Tag, Ruler } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos e Serviços — FotoPress" },
      {
        name: "description",
        content:
          "Cadastre serviços e entregáveis de cobertura esportiva para montar orçamentos rapidamente. Em breve.",
      },
      { property: "og:title", content: "Produtos e Serviços — FotoPress" },
      {
        property: "og:description",
        content: "A base do seu futuro sistema de orçamentos no FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={Package}
      title="Produtos e Serviços"
      tagline="Cadastre seus serviços e entregáveis para criar orçamentos de forma rápida."
      message="Em breve você poderá cadastrar seus produtos, serviços, coberturas e entregas."
      feature="produtos"
      items={[
        {
          icon: Camera,
          title: "Coberturas",
          text: "Futebol, futsal, eventos — cada tipo com seu preço e unidade.",
        },
        {
          icon: ImageIcon,
          title: "Pacotes de fotos",
          text: "Pacote com 50 fotos, foto individual, ensaio e outros entregáveis.",
        },
        {
          icon: Film,
          title: "Vídeo e reels",
          text: "Entregas audiovisuais com descrição e valores próprios.",
        },
        {
          icon: Tag,
          title: "Preço e status",
          text: "Defina valores, mantenha itens ativos ou arquivados.",
        },
        {
          icon: Ruler,
          title: "Unidade de venda",
          text: "Por jogo, por hora, por pacote ou mensal.",
        },
        {
          icon: Package,
          title: "Base dos orçamentos",
          text: "Os itens cadastrados alimentarão as propostas automaticamente.",
        },
      ]}
    />
  ),
});
