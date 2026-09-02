import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCbfRosterContent, loadRoster } from "./cbf-roster-fetch.server";
import { extractCbfRosterTableText, parseCbfHtml, parseCbfRosterText } from "./providers";

const CBF_URL =
  "https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-c/2026/63843";

const VALID_HTML = `<!doctype html><html><body>
  <h1>Brusque - SC</h1>
  <a href="?tab=atletas">Atletas</a>
  <table><thead><tr><th>Nome</th><th>Apelido</th><th>Clube Atual</th></tr></thead>
  <tbody><tr><td><a href="/futebol-brasileiro/atletas/perfil/690741">João da Silva</a></td><td>João</td><td>Brusque</td></tr></tbody></table>
</body></html>`;

const htmlResponse = (body: string, init?: ResponseInit) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("CBF athlete roster acquisition", () => {
  it("uses direct CBF once, does not call Reader, and preserves the existing HTML parser", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(htmlResponse(VALID_HTML));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadRoster(CBF_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstInit = fetchMock.mock.calls[0]?.[1];
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(CBF_URL);
    expect(new Headers(firstInit?.headers).get("accept-language")).toBe("pt-BR,pt;q=0.9,en;q=0.8");
    expect(firstInit?.redirect).toBe("manual");
    expect(result).toMatchObject({
      ok: true,
      acquisitionMode: "direct",
      teamName: "Brusque",
      teamState: "SC",
    });
    expect(result.athletes[0]).toMatchObject({
      externalId: "690741",
      fullName: "João da Silva",
      nickname: "João",
      currentTeamName: "Brusque",
    });
  });

  it("uses authenticated Reader once after a direct 403 and parses the CBF table text", async () => {
    vi.stubEnv("JINA_API_KEY", "jina_test_key");
    const readerBody = `# Brusque - SC

Nome | Apelido | Clube Atual
--- | --- | ---
Bernardo Marcos Lemes | Bernardo Lemes | Brusque
Frank Matias Salas Loboa | Mati Loboa | Salcedo Fútbol Club`;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(htmlResponse("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(readerBody, { status: 200, headers: { "content-type": "text/plain" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadRoster(CBF_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(`https://r.jina.ai/${CBF_URL}`);
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("authorization")).toBe(
      "Bearer jina_test_key",
    );
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("x-no-cache")).toBe("true");
    expect(result).toMatchObject({
      ok: true,
      acquisitionMode: "reader",
      teamName: "Brusque",
      teamState: "SC",
    });
    expect(result.athletes).toHaveLength(2);
    expect(result.athletes[0]).toMatchObject({
      externalId: null,
      name: "Bernardo Marcos Lemes",
      nickname: "Bernardo Lemes",
      fullName: "Bernardo Marcos Lemes",
      currentTeamName: "Brusque",
    });
    expect(result.athletes[1]).toMatchObject({
      externalId: null,
      name: "Frank Matias Salas Loboa",
      nickname: "Mati Loboa",
      currentTeamName: "Salcedo Fútbol Club",
    });
  });

  it("does not call Reader without JINA_API_KEY and reports the manual fallback state", async () => {
    vi.stubEnv("JINA_API_KEY", "");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(htmlResponse("Forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadRoster(CBF_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, errorCode: "CBF_ACCESS_BLOCKED" });
  });

  it("keeps the dialog stable when Reader returns an error", async () => {
    vi.stubEnv("JINA_API_KEY", "jina_test_key");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(htmlResponse("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadRoster(CBF_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false, errorCode: "CBF_ACCESS_BLOCKED" });
  });

  it("rejects URLs that are not public CBF team pages", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadRoster("https://avai.com.br/futebol/profissional/");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, errorCode: "INVALID_CBF_URL" });
  });

  it("falls back to Reader instead of retrying direct access when CBF returns a challenge", async () => {
    vi.stubEnv("JINA_API_KEY", "jina_test_key");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(htmlResponse("<html>CAPTCHA</html>"))
      .mockResolvedValueOnce(new Response("sem tabela", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadRoster(CBF_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("CBF_ACCESS_BLOCKED");
    expect(result.message).toBe("Não conseguimos ler automaticamente a CBF neste momento.");
  });

  it("exposes acquisition diagnostics without leaking secrets", async () => {
    vi.stubEnv("JINA_API_KEY", "jina_test_key");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(htmlResponse("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(new Response("sem tabela", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCbfRosterContent(CBF_URL);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toMatchObject({
      direct_status: 403,
      direct_error: "status_403",
      reader_used: true,
      reader_status: 500,
      reader_error: "status_500",
      acquisition_mode: null,
      url: CBF_URL,
    });
  });
});

describe("CBF Reader table extraction", () => {
  it("extracts only the roster table and identifies team heading", () => {
    const extracted = extractCbfRosterTableText(`# Brusque - SC

Texto antes

Nome | Apelido | Clube Atual
--- | --- | ---
Bernardo Marcos Lemes | Bernardo Lemes | Brusque
Frank Matias Salas Loboa | Mati Loboa | Salcedo Fútbol Club

## Histórico`);

    expect(extracted).toEqual({
      teamName: "Brusque",
      teamState: "SC",
      tableText:
        "Nome | Apelido | Clube Atual\n--- | --- | ---\nBernardo Marcos Lemes | Bernardo Lemes | Brusque\nFrank Matias Salas Loboa | Mati Loboa | Salcedo Fútbol Club",
    });
  });
});

describe("CBF roster pasted by the user", () => {
  it("reads a tab separated table and ignores the header row", () => {
    const result = parseCbfRosterText(
      "Nome\tApelido\tClube Atual\nJoão da Silva\tJoão\tBrusque\nCarlos Souza\tCarlinhos\tAvaí",
      { url: CBF_URL, teamName: "Brusque" },
    );

    expect(result.ok).toBe(true);
    expect(result.athletes).toHaveLength(2);
    expect(result.athletes[0]).toMatchObject({
      provider: "cbf",
      name: "João da Silva",
      nickname: "João",
      fullName: "João da Silva",
      teamName: "Brusque",
      currentTeamName: "Brusque",
      externalId: null,
    });
    expect(result.athletes[1]?.currentTeamName).toBe("Avaí");
  });

  it("reads a list pasted as successive lines", () => {
    const result = parseCbfRosterText(
      "João da Silva\nJoão\nBrusque\nCarlos Souza\nCarlinhos\nBrusque",
      {
        url: CBF_URL,
        teamName: "Brusque",
      },
    );

    expect(result.athletes).toHaveLength(2);
  });

  it("reports a parse failure when the pasted content is not a roster", () => {
    const result = parseCbfRosterText("nada aqui", { url: CBF_URL, teamName: "Brusque" });

    expect(result).toMatchObject({ ok: false, errorCode: "CBF_PARSE_FAILED" });
  });
});

describe("identidade CBF: nome completo vs apelido", () => {
  const rosterHtml = (rows: string) => `
    <h1>Brusque - SC</h1><div>Atletas</div>
    <table><thead><tr><th>Nome</th><th>Apelido</th><th>Clube Atual</th></tr></thead>
    <tbody>${rows}</tbody></table>`;

  it("usa o nome completo como name e o apelido como nickname", () => {
    const result = parseCbfHtml(
      rosterHtml(
        `<tr><td>Renan dos Santos Silva</td><td>Renan</td><td>Brusque</td></tr>
         <tr><td>Renan Oliveira Souza</td><td>Renan</td><td>Brusque</td></tr>`,
      ),
      "https://www.cbf.com.br/futebol-brasileiro/times/brusque",
    );
    expect(result.athletes).toHaveLength(2);
    expect(result.athletes[0].name).toBe("Renan dos Santos Silva");
    expect(result.athletes[0].nickname).toBe("Renan");
    expect(result.athletes[1].name).toBe("Renan Oliveira Souza");
    expect(result.athletes[1].nickname).toBe("Renan");
  });

  it("mantém nome completo na colagem manual", () => {
    const result = parseCbfRosterText(
      "Nome\tApelido\tClube Atual\nRenan dos Santos Silva\tRenan\tBrusque",
      { url: "https://www.cbf.com.br/futebol-brasileiro/times/brusque", teamName: "Brusque" },
    );
    expect(result.athletes[0].name).toBe("Renan dos Santos Silva");
    expect(result.athletes[0].nickname).toBe("Renan");
  });
});
