import { useMemo } from "react";

import { useSportPreferences } from "./sport-preferences";
import { getSportTerminology, type SportTerminology } from "./sport-terminology";

export type ParticipantLabels = {
  homeLabel: string;
  awayLabel: string;
};

/** Normaliza chave esportiva para lookup seguro em formulários. */
export function normalizeSportFormKey(sport?: string | null): string {
  if (!sport || typeof sport !== "string") return "futebol";
  const clean = sport
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s._/]+/g, "-");
  return clean || "futebol";
}

/**
 * Modalidades cujo fluxo operacional é centrado em partidas (Match-first).
 * As demais utilizam eventos/provas como fluxo principal.
 */
const MATCH_FIRST_SPORTS = new Set([
  "futebol",
  "futsal",
  "fut7",
  "futebol-7",
  "futebol-de-campo",
  "beach-soccer",
  "volei",
  "voleibol",
  "basquete",
  "basquetebol",
  "handebol",
  "tenis",
  "beach-tennis",
  "futevolei",
  "padel",
  "tenis-de-mesa",
  "badminton",
]);

/**
 * Retorna se a modalidade tem fluxo principal de partida.
 * Fallback obrigatório: futebol (retorna true para nulo/indefinido/vazio).
 */
export function usesMatchFirstWorkflow(primarySport?: string | null): boolean {
  if (!primarySport || typeof primarySport !== "string" || !primarySport.trim()) {
    return true; // Fallback futebol
  }
  const key = normalizeSportFormKey(primarySport);
  return MATCH_FIRST_SPORTS.has(key);
}

const TEAM_SPORTS_PARTICIPANTS = new Set([
  "futebol",
  "futsal",
  "fut7",
  "futebol-7",
  "futebol-de-campo",
  "beach-soccer",
  "volei",
  "voleibol",
  "basquete",
  "basquetebol",
  "handebol",
]);

/**
 * Rótulos para os lados de uma partida / confronto.
 * - Futebol e esportes coletivos: Mandante e Visitante.
 * - Raquetes e modalidades genéricas: Participante 1 e Participante 2.
 * - Fallback: Mandante e Visitante (futebol).
 */
export function participantLabels(primarySport?: string | null): ParticipantLabels {
  if (!primarySport || typeof primarySport !== "string" || !primarySport.trim()) {
    return { homeLabel: "Mandante", awayLabel: "Visitante" };
  }
  const key = normalizeSportFormKey(primarySport);
  if (TEAM_SPORTS_PARTICIPANTS.has(key)) {
    return { homeLabel: "Mandante", awayLabel: "Visitante" };
  }
  return { homeLabel: "Participante 1", awayLabel: "Participante 2" };
}

const TEAM_SPORTS_NUMBERS = new Set([
  "futebol",
  "futsal",
  "fut7",
  "futebol-7",
  "futebol-de-campo",
  "beach-soccer",
  "volei",
  "voleibol",
  "basquete",
  "basquetebol",
  "handebol",
]);

const RACE_SPORTS_NUMBERS = new Set([
  "corrida",
  "corrida-de-rua",
  "atletismo",
  "triathlon",
  "triatlo",
]);

const MOTOR_SPORTS_NUMBERS = new Set(["automobilismo", "motociclismo"]);

/**
 * Rótulo para o número do atleta ou competidor:
 * - Esportes coletivos: "Camisa"
 * - Corrida, atletismo e triathlon: "Número de peito"
 * - Automobilismo e motociclismo: "Número do veículo"
 * - Demais modalidades: "Número"
 * - Fallback: "Camisa" (futebol)
 */
export function athleteNumberLabel(primarySport?: string | null): string {
  if (!primarySport || typeof primarySport !== "string" || !primarySport.trim()) {
    return "Camisa";
  }
  const key = normalizeSportFormKey(primarySport);
  if (TEAM_SPORTS_NUMBERS.has(key)) {
    return "Camisa";
  }
  if (RACE_SPORTS_NUMBERS.has(key)) {
    return "Número de peito";
  }
  if (MOTOR_SPORTS_NUMBERS.has(key)) {
    return "Número do veículo";
  }
  return "Número";
}

const FUTEBOL_ROLES = ["Goleiro", "Lateral", "Zagueiro", "Volante", "Meia", "Atacante", "Técnico"];

const FUTSAL_ROLES = ["Goleiro", "Fixo", "Ala", "Pivô", "Técnico"];

const VOLEI_ROLES = ["Levantador", "Oposto", "Ponteiro", "Central", "Líbero", "Técnico"];

const BASQUETE_ROLES = ["Armador", "Ala-armador", "Ala", "Ala-pivô", "Pivô", "Técnico"];

const HANDEBOL_ROLES = ["Goleiro", "Ponta", "Armador", "Central", "Pivô", "Técnico"];

const CORRIDAS_ROLES = ["Atleta", "Pacer", "Guia", "Técnico"];

const CICLISMO_ROLES = ["Atleta", "Sprinter", "Escalador", "Contrarrelógio", "Técnico"];

const LUTAS_ROLES = ["Atleta", "Professor", "Técnico", "Mestre"];

const DEMAIS_ROLES = ["Atleta", "Técnico", "Comissão técnica"];

/**
 * Sugestões de posições/funções para o cadastro de atletas na modalidade indicada.
 * Fallback: funções clássicas de futebol.
 */
export function athleteRoleSuggestions(primarySport?: string | null): string[] {
  if (!primarySport || typeof primarySport !== "string" || !primarySport.trim()) {
    return FUTEBOL_ROLES;
  }
  const key = normalizeSportFormKey(primarySport);

  if (
    key === "futebol" ||
    key === "futebol-de-campo" ||
    key === "futebol-7" ||
    key === "fut7" ||
    key === "beach-soccer"
  ) {
    return FUTEBOL_ROLES;
  }
  if (key === "futsal") {
    return FUTSAL_ROLES;
  }
  if (key === "volei" || key === "voleibol") {
    return VOLEI_ROLES;
  }
  if (key === "basquete" || key === "basquetebol") {
    return BASQUETE_ROLES;
  }
  if (key === "handebol") {
    return HANDEBOL_ROLES;
  }
  if (
    key === "corrida" ||
    key === "corrida-de-rua" ||
    key === "atletismo" ||
    key === "triathlon" ||
    key === "triatlo"
  ) {
    return CORRIDAS_ROLES;
  }
  if (key === "ciclismo" || key === "mountain-bike") {
    return CICLISMO_ROLES;
  }
  if (
    key === "artes-marciais" ||
    key === "judo" ||
    key === "jiu-jitsu" ||
    key === "karate" ||
    key === "taekwondo" ||
    key === "boxe" ||
    key === "mma"
  ) {
    return LUTAS_ROLES;
  }

  return DEMAIS_ROLES;
}

/** Hook conveniente para componentes consumirem as configurações de formulário ativas. */
export function useSportFormConfig(overrideSport?: string | null): {
  sportKey: string;
  isMatchFirst: boolean;
  participants: ParticipantLabels;
  numberLabel: string;
  roleSuggestions: string[];
  terminology: SportTerminology;
} {
  const { primarySport } = useSportPreferences();
  const effectiveSport = overrideSport?.trim() || primarySport;

  return useMemo(() => {
    return {
      sportKey: effectiveSport,
      isMatchFirst: usesMatchFirstWorkflow(effectiveSport),
      participants: participantLabels(effectiveSport),
      numberLabel: athleteNumberLabel(effectiveSport),
      roleSuggestions: athleteRoleSuggestions(effectiveSport),
      terminology: getSportTerminology(effectiveSport),
    };
  }, [effectiveSport]);
}
