export type ReleaseCategoryTag = "New Feature" | "Improvement" | "Fix" | "Performance";

export interface ReleaseNoteItem {
  id: string;
  type: "feature" | "improvement" | "fix" | "performance";
  categoryTag?: ReleaseCategoryTag;
  title: string;
  description: string;
  module: string;
}

export interface ReleaseVersion {
  version: string;
  date: string;
  badge?: string;
  summary: string;
  items: ReleaseNoteItem[];
}

export const APP_VERSION = "v2.5.0";

export const RELEASE_HISTORY: ReleaseVersion[] = [
  {
    version: "v2.5.0",
    date: "03 de Setembro de 2026",
    badge: "Versão Atual",
    summary:
      "Integração com **Service Worker** para notificações push em segundo plano, suporte completo a **Markdown** nas notas de release, tags de categoria padronizadas (`New Feature`, `Fix`, `Improvement`) e animação visual de ping na navegação.",
    items: [
      {
        id: "rn-25-1",
        type: "feature",
        categoryTag: "New Feature",
        title: "Notificações em Segundo Plano com Service Worker & PWA",
        description:
          "Integração nativa de **Service Worker** (`/sw.js`) e Web App Manifest (`manifest.json`) para alertar fotógrafos sobre novos recursos mesmo com o app fechado ou em segundo plano.\n\n- Suporte a alertas com clique direto para reabrir a **Central de Atualizações**\n- Gestão de permissões de notificação com botão para envio de teste agendado\n- Comunicação bidirecional via `postMessage` entre o Service Worker e o cliente TanStack Router",
        module: "PWA & Push",
      },
      {
        id: "rn-25-2",
        type: "feature",
        categoryTag: "New Feature",
        title: "Animação Ping Pulsante no Ícone de Novidades da Barra de Navegação",
        description:
          "Indicador visual com animação `animate-ping` e ponto luminoso pulsante integrado ao ícone de novidades tanto no **menu lateral desktop** quanto na **barra de navegação mobile** para chamar a atenção do usuário para novos itens não lidos.",
        module: "Navegação & UI",
      },
      {
        id: "rn-25-3",
        type: "improvement",
        categoryTag: "Improvement",
        title: "Suporte a Markdown Completo nas Notas de Release",
        description:
          "Renderização dinâmica de **Markdown** com suporte nativo a:\n\n- **Texto em negrito** e itálico para ênfase de funcionalidades\n- Listas ordenadas e não ordenadas com marcadores personalizados\n- Números de versão formatados em código (`v2.5.0`, `v2.4.0`)\n- Destaques de extensões (`.ics`) e bibliotecas integradas",
        module: "Release Notes",
      },
      {
        id: "rn-25-4",
        type: "improvement",
        categoryTag: "Improvement",
        title: "Barra de Filtros e Categorias na Central de Atualizações",
        description:
          "Adição de barra de filtros por categoria (`New Feature`, `Improvement`, `Fix`, `Performance`) e seletor de ordenação (mais recentes, mais antigas ou agrupadas por tipo) no modal de atualizações.",
        module: "Central de Atualizações",
      },
    ],
  },
  {
    version: "v2.4.0",
    date: "02 de Setembro de 2026",
    badge: "Estável",
    summary:
      "Lançamento do sistema global de notificações de novidades, exportação de jogos para calendário **.ics** / **Google Agenda**, modal detalhado de eventos com compartilhamento e favoritos.",
    items: [
      {
        id: "rn-24-1",
        type: "feature",
        categoryTag: "New Feature",
        title: "Notificação Global de Novidades e Painel Lateral de Atualizações",
        description:
          "Notificação instantânea em toast ao acessar o app com itens pendentes, painel lateral completo com marcação de status **lido/não lido** e histórico consolidado de melhorias.\n\n- Toast não intrusivo com botão de ação direta\n- Badge numérico com contagem de pendências\n- Sincronização persistente com a conta do fotógrafo",
        module: "Notificações",
      },
      {
        id: "rn-24-2",
        type: "feature",
        categoryTag: "New Feature",
        title: "Exportação para Calendários (.ics e Google Agenda)",
        description:
          "Download de arquivo iCalendar (`.ics`) compatível com **Apple Calendar**, **Microsoft Outlook** e atalho para salvar direto no **Google Agenda** em um clique.",
        module: "Calendário",
      },
      {
        id: "rn-24-3",
        type: "feature",
        categoryTag: "New Feature",
        title: "Modal de Detalhes do Confronto com Compartilhamento",
        description:
          "Janela informativa contendo local, data, modalidade e ações rápidas para compartilhar partidas via **WhatsApp** ou cópia limpa de link para colegas de equipe.",
        module: "Eventos",
      },
      {
        id: "rn-24-4",
        type: "feature",
        categoryTag: "New Feature",
        title: "Sistema de Favoritos para Partidas e Coberturas",
        description:
          "Possibilidade de favoritar partidas prioritárias com persistência local e filtro rápido no topo da grade de jogos.",
        module: "Eventos",
      },
      {
        id: "rn-24-5",
        type: "improvement",
        categoryTag: "Improvement",
        title: "Carregamento Rápido com Skeletons e Telas Informativas",
        description:
          "Substituição de textos de carregamento por placeholders animados tipo skeleton e estados vazios com atalhos de navegação.",
        module: "Performance & UI",
      },
    ],
  },
  {
    version: "v2.3.0",
    date: "30 de Agosto de 2026",
    summary:
      "Reformulação do Calendário Esportivo com visualização unificada de partidas e eventos genéricos, novos filtros de data e status.",
    items: [
      {
        id: "rn-23-1",
        type: "feature",
        categoryTag: "New Feature",
        title: "Visualizador de Calendário Esportivo Unificado",
        description:
          "Nova grade de datas com navegação mensal, contadores diários e integração de partidas e eventos em uma única linha do tempo.",
        module: "Calendário",
      },
      {
        id: "rn-23-2",
        type: "improvement",
        categoryTag: "Improvement",
        title: "Filtros Rápidos por Modalidade Esportiva e Período",
        description:
          "Atalhos rápidos para **Hoje**, **Próximos 7 dias** e filtro dinâmico por modalidade (Futebol, Basquete, Vôlei, Ginástica, etc.).",
        module: "Calendário",
      },
      {
        id: "rn-23-3",
        type: "fix",
        categoryTag: "Fix",
        title: "Ajuste de Fuso Horário em Partidas Internacionais",
        description:
          "Correção na conversão de timestamps UTC para o horário de Brasília (`UTC-3`) nas visualizações do calendário e nas exportações de agenda.",
        module: "Jogos",
      },
    ],
  },
  {
    version: "v2.2.0",
    date: "20 de Agosto de 2026",
    summary:
      "Integração com Kiwify para sincronização automática de assinaturas e gerenciamento de permissões de acesso.",
    items: [
      {
        id: "rn-22-1",
        type: "feature",
        categoryTag: "New Feature",
        title: "Webhook Kiwify & Controle de Assinaturas",
        description:
          "Sincronização de pagamentos, ativação automática de planos e controle de vigência diretamente no painel administrativo.",
        module: "Kiwify & Cobrança",
      },
      {
        id: "rn-22-2",
        type: "improvement",
        categoryTag: "Improvement",
        title: "Gestão Aprofundada de Atletas e Clientes",
        description:
          "Cadastro de histórico de jogos cobertos por atleta, com cálculo automatizado de partidas e galerias geradas.",
        module: "Atletas",
      },
      {
        id: "rn-22-3",
        type: "performance",
        categoryTag: "Performance",
        title: "Otimização de Consultas Supabase com React Query",
        description:
          "Cache de dados de campeonatos e clubes via **React Query**, reduzindo requisições redundantes em mais de **60%**.",
        module: "Performance",
      },
    ],
  },
  {
    version: "v2.1.0",
    date: "05 de Agosto de 2026",
    summary:
      "Central de Sugestões colaborativa com votação, alertas em tempo real para administradores e novas fontes de dados.",
    items: [
      {
        id: "rn-21-1",
        type: "feature",
        categoryTag: "New Feature",
        title: "Portal de Sugestões de Recursos",
        description:
          "Espaço onde fotógrafos e jornalistas podem sugerir melhorias, votar em recursos prioritários e acompanhar o status de desenvolvimento.",
        module: "Sugestões",
      },
      {
        id: "rn-21-2",
        type: "feature",
        categoryTag: "New Feature",
        title: "Alertas Administrativos em Tempo Real",
        description:
          "Notificações para a moderação sempre que novas sugestões da comunidade de usuários forem submetidas.",
        module: "Admin",
      },
      {
        id: "rn-21-3",
        type: "improvement",
        categoryTag: "Improvement",
        title: "Fontes de Notícias e Feeds Esportivos",
        description:
          "Módulo para acompanhamento de notícias dos principais portais esportivos para pautas de cobertura fotográfica.",
        module: "Fontes",
      },
    ],
  },
  {
    version: "v2.0.0",
    date: "15 de Junho de 2026",
    badge: "Marco Principal",
    summary:
      "Lançamento da plataforma reformulada **Agenda Esportiva / FotoPress** com sincronização em nuvem e painel de coberturas.",
    items: [
      {
        id: "rn-20-1",
        type: "feature",
        categoryTag: "New Feature",
        title: "Nova Arquitetura com Supabase e TanStack Router",
        description:
          "Reestruturação completa com suporte a tempo real, autenticação segura e navegação SPA de alta velocidade.",
        module: "Core",
      },
      {
        id: "rn-20-2",
        type: "feature",
        categoryTag: "New Feature",
        title: "Dashboard Operacional do Fotógrafo",
        description:
          "Visão consolidada de jogos da semana, status de credenciamento e atalhos rápidos de criação.",
        module: "Dashboard",
      },
      {
        id: "rn-20-3",
        type: "feature",
        categoryTag: "New Feature",
        title: "Minha Agenda Pessoal de Coberturas",
        description:
          "Agendamento pessoal de partidas confirmadas, orçamentos e relatórios de entrega de fotos.",
        module: "Agenda",
      },
    ],
  },
];
