import { describe, expect, it } from "vitest";

import {
  athleteNumberLabel,
  athleteRoleSuggestions,
  participantLabels,
  usesMatchFirstWorkflow,
} from "./sport-form-config";

describe("sport-form-config", () => {
  describe("fluxo principal (usesMatchFirstWorkflow)", () => {
    it("deve identificar futebol como fluxo principal de partida", () => {
      expect(usesMatchFirstWorkflow("futebol")).toBe(true);
      expect(usesMatchFirstWorkflow("futsal")).toBe(true);
      expect(usesMatchFirstWorkflow("futebol-7")).toBe(true);
      expect(usesMatchFirstWorkflow("fut7")).toBe(true);
      expect(usesMatchFirstWorkflow("beach-soccer")).toBe(true);
    });

    it("deve identificar modalidades de raquete como fluxo de partida", () => {
      expect(usesMatchFirstWorkflow("tenis")).toBe(true);
      expect(usesMatchFirstWorkflow("beach-tennis")).toBe(true);
      expect(usesMatchFirstWorkflow("futevolei")).toBe(true);
      expect(usesMatchFirstWorkflow("padel")).toBe(true);
      expect(usesMatchFirstWorkflow("tenis-de-mesa")).toBe(true);
      expect(usesMatchFirstWorkflow("badminton")).toBe(true);
    });

    it("deve identificar esportes coletivos como fluxo de partida", () => {
      expect(usesMatchFirstWorkflow("volei")).toBe(true);
      expect(usesMatchFirstWorkflow("basquete")).toBe(true);
      expect(usesMatchFirstWorkflow("handebol")).toBe(true);
    });

    it("deve identificar corrida e outras modalidades como fluxo de evento/prova", () => {
      expect(usesMatchFirstWorkflow("corrida")).toBe(false);
      expect(usesMatchFirstWorkflow("atletismo")).toBe(false);
      expect(usesMatchFirstWorkflow("ciclismo")).toBe(false);
      expect(usesMatchFirstWorkflow("mountain-bike")).toBe(false);
      expect(usesMatchFirstWorkflow("triathlon")).toBe(false);
      expect(usesMatchFirstWorkflow("natacao")).toBe(false);
      expect(usesMatchFirstWorkflow("artes-marciais")).toBe(false);
      expect(usesMatchFirstWorkflow("surf")).toBe(false);
      expect(usesMatchFirstWorkflow("crossfit")).toBe(false);
      expect(usesMatchFirstWorkflow("automobilismo")).toBe(false);
      expect(usesMatchFirstWorkflow("motociclismo")).toBe(false);
      expect(usesMatchFirstWorkflow("outros")).toBe(false);
    });

    it("deve aplicar fallback para futebol quando nulo, indefinido ou vazio", () => {
      expect(usesMatchFirstWorkflow(null)).toBe(true);
      expect(usesMatchFirstWorkflow(undefined)).toBe(true);
      expect(usesMatchFirstWorkflow("")).toBe(true);
      expect(usesMatchFirstWorkflow("   ")).toBe(true);
    });
  });

  describe("rótulos de participantes (participantLabels)", () => {
    it("deve retornar Mandante e Visitante para futebol e esportes coletivos", () => {
      expect(participantLabels("futebol")).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
      expect(participantLabels("futsal")).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
      expect(participantLabels("volei")).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
      expect(participantLabels("basquete")).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
      expect(participantLabels("handebol")).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
    });

    it("deve retornar Participante 1 e Participante 2 para raquetes", () => {
      expect(participantLabels("tenis")).toEqual({
        homeLabel: "Participante 1",
        awayLabel: "Participante 2",
      });
      expect(participantLabels("beach-tennis")).toEqual({
        homeLabel: "Participante 1",
        awayLabel: "Participante 2",
      });
      expect(participantLabels("padel")).toEqual({
        homeLabel: "Participante 1",
        awayLabel: "Participante 2",
      });
    });

    it("deve retornar Participante 1 e Participante 2 para modalidades genéricas e eventos", () => {
      expect(participantLabels("corrida")).toEqual({
        homeLabel: "Participante 1",
        awayLabel: "Participante 2",
      });
      expect(participantLabels("surf")).toEqual({
        homeLabel: "Participante 1",
        awayLabel: "Participante 2",
      });
    });

    it("deve aplicar fallback para futebol (Mandante/Visitante) quando vazio ou nulo", () => {
      expect(participantLabels(null)).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
      expect(participantLabels(undefined)).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
      expect(participantLabels("")).toEqual({
        homeLabel: "Mandante",
        awayLabel: "Visitante",
      });
    });
  });

  describe("rótulos de numeração (athleteNumberLabel)", () => {
    it("deve retornar 'Camisa' para esportes coletivos", () => {
      expect(athleteNumberLabel("futebol")).toBe("Camisa");
      expect(athleteNumberLabel("futsal")).toBe("Camisa");
      expect(athleteNumberLabel("volei")).toBe("Camisa");
      expect(athleteNumberLabel("basquete")).toBe("Camisa");
      expect(athleteNumberLabel("handebol")).toBe("Camisa");
    });

    it("deve retornar 'Número de peito' para corrida, atletismo e triathlon", () => {
      expect(athleteNumberLabel("corrida")).toBe("Número de peito");
      expect(athleteNumberLabel("atletismo")).toBe("Número de peito");
      expect(athleteNumberLabel("triathlon")).toBe("Número de peito");
    });

    it("deve retornar 'Número do veículo' para automobilismo e motociclismo", () => {
      expect(athleteNumberLabel("automobilismo")).toBe("Número do veículo");
      expect(athleteNumberLabel("motociclismo")).toBe("Número do veículo");
    });

    it("deve retornar 'Número' para as demais modalidades", () => {
      expect(athleteNumberLabel("tenis")).toBe("Número");
      expect(athleteNumberLabel("beach-tennis")).toBe("Número");
      expect(athleteNumberLabel("ciclismo")).toBe("Número");
      expect(athleteNumberLabel("artes-marciais")).toBe("Número");
      expect(athleteNumberLabel("surf")).toBe("Número");
      expect(athleteNumberLabel("outros")).toBe("Número");
    });

    it("deve aplicar fallback para futebol ('Camisa') quando vazio ou nulo", () => {
      expect(athleteNumberLabel(null)).toBe("Camisa");
      expect(athleteNumberLabel(undefined)).toBe("Camisa");
      expect(athleteNumberLabel("")).toBe("Camisa");
    });
  });

  describe("sugestões de posições/funções de atletas (athleteRoleSuggestions)", () => {
    it("deve fornecer sugestões para futebol", () => {
      expect(athleteRoleSuggestions("futebol")).toEqual([
        "Goleiro",
        "Lateral",
        "Zagueiro",
        "Volante",
        "Meia",
        "Atacante",
        "Técnico",
      ]);
    });

    it("deve fornecer sugestões para futsal", () => {
      expect(athleteRoleSuggestions("futsal")).toEqual([
        "Goleiro",
        "Fixo",
        "Ala",
        "Pivô",
        "Técnico",
      ]);
    });

    it("deve fornecer sugestões para vôlei", () => {
      expect(athleteRoleSuggestions("volei")).toEqual([
        "Levantador",
        "Oposto",
        "Ponteiro",
        "Central",
        "Líbero",
        "Técnico",
      ]);
    });

    it("deve fornecer sugestões para basquete", () => {
      expect(athleteRoleSuggestions("basquete")).toEqual([
        "Armador",
        "Ala-armador",
        "Ala",
        "Ala-pivô",
        "Pivô",
        "Técnico",
      ]);
    });

    it("deve fornecer sugestões para handebol", () => {
      expect(athleteRoleSuggestions("handebol")).toEqual([
        "Goleiro",
        "Ponta",
        "Armador",
        "Central",
        "Pivô",
        "Técnico",
      ]);
    });

    it("deve fornecer sugestões para corridas e atletismo", () => {
      expect(athleteRoleSuggestions("corrida")).toEqual(["Atleta", "Pacer", "Guia", "Técnico"]);
      expect(athleteRoleSuggestions("atletismo")).toEqual(["Atleta", "Pacer", "Guia", "Técnico"]);
    });

    it("deve fornecer sugestões para ciclismo", () => {
      expect(athleteRoleSuggestions("ciclismo")).toEqual([
        "Atleta",
        "Sprinter",
        "Escalador",
        "Contrarrelógio",
        "Técnico",
      ]);
    });

    it("deve fornecer sugestões para lutas / artes marciais", () => {
      expect(athleteRoleSuggestions("artes-marciais")).toEqual([
        "Atleta",
        "Professor",
        "Técnico",
        "Mestre",
      ]);
    });

    it("deve fornecer sugestões para demais modalidades", () => {
      expect(athleteRoleSuggestions("tenis")).toEqual(["Atleta", "Técnico", "Comissão técnica"]);
      expect(athleteRoleSuggestions("surf")).toEqual(["Atleta", "Técnico", "Comissão técnica"]);
    });

    it("deve aplicar fallback para futebol quando nulo ou vazio", () => {
      expect(athleteRoleSuggestions(null)).toEqual([
        "Goleiro",
        "Lateral",
        "Zagueiro",
        "Volante",
        "Meia",
        "Atacante",
        "Técnico",
      ]);
      expect(athleteRoleSuggestions("")).toEqual([
        "Goleiro",
        "Lateral",
        "Zagueiro",
        "Volante",
        "Meia",
        "Atacante",
        "Técnico",
      ]);
    });
  });
});
