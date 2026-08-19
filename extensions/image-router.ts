import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VISION_MODEL = "openai/gpt-4o-mini"; // any vision-capable model

// Load OPENROUTER_API_KEY from backend/.env if not in environment
function getApiKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const envPath = join(process.cwd(), "backend/.env");
    const env = readFileSync(envPath, "utf-8");
    const match = env.match(/^OPENROUTER_API_KEY=(.+)$/m);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
const API_KEY = getApiKey();

async function describeImage(data: string, mimeType: string, signal?: AbortSignal): Promise<string> {
  const content = [
    { type: "text", text: "Describe this image concisely." },
    { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } },
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{ role: "user", content }],
    }),
    signal,
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "(no description)";
}

export default function (pi: ExtensionAPI) {
  // Route user-attached images through the vision model
  pi.on("input", async (event, ctx) => {
    if (!event.images?.length) return { action: "continue" };

    const descriptions: string[] = [];
    for (const img of event.images) {
      const desc = await describeImage(img.data, img.mimeType, ctx.signal);
      descriptions.push(desc);
    }

    return {
      action: "transform",
      text: `${event.text}\n\n[Image description: ${descriptions.join("; ")}]`,
      images: [],
    };
  });

  // Route images read by the `read` tool through the vision model
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "read") return;

    const imageContent = event.content?.find((c: any) => c.type === "image");
    if (!imageContent) return;

    const description = await describeImage(imageContent.data, imageContent.mimeType, ctx.signal);

    return {
      content: [{ type: "text", text: `[Image description: ${description}]` }],
    };
  });
}
