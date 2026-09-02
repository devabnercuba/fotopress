import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — FotoPress" },
      {
        name: "description",
        content: "Termos de uso da plataforma FotoPress para organização de coberturas esportivas.",
      },
      { property: "og:title", content: "Termos de Uso — FotoPress" },
      { property: "og:description", content: "Condições de uso da plataforma FotoPress." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 md:px-8">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Termos de Uso</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Esta página está reservada para os Termos de Uso do FotoPress. O conteúdo definitivo será
        publicado antes da abertura comercial da plataforma. Até lá, o uso do serviço é oferecido em
        caráter de avaliação, sem garantias de disponibilidade contínua.
      </p>
    </main>
  );
}
