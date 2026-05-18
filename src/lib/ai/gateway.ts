// Server-only helper for calling Lovable AI Gateway.
// Do NOT import this from client code.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

export type GatewayJsonOptions = {
  model?: string;
  messages: GatewayMessage[];
  temperature?: number;
};

export async function callGatewayJSON<T>(opts: GatewayJsonOptions): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-flash-preview",
      messages: opts.messages,
      temperature: opts.temperature ?? 0.9,
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in Settings → Workspace.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI gateway returned no content");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI gateway returned non-JSON content");
  }
}
