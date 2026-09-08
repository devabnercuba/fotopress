import { describe, expect, it } from "vitest";

import { normalizeSettings } from "@/lib/settings";
import {
  SPORT_OPTIONS,
  computeSportPreferences,
  isValidSportKey,
  sportLabel,
} from "@/lib/sport-preferences";

describe("SPORT_OPTIONS catalog", () => {
  it("contains all 22 required multi-sport options with unique keys", () => {
    const keys = SPORT_OPTIONS.map((s) => s.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(SPORT_OPTIONS.length);
    expect(SPORT_OPTIONS.length).toBe(22);
  });

  it("validates keys using isValidSportKey correctly", () => {
    expect(isValidSportKey("futebol")).toBe(true);
    expect(isValidSportKey("futsal")).toBe(true);
    expect(isValidSportKey("beach-tennis")).toBe(true);
    expect(isValidSportKey("crossfit")).toBe(true);
    expect(isValidSportKey("nonexistent")).toBe(false);
    expect(isValidSportKey("")).toBe(false);
    expect(isValidSportKey(null)).toBe(false);
    expect(isValidSportKey(undefined)).toBe(false);
  });

  it("includes all requested sport options", () => {
    const expectedKeys = [
      "futebol",
      "futsal",
      "futebol-7",
      "beach-soccer",
      "futevolei",
      "beach-tennis",
      "volei",
      "basquete",
      "handebol",
      "corrida",
      "atletismo",
      "ciclismo",
      "mountain-bike",
      "triathlon",
      "natacao",
      "surf",
      "tenis",
      "artes-marciais",
      "crossfit",
      "automobilismo",
      "motociclismo",
      "outros",
    ];

    for (const key of expectedKeys) {
      expect(SPORT_OPTIONS.some((s) => s.key === key)).toBe(true);
    }
  });

  it("returns human-readable labels correctly via sportLabel", () => {
    expect(sportLabel("futebol")).toBe("Futebol de campo");
    expect(sportLabel("corrida")).toBe("Corrida de rua");
    expect(sportLabel("crossfit")).toBe("CrossFit");
    expect(sportLabel("unknown-sport")).toBe("unknown-sport");
  });
});

describe("computeSportPreferences", () => {
  it("falls back to 'futebol' when primarySport is absent, empty, or whitespace", () => {
    const res1 = computeSportPreferences(null, null);
    expect(res1.primarySport).toBe("futebol");
    expect(res1.activeSports).toEqual(["futebol"]);
    expect(res1.additionalSports).toEqual([]);

    const res2 = computeSportPreferences("   ", []);
    expect(res2.primarySport).toBe("futebol");
    expect(res2.activeSports).toEqual(["futebol"]);
  });

  it("mandatorily includes primarySport in activeSports without duplication", () => {
    // Caso em que a modalidade principal também já estava na lista de esportes
    const res = computeSportPreferences("futsal", ["futsal", "corrida", "futsal"]);
    expect(res.primarySport).toBe("futsal");
    expect(res.activeSports).toEqual(["futsal", "corrida"]);
  });

  it("adds primarySport even if not present in sports array", () => {
    const res = computeSportPreferences("basquete", ["volei", "handebol"]);
    expect(res.primarySport).toBe("basquete");
    expect(res.activeSports).toEqual(["basquete", "volei", "handebol"]);
  });

  it("ensures additionalSports NEVER contains primarySport", () => {
    const res = computeSportPreferences("ciclismo", ["ciclismo", "mountain-bike", "triathlon"]);
    expect(res.primarySport).toBe("ciclismo");
    expect(res.additionalSports).toEqual(["mountain-bike", "triathlon"]);
    expect(res.additionalSports.includes("ciclismo")).toBe(false);
  });

  it("checks isActive correctly according to activeSports", () => {
    const res = computeSportPreferences("surf", ["natacao"]);
    expect(res.isActive("surf")).toBe(true);
    expect(res.isActive("natacao")).toBe(true);
    expect(res.isActive("futebol")).toBe(false);
    expect(res.isActive("basquete")).toBe(false);
  });

  it("computes hasPreferences flag accurately", () => {
    // Default inicial sem escolhas explícitas
    expect(computeSportPreferences(undefined, []).hasPreferences).toBe(false);
    expect(computeSportPreferences("futebol", []).hasPreferences).toBe(false);

    // Quando o usuário define outra modalidade principal ou adiciona esportes
    expect(computeSportPreferences("corrida", []).hasPreferences).toBe(true);
    expect(computeSportPreferences("futebol", ["futsal"]).hasPreferences).toBe(true);
  });
});

describe("normalizeSettings", () => {
  it("applies fallbacks for primary_sport ('futebol') and accent ('indigo')", () => {
    const normalized = normalizeSettings({
      id: "set-1",
      user_id: "usr-1",
    });

    expect(normalized.primary_sport).toBe("futebol");
    expect(normalized.accent).toBe("indigo");
    expect(normalized.sports).toEqual([]);
    expect(normalized.favorite_competitions).toEqual([]);
    expect(normalized.favorite_states).toEqual([]);
  });

  it("preserves valid primary_sport and accent values", () => {
    const normalized = normalizeSettings({
      id: "set-2",
      primary_sport: "volei",
      accent: "emerald",
      sports: ["volei", "beach-tennis"],
    });

    expect(normalized.primary_sport).toBe("volei");
    expect(normalized.accent).toBe("emerald");
    expect(normalized.sports).toEqual(["volei", "beach-tennis"]);
  });

  it("handles whitespace in primary_sport and accent", () => {
    const normalized = normalizeSettings({
      primary_sport: "  basquete  ",
      accent: "  amber  ",
    });

    expect(normalized.primary_sport).toBe("basquete");
    expect(normalized.accent).toBe("amber");
  });

  it("falls back to 'futebol' when primary_sport is not in SPORT_OPTIONS", () => {
    const normalized = normalizeSettings({
      primary_sport: "unregistered-sport",
    });
    expect(normalized.primary_sport).toBe("futebol");
  });

  it("falls back to 'indigo' when accent is not a valid accent", () => {
    const normalized = normalizeSettings({
      accent: "hotpink",
    });
    expect(normalized.accent).toBe("indigo");
  });
});
