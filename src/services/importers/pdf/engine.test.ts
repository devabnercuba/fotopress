import { describe, expect, it } from "vitest";

import { parsePdfText } from "./engine";

const FEDERACAO = `
FEDERAÇÃO PAULISTA DE FUTEBOL
CAMPEONATO PAULISTA SÉRIE A2 2026
Jogo nº 1
17/07/2026
19h30
Marília 1 X 0 Grêmio Prudente
Local:
Estádio Municipal Bento de Abreu Sampaio Vidal
Cidade:
Marília
Transmissão:
Metrópoles
Jogo nº 35
22/08/2026
15h00
Grêmio Prudente X Marília
Local:
Estádio Municipal Pedro Marin Berbel
Cidade:
Birigui
`;

const MUNICIPAL = `
XXVIII CAMPEONATO MUNICIPAL DE FUTSAL AMADOR DE BOMBINHAS
1ª SEMANA
TERÇA — 07/07/2026
11 | 19h30 | S.B. Grupo(A) | Guerreiros de Bomba | X | Rio Branco
12 | 20h15 | Série A | OS Pau Mandado | X | Tainha Futebol Clube
13 | 21h00 | S.B. Grupo(B) | Amigos | X | Afaso B
QUARTA — 08/07/2026
6 | 21h00 | Feminino | Boca Jr | X | Mariscal
20 | 20h00 | Oitavas - Série B | 1º colocado | X | 4º colocado
`;

describe("parsePdfText — tabela de federação (blocos)", () => {
  const result = parsePdfText(FEDERACAO);

  it("detecta as duas partidas", () => {
    expect(result.matches).toHaveLength(2);
  });

  it("lê data, hora, clubes, placar e local literalmente", () => {
    const first = result.matches[0];
    expect(first.matchNumber).toBe("1");
    expect(first.date).toBe("2026-07-17");
    expect(first.time).toBe("19:30");
    expect(first.homeTeam).toBe("Marília");
    expect(first.awayTeam).toBe("Grêmio Prudente");
    expect(first.homeScore).toBe(1);
    expect(first.awayScore).toBe(0);
    expect(first.status).toBe("completed");
    expect(first.venue).toBe("Estádio Municipal Bento de Abreu Sampaio Vidal");
    expect(first.city).toBe("Marília");
    expect(first.broadcast).toBe("Metrópoles");
  });

  it("não inventa placar quando há apenas o separador", () => {
    const second = result.matches[1];
    expect(second.date).toBe("2026-08-22");
    expect(second.time).toBe("15:00");
    expect(second.homeTeam).toBe("Grêmio Prudente");
    expect(second.awayTeam).toBe("Marília");
    expect(second.homeScore).toBeNull();
    expect(second.status).toBe("scheduled");
  });

  it("sugere a competição a partir do título", () => {
    expect(result.competition).toMatch(/CAMPEONATO PAULISTA/i);
  });
});

describe("parsePdfText — tabela municipal (linhas com herança de data)", () => {
  const result = parsePdfText(MUNICIPAL);

  it("detecta todos os jogos", () => {
    expect(result.matches).toHaveLength(5);
  });

  it("herda a data do cabeçalho de seção", () => {
    expect(result.matches.slice(0, 3).every((m) => m.date === "2026-07-07")).toBe(true);
    expect(result.matches[3].date).toBe("2026-07-08");
  });

  it("separa categoria e grupo", () => {
    expect(result.matches[0].category).toBe("Série B");
    expect(result.matches[0].group).toBe("Grupo A");
    expect(result.matches[1].category).toBe("Série A");
    expect(result.matches[3].category).toBe("Feminino");
  });

  it("guarda horário, número do jogo e semana", () => {
    expect(result.matches[1].time).toBe("20:15");
    expect(result.matches[1].matchNumber).toBe("12");
    expect(result.matches[0].roundLabel).toBe("1ª Semana");
  });

  it("mantém participantes indefinidos como partida", () => {
    const tbd = result.matches[4];
    expect(tbd.homeTeam).toBe("1º colocado");
    expect(tbd.awayTeam).toBe("4º colocado");
    expect(tbd.participantsTbd).toBe(true);
    expect(tbd.phase).toBe("Oitavas");
  });

  it("não cria clube a partir de categoria", () => {
    const names = result.matches.flatMap((m) => [m.homeTeam, m.awayTeam]);
    expect(names).not.toContain("Série A");
  });

  it("gera relatório do arquivo", () => {
    expect(result.report.withDate).toBe(5);
    expect(result.report.tbdParticipants).toBe(1);
  });
});
