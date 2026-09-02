import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Aperture,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Crown,
  Download,
  Link2,
  MessageCircle,
  Newspaper,
  Users,
  Volleyball,
  Wallet,
} from "lucide-react";

import { CheckoutButton } from "@/components/access-status";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/app-url";
import { FOUNDER_FEATURES, FOUNDER_PRICE_LABEL } from "@/lib/billing";

const FAQ = [
  {
    q: "O que é o FotoPress?",
    a: "É um sistema para organizar jogos, eventos esportivos, coberturas, agenda, credenciamentos, atletas e informações relevantes para profissionais da mídia esportiva.",
  },
  {
    q: "O que é o Acesso Fundador?",
    a: "É um pagamento único que garante acesso vitalício ao FotoPress e às funcionalidades incluídas no plano fundador.",
  },
  {
    q: "Existe período de teste?",
    a: "Sim. Novos usuários terão 7 dias para experimentar a plataforma.",
  },
  { q: "Preciso pagar durante o teste?", a: "Não." },
  {
    q: "O que acontece quando o teste termina?",
    a: "O usuário poderá adquirir o Acesso Fundador para continuar utilizando as funcionalidades premium.",
  },
  { q: "O pagamento é mensal?", a: "Não. O plano fundador é pagamento único." },
];

const WHATSAPP_PHONE = "5547997293985";
const WHATSAPP_URL =
  `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=` +
  encodeURIComponent("Olá! Vim pelo site do FotoPress e quero saber mais.");

/**
 * Abre o WhatsApp de forma confiável. Dentro de iframes (preview/embeds) o
 * `target="_blank"` pode ser bloqueado, então caímos para navegação direta.
 */
function openWhatsApp(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const win = window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
  if (!win) {
    try {
      (window.top ?? window).location.href = WHATSAPP_URL;
    } catch {
      window.location.href = WHATSAPP_URL;
    }
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FotoPress — organize suas coberturas esportivas" },
      {
        name: "description",
        content:
          "Encontre jogos, organize sua agenda, acompanhe credenciamentos e chegue preparado a cada cobertura esportiva.",
      },
      { property: "og:title", content: "FotoPress — organize suas coberturas esportivas" },
      {
        property: "og:description",
        content:
          "Plataforma para fotógrafos e jornalistas esportivos: jogos, agenda, credenciamentos e radar da partida.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: appUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: appUrl("/") }],
  }),
  component: Landing,
});

const BENEFITS = [
  {
    icon: Download,
    title: "Importação de jogos",
    text: "Importe partidas pela CBF, FCF, LNF ou pelo modelo oficial PDF/XLSX.",
  },
  {
    icon: ClipboardList,
    title: "Credenciamento",
    text: "Acompanhe solicitações e saiba quais coberturas já estão confirmadas.",
  },
  {
    icon: CalendarDays,
    title: "Minha Agenda",
    text: "Tenha em um só lugar os jogos e eventos esportivos que realmente fazem parte da sua programação.",
  },
  {
    icon: Users,
    title: "Atletas/Clientes",
    text: "Organize contatos, prospects e clientes relacionados às suas coberturas.",
  },
  {
    icon: Volleyball,
    title: "Organização comercial",
    text: "Acompanhe contato, resposta, oferta de pacote e fechamento por partida.",
  },
  {
    icon: Wallet,
    title: "Financeiro",
    text: "Registre receitas e despesas de cada cobertura e acompanhe o resultado do seu trabalho.",
  },
  {
    icon: Link2,
    title: "Fontes e preparação",
    text: "Centralize informações e fontes utilizadas na preparação de cada cobertura.",
  },
];

const FLOW = [
  "Importe os jogos",
  "Organize credenciamentos",
  "Monte sua agenda",
  "Prepare a cobertura",
  "Gerencie atletas/clientes",
  "Conclua o trabalho",
];

const IMPORTERS = ["CBF", "FCF", "FPF", "LNF", "PDF/XLSX"];

const PIPELINE = ["Não contatado", "Contato realizado", "Respondeu", "Pacote oferecido", "Fechado"];

const NEXT_UP = [
  { title: "Alertas", text: "Avisos de credenciamento, jogos e follow-up." },
  { title: "Calendário Externo", text: "Suas coberturas no Google e Apple Calendar." },
  { title: "Relatórios", text: "Indicadores e históricos das suas coberturas." },
  { title: "Orçamentos", text: "Propostas e valores enviados aos clientes." },
  { title: "Produtos e Serviços", text: "Seus entregáveis cadastrados para orçar rápido." },
  { title: "Contratos", text: "Informações comerciais dos trabalhos contratados." },
];

const AUDIENCE = [
  "Fotógrafos esportivos",
  "Jornalistas esportivos",
  "Profissionais de mídia esportiva",
  "Freelancers",
];

function Mockup() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 px-1 pb-3">
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="hidden flex-col gap-1.5 rounded-xl bg-surface p-2.5 sm:flex">
          {["Dashboard", "Jogos", "Agenda", "Radar"].map((i, idx) => (
            <span
              key={i}
              className={`rounded-md px-2 py-1 text-[11px] ${
                idx === 0 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
              }`}
            >
              {i}
            </span>
          ))}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {["Jogos", "Solicitados", "Aprovados"].map((k, i) => (
              <div key={k} className="rounded-lg border border-border p-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                <div className="mt-1 text-lg font-semibold">{[128, 14, 9][i]}</div>
              </div>
            ))}
          </div>
          {[
            ["Sáb 20:30", "Clube A × Clube B"],
            ["Dom 16:00", "Clube C × Clube D"],
            ["Qua 21:30", "Clube E × Clube F"],
          ].map(([when, match]) => (
            <div
              key={match}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{match}</div>
                <div className="text-[10px] text-muted-foreground">{when} · Estádio Municipal</div>
              </div>
              <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Aprovado
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={openWhatsApp}
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <MessageCircle className="size-5" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </a>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 md:px-8">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/40 cursor-pointer"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Camera className="size-4" />
            </span>
            <span className="truncate text-base font-semibold tracking-tight">FotoPress</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth" search={{ mode: "signin" }}>
                Entrar
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar agora
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 md:px-8">
        {/* HERO */}
        <section className="grid items-center gap-10 py-14 md:py-24 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">FotoPress</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
              Organize suas coberturas esportivas em um só lugar.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Jogos, credenciamentos, agenda, atletas, clientes e informações para sua cobertura —
              sem depender de várias planilhas, agendas e anotações.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Quero meu acesso
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#recursos">Conhecer o FotoPress</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Importe jogos de:</span>
              {IMPORTERS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Mockup />
        </section>

        {/* BENEFÍCIOS */}
        <section id="recursos" className="scroll-mt-20 border-t border-border py-14 md:py-20">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
            Tudo o que você precisa para organizar suas coberturas.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <article
                key={b.title}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-foreground">
                  <b.icon className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-medium">{b.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* SUA ROTINA EM UM SÓ LUGAR */}
        <section className="border-t border-border py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Sua rotina em um só lugar
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* PARA QUEM É */}
        <section className="border-t border-border py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Feito para quem vive a cobertura esportiva.
          </h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {AUDIENCE.map((a) => (
              <li
                key={a}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                {a}
              </li>
            ))}
          </ul>
        </section>

        {/* CENÁRIOS DE USO */}
        <section className="border-t border-border py-14 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Feito para quem vive a cobertura esportiva
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              O FotoPress foi pensado para situações reais da rotina de fotógrafos, jornalistas e
              profissionais da mídia esportiva.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Camera,
                profile: "Fotógrafo esportivo",
                text: "Jogos, credenciamentos, clientes e contatos costumam ficar espalhados entre WhatsApp, agenda e anotações. O FotoPress reúne essa rotina em um só lugar para facilitar o planejamento de cada cobertura.",
              },
              {
                icon: Newspaper,
                profile: "Profissional de mídia",
                text: "Com vários campeonatos acontecendo ao mesmo tempo, fica muito mais fácil visualizar os próximos jogos, acompanhar credenciamentos e organizar o que realmente entrou na agenda.",
              },
              {
                icon: Aperture,
                profile: "Fotógrafo freelancer",
                text: "Antes de uma partida, poder consultar atletas, clientes e contatos do clube ajuda a transformar a cobertura também em uma oportunidade de negócio.",
              },
            ].map((scenario) => (
              <figure
                key={scenario.profile}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-foreground">
                  <scenario.icon className="size-4" />
                </span>
                <figcaption className="mt-4 text-sm font-medium">{scenario.profile}</figcaption>
                <blockquote className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  “{scenario.text}”
                </blockquote>
                <span className="mt-4 inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Cenário de uso
                </span>
              </figure>
            ))}
          </div>
        </section>

        {/* ATLETAS/CLIENTES */}
        <section className="border-t border-border py-14 md:py-20">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-10">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Da cobertura à oportunidade
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Organize atletas, prospects e clientes e acompanhe seu contato comercial partida por
              partida.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {PIPELINE.map((stage) => (
                <span
                  key={stage}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* EM BREVE */}
        <section className="border-t border-border py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            O FotoPress continua evoluindo
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NEXT_UP.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-dashed border-border bg-card p-5"
              >
                <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Em breve
                </span>
                <h3 className="mt-3 text-sm font-medium">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PREÇO */}
        <section id="preco" className="scroll-mt-20 border-t border-border py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Escolha como começar
          </h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-primary/40 bg-card p-6 shadow-sm">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                <Crown className="size-3" />
                Acesso Fundador
              </span>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{FOUNDER_PRICE_LABEL}</span>
                <span className="pb-1 text-sm text-muted-foreground">pagamento único</span>
              </div>
              <p className="mt-1 text-sm font-medium text-primary">Acesso vitalício</p>
              <ul className="mt-6 space-y-2">
                {FOUNDER_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <CheckoutButton size="lg" className="mt-7 w-full">
                QUERO ACESSO VITALÍCIO
              </CheckoutButton>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Você pode experimentar o FotoPress gratuitamente antes de decidir. Teste grátis por
                7 dias.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Começar teste grátis de 7 dias
                </Link>
              </Button>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold tracking-tight">Seja um dos primeiros</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  O FotoPress está começando uma nova fase. Ao entrar agora, você se torna um dos
                  primeiros usuários da plataforma e garante seu acesso fundador.
                </p>
                <CheckoutButton className="mt-5">QUERO APOIAR O PROJETO</CheckoutButton>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="text-lg font-semibold tracking-tight">
                  Apoie o desenvolvimento do FotoPress
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Estamos construindo uma ferramenta pensada para profissionais que trabalham com
                  cobertura esportiva. Ao adquirir o acesso fundador, você ajuda a financiar a
                  evolução do projeto e garante acesso às funcionalidades disponibilizadas para esse
                  plano.
                </p>
                <CheckoutButton className="mt-5" variant="outline">
                  APOIAR E TER ACESSO
                </CheckoutButton>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border py-14 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Perguntas frequentes
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FAQ.map((item) => (
              <article key={item.q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-medium">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CONTATO */}
        <section id="contato" className="scroll-mt-20 border-t border-border py-14 md:py-20">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-10">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  Resposta rápida no WhatsApp
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
                  Fale com a gente agora
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Sem formulário, sem espera. Chame no WhatsApp e tire suas dúvidas sobre o
                  FotoPress direto com a gente.
                </p>
              </div>
              <Button asChild size="lg" className="w-full md:w-auto">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="size-4" />
                  Conversar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="border-t border-border py-14 md:py-20">
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center md:px-10">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Organize sua próxima cobertura com o FotoPress.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {FOUNDER_PRICE_LABEL} · pagamento único · acesso vitalício.
            </p>
            <CheckoutButton size="lg" className="mt-6">
              Garantir Acesso Fundador
            </CheckoutButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3 md:px-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Camera className="size-3.5" />
              </span>
              <span className="text-sm font-semibold">FotoPress</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Agenda e organização de coberturas esportivas.
            </p>
          </div>
          <nav className="text-xs">
            <div className="font-medium">Produto</div>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a href="#recursos" className="hover:text-foreground">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#contato" className="hover:text-foreground">
                  Contato
                </a>
              </li>
              <li>
                <Link to="/auth" search={{ mode: "signin" }} className="hover:text-foreground">
                  Entrar
                </Link>
              </li>
            </ul>
          </nav>
          <nav className="text-xs">
            <div className="font-medium">Legal</div>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <Link to="/termos" className="hover:text-foreground">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:text-foreground">
                  Política de Privacidade
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} FotoPress
        </div>
      </footer>

      <WhatsAppFab />
    </div>
  );
}
