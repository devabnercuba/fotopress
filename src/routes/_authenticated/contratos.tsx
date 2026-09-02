import { createFileRoute } from "@tanstack/react-router";
import { FileSignature, FileCheck2, FileText, PenLine, ShieldCheck, Users } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({
    meta: [
      { title: "Contratos — FotoPress" },
      {
        name: "description",
        content:
          "Modelos de contrato, cessão de imagem e assinatura digital para coberturas esportivas. Em breve no FotoPress.",
      },
      { property: "og:title", content: "Contratos — FotoPress" },
      {
        property: "og:description",
        content: "Formalize cada cobertura com modelos prontos e assinatura digital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      icon={FileSignature}
      title="Contratos"
      tagline="Formalize cada trabalho sem burocracia."
      message="Modelos prontos de contrato e cessão de imagem, preenchidos com os dados do cliente e da cobertura."
      feature="contratos"
      items={[
        {
          icon: FileText,
          title: "Modelos prontos",
          text: "Contratos de cobertura, ensaio e pacote de fotos.",
        },
        {
          icon: Users,
          title: "Dados do cliente",
          text: "Preenchimento automático a partir do cadastro de atletas.",
        },
        {
          icon: PenLine,
          title: "Assinatura digital",
          text: "Envio por link e assinatura pelo celular.",
        },
        {
          icon: ShieldCheck,
          title: "Cessão de imagem",
          text: "Autorização de uso das fotos anexada ao contrato.",
        },
        {
          icon: FileCheck2,
          title: "Status do documento",
          text: "Acompanhe enviados, pendentes e assinados.",
        },
        {
          icon: FileSignature,
          title: "Vínculo com a partida",
          text: "Cada contrato ligado à cobertura correspondente.",
        },
      ]}
    />
  ),
});
