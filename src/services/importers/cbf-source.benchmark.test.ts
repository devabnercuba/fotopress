import { describe, it, expect, vi } from "vitest";
import { fetchCbfMatches, isCbfUrl } from "./cbf-source";

describe("CBF Source Benchmark & Diagnostic", () => {
  it("validates isCbfUrl", () => {
    expect(isCbfUrl("https://credencial.cbf.com.br/competicoes/listar/42/2/")).toBe(true);
    expect(
      isCbfUrl(
        "https://www.cbf.com.br/futebol-brasileiro/competicoes/campeonato-brasileiro-serie-b",
      ),
    ).toBe(true);
    expect(isCbfUrl("https://globoesporte.globo.com")).toBe(false);
  });

  it("measures parsing and extraction on 33 Serie B matches", async () => {
    const fakeCard = (home: string, away: string, i: number) => `
      <div class="row">
        <img src="https://credencial.cbf.com.br/img/crests/${home.toLowerCase()}.png" class="escudo" alt="${home}">
        <img src="https://credencial.cbf.com.br/img/crests/${away.toLowerCase()}.png" class="escudo" alt="${away}">
      </div>
      <div class="ConfrontoLiberadoGR">${home} x ${away}</div>
      <div class="LocalEventoLiberado">Estádio ${i} - Cidade ${i}, SP</div>
      <div class="DataHoraEventoLiberado">20/09/2026 às 19:00</div>
    `;

    const cardsCount = 33;
    let fullHtml = `<html><body><div id="content">`;
    for (let i = 1; i <= cardsCount; i++) {
      fullHtml += fakeCard(`TimeCasa${i}`, `TimeFora${i}`, i);
    }
    fullHtml += `</div></body></html>`;

    // Mock global fetch to return fullHtml immediately
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => fullHtml,
    } as Response);

    const t0 = performance.now();
    const result = await fetchCbfMatches(
      "https://credencial.cbf.com.br/competicoes/listar/42/2/",
      "Brasileiro Série B",
    );
    const t1 = performance.now();

    globalThis.fetch = originalFetch;

    expect(result.ok).toBe(true);
    expect(result.matches.length).toBe(33);
    expect(result.matches[0].homeTeam).toBe("TimeCasa1");
    expect(result.matches[0].awayTeam).toBe("TimeFora1");
    expect(result.matches[0].state).toBe("SP");
    expect(result.matches[0].date).toBe("2026-09-20");
    expect(result.matches[0].time).toBe("19:00");
    expect(result.matches[0].homeLogo).toContain("timecasa1.png");

    console.log(`[Diagnostic] Extraction of 33 CBF matches took ${(t1 - t0).toFixed(2)}ms`);
  });
});
