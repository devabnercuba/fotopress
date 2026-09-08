import { useMemo } from "react";

import { useSettings } from "./settings";
import { normalizeSport } from "./sports";

/**
 * Modalidades do usuário
 * ----------------------
 * Guardadas em `app_settings.sports` (uma linha por usuário, já protegida por
 * RLS). São apenas uma PERSONALIZAÇÃO DA INTERFACE: desativar uma modalidade
 * nunca remove jogos, eventos, fontes, atletas, agenda ou histórico.
 */
export const SPORT_OPTIONS = [
  { key: "futebol", label: "Futebol de campo" },
  { key: "futsal", label: "Futsal" },
  { key: "futebol-7", label: "Futebol 7" },
  { key: "beach-soccer", label: "Beach Soccer" },
  { key: "futevolei", label: "Futevôlei" },
  { key: "beach-tennis", label: "Beach Tennis" },
  { key: "volei", label: "Vôlei" },
  { key: "basquete", label: "Basquete" },
  { key: "handebol", label: "Handebol" },
  { key: "corrida", label: "Corrida de rua" },
  { key: "atletismo", label: "Atletismo" },
  { key: "ciclismo", label: "Ciclismo" },
  { key: "mountain-bike", label: "Mountain Bike" },
  { key: "triathlon", label: "Triathlon" },
  { key: "natacao", label: "Natação" },
  { key: "surf", label: "Surf" },
  { key: "tenis", label: "Tênis" },
  { key: "artes-marciais", label: "Artes marciais" },
  { key: "crossfit", label: "CrossFit" },
  { key: "automobilismo", label: "Automobilismo" },
  { key: "motociclismo", label: "Motociclismo" },
  { key: "outros", label: "Outras modalidades esportivas" },
] as const;

export type SportKey = (typeof SPORT_OPTIONS)[number]["key"];

/** Valida se uma chave pertence exatamente ao catálogo SPORT_OPTIONS */
export function isValidSportKey(key: unknown): key is SportKey {
  return typeof key === "string" && SPORT_OPTIONS.some((s) => s.key === key.trim());
}

/** Rótulo apresentável de uma chave de modalidade. */
export function sportLabel(key: string) {
  return SPORT_OPTIONS.find((s) => s.key === key)?.label ?? key;
}

/**
 * Computa de forma pura as preferências esportivas do usuário.
 * - primarySport: usa "futebol" como fallback e valida chave com SPORT_OPTIONS.
 * - activeSports: sempre inclui a modalidade principal, sem duplicações.
 * - additionalSports: nunca inclui a modalidade principal.
 */
export function computeSportPreferences(
  settingsPrimarySport?: string | null,
  settingsSports?: string[] | null,
) {
  const rawPrimary = typeof settingsPrimarySport === "string" ? settingsPrimarySport.trim() : "";
  const primarySport = isValidSportKey(rawPrimary) ? rawPrimary : "futebol";

  const rawSports = Array.isArray(settingsSports) ? settingsSports : [];

  const activeSportsSet = new Set<string>([primarySport]);
  for (const s of rawSports) {
    if (typeof s === "string" && s.trim()) {
      activeSportsSet.add(s.trim());
    }
  }

  const activeSports = Array.from(activeSportsSet);
  const additionalSports = activeSports.filter((s) => s !== primarySport);
  const hasPreferences =
    rawSports.length > 0 || (!!settingsPrimarySport && settingsPrimarySport.trim() !== "futebol");

  return {
    primarySport,
    activeSports,
    additionalSports,
    hasPreferences,
    isActive: (key: string) => activeSports.length === 0 || activeSports.includes(key),
  };
}

/**
 * Preferências do usuário. Conta nova ou sem escolhas utiliza
 * futebol como modalidade principal padrão.
 */
export function useSportPreferences() {
  const { data: settings, isLoading } = useSettings();
  const computed = useMemo(
    () => computeSportPreferences(settings?.primary_sport, settings?.sports),
    [settings?.primary_sport, settings?.sports],
  );

  return {
    isLoading,
    ...computed,
    /** Compatibilidade retroativa para código existente que consome `sports` */
    sports: computed.activeSports,
  };
}

/** Modalidades ativas em rótulos livres (usados por eventos e atletas). */
export function useSportLabelPriority() {
  const { activeSports } = useSportPreferences();
  return useMemo(
    () => activeSports.map((key) => normalizeSport(sportLabel(key))!).filter(Boolean),
    [activeSports],
  );
}
