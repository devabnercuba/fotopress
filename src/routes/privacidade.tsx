import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — FotoPress" },
      {
        name: "description",
        content: "Como o FotoPress trata os dados de perfil e uso da plataforma.",
      },
      { property: "og:title", content: "Política de Privacidade — FotoPress" },
      { property: "og:description", content: "Tratamento de dados pessoais no FotoPress." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 md:px-8">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Esta página está reservada para a Política de Privacidade do FotoPress. Os dados de perfil
        (nome, e-mail, WhatsApp, foto e logo) são usados apenas para personalizar sua experiência,
        prestar suporte e acompanhar o uso da plataforma, e ficam acessíveis somente à sua conta e à
        administração do FotoPress. O texto completo será publicado antes da abertura comercial.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        O número de WhatsApp informado no cadastro nunca é exibido publicamente nem compartilhado
        com terceiros. O contato para coleta de feedback só acontece quando você autoriza no
        cadastro ou nas configurações, e essa autorização pode ser retirada a qualquer momento em
        Configurações → Perfil.
      </p>
    </main>
  );
}
