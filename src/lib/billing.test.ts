import { describe, expect, it } from "vitest";

import { buildKiwifyCheckoutUrl } from "./billing";

const BASE = "https://pay.kiwify.com.br/8pYbV63";

describe("buildKiwifyCheckoutUrl", () => {
  it("adiciona o e-mail autenticado como parâmetro legível pela Kiwify", () => {
    const url = buildKiwifyCheckoutUrl(BASE, "cliente@gmail.com");
    expect(url).toBeTruthy();
    expect(new URL(url!).searchParams.get("email")).toBe("cliente@gmail.com");
  });

  it("mantém o checkout base quando não há usuário autenticado", () => {
    const url = buildKiwifyCheckoutUrl(BASE, null);
    expect(new URL(url!).searchParams.get("email")).toBeNull();
  });

  it("preserva parâmetros já existentes", () => {
    const url = buildKiwifyCheckoutUrl(`${BASE}?utm_source=app`, "a+b@x.com");
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("utm_source")).toBe("app");
    expect(parsed.searchParams.get("email")).toBe("a+b@x.com");
  });

  it("retorna null sem checkout configurado", () => {
    expect(buildKiwifyCheckoutUrl(null, "cliente@gmail.com")).toBeNull();
  });
});
