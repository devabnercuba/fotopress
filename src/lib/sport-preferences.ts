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
  { key: "corrida", label: "Corrida" },
  { key: "beach-tennis", label: "Beach Tennis" },
  { key: "crossfit", label: "CrossFit" },
  { key: "volei", label: "Vôlei" },
  { key: "ciclismo", label: "Ciclismo" },
  { key: "triathlon", label: "Triathlon" },
  { key: "beach-soccer", label: "Beach Soccer" },
  { key: "futevolei", label: "Futevôlei" },
  { key: "outros", label: "Outros" },
] as const;

export type SportKey = (typeof SPORT_OPTIONS)[number]["key"];

/** Rótulo apresentável de uma chave de modalidade. */
export function sportLabel(key: string) {
  return SPORT_OPTIONS.find((s) => s.key === key)?.label ?? key;
}

/**
 * Preferências do usuário. Conta nova (lista vazia) significa
 * "mostrar tudo" — nunca deixa a interface inutilizável.
 */
export function useSportPreferences() {
  const { data: settings, isLoading } = useSettings();
  const sports = useMemo(
    () => (Array.isArray(settings?.sports) ? (settings!.sports as string[]) : []),
    [settings],
  );
  return {
    isLoading,
    /** Chaves ativas; vazio = usuário ainda não escolheu. */
    sports,
    hasPreferences: sports.length > 0,
    isActive: (key: string) => sports.length === 0 || sports.includes(key),
  };
}

/** Modalidades ativas em rótulos livres (usados por eventos e atletas). */
export function useSportLabelPriority() {
  const { sports } = useSportPreferences();
  return useMemo(
    () => sports.map((key) => normalizeSport(sportLabel(key))!).filter(Boolean),
    [sports],
  );
}
