import { describe, expect, it } from "vitest";

import { duplicateGroups, teamIdentityKey, teamLabel, type Team } from "./teams";

function team(patch: Partial<Team>): Team {
  return {
    id: patch.id ?? crypto.randomUUID(),
    name: patch.name ?? "Avaí",
    short_name: null,
    abbreviation: null,
    slug: patch.slug ?? "avai",
    normalized_name: patch.normalized_name ?? "avai",
    state: null,
    city: null,
    logo_url: null,
    logo_local: null,
    sport_key: patch.sport_key ?? "Futebol",
    category: patch.category ?? null,
    gender: patch.gender ?? null,
  };
}

describe("identidade de clubes", () => {
  it("trata grafias diferentes do mesmo clube como a mesma identidade", () => {
    expect(teamIdentityKey("AVAÍ FC", { sportKey: "Futebol" })).toBe(
      teamIdentityKey("Avai", { sportKey: "futebol" }),
    );
  });

  it("separa o mesmo nome em modalidades, categorias e gêneros diferentes", () => {
    const base = teamIdentityKey("Avaí", { sportKey: "Futebol" });
    expect(teamIdentityKey("Avaí", { sportKey: "Futsal" })).not.toBe(base);
    expect(teamIdentityKey("Avaí", { sportKey: "Futebol", category: "Sub-20" })).not.toBe(base);
    expect(teamIdentityKey("Avaí", { sportKey: "Futebol", gender: "Feminino" })).not.toBe(base);
  });

  it("rotula sem nunca usar sufixo numérico", () => {
    expect(teamLabel(team({ category: "Sub-20" }))).toBe("Avaí · Sub-20");
    expect(teamLabel(team({}))).toBe("Avaí");
  });

  it("só marca como equivalente quando a identidade completa coincide", () => {
    const homonimos = duplicateGroups([team({ id: "1" }), team({ id: "2", category: "Sub-20" })]);
    expect(homonimos[0].equivalent).toBe(false);

    const duplicados = duplicateGroups([team({ id: "1" }), team({ id: "2" })]);
    expect(duplicados[0].equivalent).toBe(true);
  });
});
