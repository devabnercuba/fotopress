import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ImportError } from "../types";
import { parseFotoPressTemplate, readTemplateXlsx } from "./parse";
import { normalizeImportedMatch, validateFotoPressTemplate } from "./schema";

const CONTEXT = { competition: "Campeonato Municipal", season: "2026" };

const HEADER = [
  "DATA*",
  "HORA*",
  "CATEGORIA",
  "RODADA",
  "MANDANTE*",
  "VISITANTE*",
  "ESTADIO_LOCAL",
  "CIDADE",
  "UF",
  "OBSERVACOES",
];

describe("modelo oficial — validação de cabeçalho", () => {
  it("aceita os cabeçalhos oficiais com asterisco", () => {
    expect(validateFotoPressTemplate(HEADER).ok).toBe(true);
  });

  it("recusa arquivo sem as colunas obrigatórias", () => {
    const check = validateFotoPressTemplate(["DATA", "MANDANTE", "VISITANTE"]);
    expect(check.ok).toBe(false);
    expect(check.missing).toContain("HORA*");
  });

  it("recusa uma matriz que não é o modelo", () => {
    expect(() => parseFotoPressTemplate([["Jogo", "Time A", "Time B"]], CONTEXT)).toThrow(
      ImportError,
    );
  });
});

describe("modelo oficial — leitura de linhas", () => {
  it("usa competição e temporada da fonte, não do arquivo", () => {
    const { drafts } = parseFotoPressTemplate(
      [
        HEADER,
        ["10/03/2026", "16:00", "", "1", "Joinville", "Avaí", "Arena", "Joinville", "SC", ""],
      ],
      CONTEXT,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      competition: "Campeonato Municipal",
      season: "2026",
      date: "2026-03-10",
      time: "16:00",
      homeTeam: "Joinville",
      awayTeam: "Avaí",
      state: "SC",
      errors: [],
    });
  });

  it("exige horário e recusa data inválida", () => {
    const semHora = normalizeImportedMatch(
      { date: "10/03/2026", homeTeam: "A", awayTeam: "B" },
      CONTEXT,
    );
    expect(semHora.errors).toContain("Informe o horário.");

    const dataRuim = normalizeImportedMatch(
      { date: "31/02/2026", time: "16:00", homeTeam: "A", awayTeam: "B" },
      CONTEXT,
    );
    expect(dataRuim.errors.some((e) => e.startsWith("Data inválida"))).toBe(true);
  });

  it("ignora linhas totalmente vazias", () => {
    const { drafts, emptyRows } = parseFotoPressTemplate(
      [HEADER, ["", "", "", "", "", "", "", "", "", ""]],
      CONTEXT,
    );
    expect(drafts).toHaveLength(0);
    expect(emptyRows).toBe(1);
  });
});

describe("arquivo oficial publicado em /public/templates", () => {
  it("é lido pelo importador com as duas partidas de exemplo", async () => {
    const bytes = readFileSync("public/templates/Modelo_Oficial_FotoPress_Importacao_Jogos.xlsx");
    const file = new File([new Uint8Array(bytes)], "modelo.xlsx");
    const { drafts } = await readTemplateXlsx(file, CONTEXT);
    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.errors.length === 0)).toBe(true);
    expect(drafts[0].competition).toBe("Campeonato Municipal");
  });
});
