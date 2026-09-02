# FotoPress

FotoPress é o sistema de trabalho do fotógrafo e do jornalista esportivo: reúne
jogos, eventos, credenciamento, agenda, clientes, notícias e financeiro em um só
lugar.

## Módulos

- **Jogos/Eventos** — partidas e eventos esportivos (corridas, beach tennis,
  torneios) em abas separadas, com filtros por data, estado e modalidade.
- **Credenciamento** — fluxo Solicitado → Aprovado → Minha Agenda.
- **Minha Agenda / Concluídos** — coberturas confirmadas e histórico.
- **Atletas/Clientes** — CRM comercial com kanban por jogo e por evento.
  A exclusão é um arquivamento: o histórico comercial é preservado.
- **Clubes** — identidade dos clubes e revisão de duplicados.
- **Financeiro** — receitas e despesas por cobertura, com resumo gravado no
  lançamento para o histórico sobreviver à exclusão da partida.
- **Fontes de Jogos** — importadores CBF, FCF, FPF, LNF, PDF/XLSX oficiais e URL.
- **Notícias** — portal editorial com leitor interno e Radar da partida.
- **Novidades, Sugestões, Primeiros passos** — comunicação com o usuário.

## Identidade dos clubes

Um clube é identificado por
`user_id + nome normalizado + modalidade + categoria + gênero`.

Consequências práticas:

- "Avaí" do profissional, "Avaí" sub-20 e "Avaí" futsal feminino são registros
  distintos e legítimos.
- Nomes nunca recebem sufixo numérico ("Avaí 2") para diferenciar cadastros.
- O escudo pertence ao clube exato (`team_id`); escudo enviado manualmente nunca
  é sobrescrito por importação.
- A tela **Clubes** diagnostica homônimos e só sugere mesclagem quando a
  identidade completa coincide. A mesclagem transfere jogos, atletas e fontes de
  forma transacional.

## Tecnologia

React 19 + TypeScript, TanStack Start/Router, Tailwind CSS v4, shadcn/ui e
Lovable Cloud (banco, autenticação, arquivos e funções de servidor).

Rotas ficam em `src/routes`, regras de domínio em `src/lib` e importadores em
`src/services/importers`.

## Desenvolvimento

```bash
bun install
bun run dev
bunx vitest run
```

O domínio público é centralizado em `src/lib/app-url.ts` (`VITE_APP_URL`).
