/**
 * Leitura HTTP/2 da FPF (somente Node).
 *
 * O site da FPF fica atrás de proteção anti-bot que recusa requisições em
 * HTTP/1.1 com 403. O runtime de produção fala HTTP/2 nativamente; o servidor
 * de desenvolvimento em Node, não. Este utilitário cobre esse caso usando o
 * módulo `node:http2` — é carregado sob demanda e nunca vai para o navegador.
 */
export async function fpfHttp2Get(
  origin: string,
  path: string,
  headers: Record<string, string>,
): Promise<string> {
  const http2 = await import("node:http2");
  const { constants } = http2;

  return await new Promise<string>((resolve, reject) => {
    const client = http2.connect(origin);
    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error("A FPF demorou demais para responder."));
    }, 30000);

    const finish = (error: Error | null, body?: string) => {
      clearTimeout(timer);
      client.close();
      if (error) reject(error);
      else resolve(body ?? "");
    };

    client.on("error", (error) => finish(error as Error));

    const request = client.request({
      [constants.HTTP2_HEADER_METHOD]: "GET",
      [constants.HTTP2_HEADER_PATH]: path,
      ...headers,
    });

    let status = 0;
    request.on("response", (responseHeaders) => {
      status = Number(responseHeaders[constants.HTTP2_HEADER_STATUS] ?? 0);
    });

    const chunks: Buffer[] = [];
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => chunks.push(Buffer.from(chunk)));
    request.on("error", (error) => finish(error as Error));
    request.on("end", () => {
      if (status >= 400) finish(new Error(`A FPF respondeu com status ${status}.`));
      else finish(null, Buffer.concat(chunks).toString("utf8"));
    });
    request.end();
  });
}
