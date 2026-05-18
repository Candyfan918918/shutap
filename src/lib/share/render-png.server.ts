// Server-only: lazy-initialize @resvg/resvg-wasm and render SVG → PNG.
// The wasm binary is fetched from a CDN on cold start and cached in memory.
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

let initPromise: Promise<void> | null = null;

async function ensureWasm(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const res = await fetch(WASM_URL);
      if (!res.ok) throw new Error(`Failed to fetch resvg wasm: ${res.status}`);
      const buf = await res.arrayBuffer();
      await initWasm(buf);
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function renderSvgToPng(svg: string, width: number): Promise<Uint8Array> {
  await ensureWasm();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}
