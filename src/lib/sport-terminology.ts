import { useMemo } from "react";

import { useSportPreferences } from "./sport-preferences";

export type SportTerminology = {
  coverageSingular: string;
  coveragePlural: string;
  teamSingular: string;
  teamPlural: string;
  competitionSingular: string;
  competitionPlural: string;
  venueLabel: string;
  athleteRoleLabel: string;
  dataSourceLabel: string;
};

export const FUTEBOL_TERMINOLOGY: SportTerminology = {
  coverageSingular: "Jogo",
  coveragePlural: "Jogos",
  teamSingular: "Clube",
  teamPlural: "Clubes",
  competitionSingular: "Campeonato",
  competitionPlural: "Campeonatos",
  venueLabel: "Estádio",
  athleteRoleLabel: "Posição",
  dataSourceLabel: "Fonte de jogos",
};

export const COLETIVOS_TERMINOLOGY: SportTerminology = {
  coverageSingular: "Jogo",
  coveragePlural: "Jogos",
  teamSingular: "Equipe",
  teamPlural: "Equipes",
  competitionSingular: "Competição",
  competitionPlural: "Competições",
  venueLabel: "Ginásio/Arena",
  athleteRoleLabel: "Posição/Função",
  dataSourceLabel: "Fonte de jogos",
};

export const PROVAS_TERMINOLOGY: SportTerminology = {
  coverageSingular: "Prova",
  coveragePlural: "Provas",
  teamSingular: "Equipe",
  teamPlural: "Assessorias",
  competitionSingular: "Circuito",
  competitionPlural: "Circuitos",
  venueLabel: "Local/Largada",
  athleteRoleLabel: "Distância/Categoria",
  dataSourceLabel: "Fonte de eventos",
};

export const RAQUETE_TERMINOLOGY: SportTerminology = {
  coverageSingular: "Partida",
  coveragePlural: "Partidas",
  teamSingular: "Atleta",
  teamPlural: "Dupla",
  competitionSingular: "Torneio",
  competitionPlural: "Torneios",
  venueLabel: "Quadra/Arena",
  athleteRoleLabel: "Categoria",
  dataSourceLabel: "Fonte de eventos",
};

export const ARTES_MARCIAIS_TERMINOLOGY: SportTerminology = {
  coverageSingular: "Luta",
  coveragePlural: "Lutas",
  teamSingular: "Academia",
  teamPlural: "Equipes",
  competitionSingular: "Torneio",
  competitionPlural: "Torneios",
  venueLabel: "Arena/Tatame",
  athleteRoleLabel: "Categoria/Graduação",
  dataSourceLabel: "Fonte de eventos",
};

export const GENERICA_TERMINOLOGY: SportTerminology = {
  coverageSingular: "Evento",
  coveragePlural: "Eventos",
  teamSingular: "Equipe",
  teamPlural: "Equipes",
  competitionSingular: "Competição",
  competitionPlural: "Competições",
  venueLabel: "Local",
  athleteRoleLabel: "Categoria",
  dataSourceLabel: "Fonte de eventos",
};

const COLETIVOS_KEYS = new Set([
  "futsal",
  "futebol-7",
  "beach-soccer",
  "volei",
  "basquete",
  "handebol",
]);

const PROVAS_KEYS = new Set([
  "corrida",
  "atletismo",
  "ciclismo",
  "mountain-bike",
  "triathlon",
  "natacao",
]);

const RAQUETE_KEYS = new Set(["tenis", "beach-tennis", "futevolei"]);

const ARTES_MARCIAIS_KEYS = new Set(["artes-marciais"]);

const GENERICA_KEYS = new Set(["surf", "crossfit", "automobilismo", "motociclismo", "outros"]);

/**
 * Retorna o vocabulário esportivo adequado com base na chave da modalidade.
 * Se nenhuma modalidade for informada ou for desconhecida, utiliza o vocabulário
 * padrão de futebol como fallback obrigatório.
 */
export function getSportTerminology(sportKey?: string | null): SportTerminology {
  if (!sportKey || typeof sportKey !== "string") {
    return FUTEBOL_TERMINOLOGY;
  }

  const key = sportKey.trim();

  if (key === "futebol") {
    return FUTEBOL_TERMINOLOGY;
  }

  if (COLETIVOS_KEYS.has(key)) {
    return COLETIVOS_TERMINOLOGY;
  }

  if (PROVAS_KEYS.has(key)) {
    return PROVAS_TERMINOLOGY;
  }

  if (RAQUETE_KEYS.has(key)) {
    return RAQUETE_TERMINOLOGY;
  }

  if (ARTES_MARCIAIS_KEYS.has(key)) {
    return ARTES_MARCIAIS_TERMINOLOGY;
  }

  if (GENERICA_KEYS.has(key)) {
    return GENERICA_TERMINOLOGY;
  }

  return FUTEBOL_TERMINOLOGY;
}

/**
 * Hook que fornece a terminologia esportiva atual baseada exclusivamente
 * em `primarySport` de `useSportPreferences()`.
 */
export function useSportTerminology(): SportTerminology {
  const { primarySport } = useSportPreferences();
  return useMemo(() => getSportTerminology(primarySport), [primarySport]);
}
