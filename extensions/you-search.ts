import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadApiKey(): string | undefined {
  if (process.env.YOU_API_KEY) return process.env.YOU_API_KEY;
  try {
    const env = readFileSync(join(homedir(), ".pi/agent/.env"), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*YOU_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env file
  }
  return undefined;
}

export default function (pi: ExtensionAPI) {
  const apiKey = loadApiKey();

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web. Returns result titles, URLs, and snippets from both web and news sources. Use for current information, documentation, or anything not in the local environment.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      freshness: Type.Optional(
        Type.Union(
          [Type.Literal("day"), Type.Literal("week"), Type.Literal("month"), Type.Literal("year")],
          {
            description:
              "Restrict results to this timeframe. Omit for all-time. Use 'day' or 'week' for news/catalysts, 'month' for recent context.",
          },
        ),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "Error: YOU_API_KEY not found. Set it in ~/.pi/agent/.env or as an environment variable.",
            },
          ],
          isError: true,
          details: {},
        };
      }

      const searchParams = new URLSearchParams({ query: params.query, count: "8" });
      if (params.freshness) searchParams.set("freshness", params.freshness);

      const res = await fetch(`https://api.you.com/v1/search?${searchParams}`, {
        headers: { "X-API-Key": apiKey },
        signal: signal ?? AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return {
          content: [
            { type: "text", text: `Web search failed: ${res.status} ${await res.text()}` },
          ],
          isError: true,
          details: {},
        };
      }

      const data = (await res.json()) as {
        results?: {
          web?: { title?: string; url?: string; description?: string; snippets?: string[] }[];
          news?: { title?: string; url?: string; description?: string; page_age?: string }[];
        };
      };

      const web = (data.results?.web ?? []).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.snippets?.[0] ?? r.description ?? "",
      }));

      const news = (data.results?.news ?? []).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.description ?? "",
        date: r.page_age ?? "",
      }));

      if (web.length === 0 && news.length === 0) {
        return { content: [{ type: "text", text: "No results found." }], details: {} };
      }

      const fmt = (r: { title: string; url: string; snippet: string }, i: number) =>
        `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`;

      let text = web.map(fmt).join("\n\n");
      if (news.length) {
        text += `\n\nNews:\n${news
          .map((r, i) => `${i + 1}. ${r.title} (${r.date})\n${r.url}\n${r.snippet}`)
          .join("\n\n")}`;
      }

      return { content: [{ type: "text", text }], details: {} };
    },
  });
}
