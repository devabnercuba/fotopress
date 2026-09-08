import { describe, expect, it } from "vitest";

import {
  ARTES_MARCIAIS_TERMINOLOGY,
  COLETIVOS_TERMINOLOGY,
  FUTEBOL_TERMINOLOGY,
  GENERICA_TERMINOLOGY,
  PROVAS_TERMINOLOGY,
  RAQUETE_TERMINOLOGY,
  getSportTerminology,
} from "./sport-terminology";

describe("Sport Terminology System", () => {
  describe("1. Fallback de futebol", () => {
    it("deve retornar a terminologia de futebol quando sportKey for null ou undefined", () => {
      expect(getSportTerminology(null)).toEqual(FUTEBOL_TERMINOLOGY);
      expect(getSportTerminology(undefined)).toEqual(FUTEBOL_TERMINOLOGY);
      expect(getSportTerminology("")).toEqual(FUTEBOL_TERMINOLOGY);
    });

    it("deve retornar a terminologia de futebol quando sportKey for desconhecido", () => {
      expect(getSportTerminology("desconhecido")).toEqual(FUTEBOL_TERMINOLOGY);
      expect(getSportTerminology("curling")).toEqual(FUTEBOL_TERMINOLOGY);
      expect(getSportTerminology("esporte_invalido")).toEqual(FUTEBOL_TERMINOLOGY);
    });
  });

  describe("2. Terminologia de futebol", () => {
    it("deve retornar os termos exatos de futebol para a chave 'futebol'", () => {
      const term = getSportTerminology("futebol");
      expect(term).toEqual({
        coverageSingular: "Jogo",
        coveragePlural: "Jogos",
        teamSingular: "Clube",
        teamPlural: "Clubes",
        competitionSingular: "Campeonato",
        competitionPlural: "Campeonatos",
        venueLabel: "Estádio",
        athleteRoleLabel: "Posição",
        dataSourceLabel: "Fonte de jogos",
      });
    });
  });

  describe("3. Esportes coletivos", () => {
    const coletivosKeys = ["futsal", "futebol-7", "beach-soccer", "volei", "basquete", "handebol"];

    it.each(coletivosKeys)(
      "deve retornar a terminologia correta para esporte coletivo '%s'",
      (key) => {
        const term = getSportTerminology(key);
        expect(term).toEqual(COLETIVOS_TERMINOLOGY);
        expect(term.coverageSingular).toBe("Jogo");
        expect(term.coveragePlural).toBe("Jogos");
        expect(term.teamSingular).toBe("Equipe");
        expect(term.teamPlural).toBe("Equipes");
        expect(term.competitionSingular).toBe("Competição");
        expect(term.competitionPlural).toBe("Competições");
        expect(term.venueLabel).toBe("Ginásio/Arena");
        expect(term.athleteRoleLabel).toBe("Posição/Função");
        expect(term.dataSourceLabel).toBe("Fonte de jogos");
      },
    );
  });

  describe("4. Provas (corrida, atletismo, ciclismo, triathlon, natação, etc.)", () => {
    const provasKeys = [
      "corrida",
      "atletismo",
      "ciclismo",
      "mountain-bike",
      "triathlon",
      "natacao",
    ];

    it.each(provasKeys)(
      "deve retornar a terminologia correta para modalidade de prova '%s'",
      (key) => {
        const term = getSportTerminology(key);
        expect(term).toEqual(PROVAS_TERMINOLOGY);
        expect(term.coverageSingular).toBe("Prova");
        expect(term.coveragePlural).toBe("Provas");
        expect(term.teamSingular).toBe("Equipe");
        expect(term.teamPlural).toBe("Assessorias");
        expect(term.competitionSingular).toBe("Circuito");
        expect(term.competitionPlural).toBe("Circuitos");
        expect(term.venueLabel).toBe("Local/Largada");
        expect(term.athleteRoleLabel).toBe("Distância/Categoria");
        expect(term.dataSourceLabel).toBe("Fonte de eventos");
      },
    );
  });

  describe("5. Esportes de raquete e duplas (tênis, beach tennis, futevôlei)", () => {
    const raqueteKeys = ["tenis", "beach-tennis", "futevolei"];

    it.each(raqueteKeys)(
      "deve retornar a terminologia correta para modalidade de raquete '%s'",
      (key) => {
        const term = getSportTerminology(key);
        expect(term).toEqual(RAQUETE_TERMINOLOGY);
        expect(term.coverageSingular).toBe("Partida");
        expect(term.coveragePlural).toBe("Partidas");
        expect(term.teamSingular).toBe("Atleta");
        expect(term.teamPlural).toBe("Dupla");
        expect(term.competitionSingular).toBe("Torneio");
        expect(term.competitionPlural).toBe("Torneios");
        expect(term.venueLabel).toBe("Quadra/Arena");
        expect(term.athleteRoleLabel).toBe("Categoria");
        expect(term.dataSourceLabel).toBe("Fonte de eventos");
      },
    );
  });

  describe("6. Artes marciais", () => {
    it("deve retornar a terminologia correta para 'artes-marciais'", () => {
      const term = getSportTerminology("artes-marciais");
      expect(term).toEqual(ARTES_MARCIAIS_TERMINOLOGY);
      expect(term.coverageSingular).toBe("Luta");
      expect(term.coveragePlural).toBe("Lutas");
      expect(term.teamSingular).toBe("Academia");
      expect(term.teamPlural).toBe("Equipes");
      expect(term.competitionSingular).toBe("Torneio");
      expect(term.competitionPlural).toBe("Torneios");
      expect(term.venueLabel).toBe("Arena/Tatame");
      expect(term.athleteRoleLabel).toBe("Categoria/Graduação");
      expect(term.dataSourceLabel).toBe("Fonte de eventos");
    });
  });

  describe("7. Modalidade genérica (surf, crossfit, automobilismo, motociclismo, outros)", () => {
    const genericaKeys = ["surf", "crossfit", "automobilismo", "motociclismo", "outros"];

    it.each(genericaKeys)("deve retornar a terminologia genérica para modalidade '%s'", (key) => {
      const term = getSportTerminology(key);
      expect(term).toEqual(GENERICA_TERMINOLOGY);
      expect(term.coverageSingular).toBe("Evento");
      expect(term.coveragePlural).toBe("Eventos");
      expect(term.teamSingular).toBe("Equipe");
      expect(term.teamPlural).toBe("Equipes");
      expect(term.competitionSingular).toBe("Competição");
      expect(term.competitionPlural).toBe("Competições");
      expect(term.venueLabel).toBe("Local");
      expect(term.athleteRoleLabel).toBe("Categoria");
      expect(term.dataSourceLabel).toBe("Fonte de eventos");
    });
  });
});
