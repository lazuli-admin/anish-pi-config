import type {
  ExtensionAPI,
  SessionBeforeSwitchEvent,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // ── Bash command gate ───────────────────────────────────────────
  const dangerousBashPatterns = [
    /\brm\s+(-[rf]f?|--recursive)/i,
    /\bsudo\b/i,
    /\b(dd|mkfs|fdisk)\b/i,
    /\b(chmod|chown)\b.*777/i,
    />\s*\/dev\/(sda|nvme|disk)/i,
    /\bcurl\b.*\|\s*(sh|bash|python)/i,
  ];

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;
    const isDangerous = dangerousBashPatterns.some((p) => p.test(command));

    if (isDangerous) {
      if (!ctx.hasUI) {
        return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
      }
      const allow = await ctx.ui.select(
        `⚠️ Potentially destructive command:\n\n  ${command}\n\nAllow execution?`,
        ["Yes", "No"],
      );
      if (allow !== "Yes") {
        ctx.ui.notify("Command blocked", "warning");
        return { block: true, reason: "Blocked by user" };
      }
    }

    return undefined;
  });

  // ── File write gate ─────────────────────────────────────────────
  const protectedPatterns = [".env", ".git/", "node_modules/", "package-lock.json", ".ssh/", "secrets"];

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return undefined;

    const path = event.input.path as string;
    const isProtected = protectedPatterns.some((p) => path.includes(p));

    if (isProtected) {
      if (!ctx.hasUI) {
        return { block: true, reason: `Protected path "${path}" blocked` };
      }
      const allow = await ctx.ui.select(
        `⚠️ Writing to protected path:\n\n  ${path}\n\nAllow?`,
        ["Yes", "No"],
      );
      if (allow !== "Yes") {
        ctx.ui.notify("Write blocked", "warning");
        return { block: true, reason: "Blocked by user" };
      }
    }

    return undefined;
  });

  // ── Session clear gate ──────────────────────────────────────────
  pi.on("session_before_switch", async (event: SessionBeforeSwitchEvent, ctx) => {
    if (event.reason === "new") {
      if (!ctx.hasUI) return { cancel: true };
      const entries = ctx.sessionManager.getEntries();
      const hasWork = entries.some(
        (e): e is SessionMessageEntry => e.type === "message" && e.message.role === "user",
      );
      if (hasWork) {
        const allow = await ctx.ui.confirm(
          "Clear session?",
          "This will delete all messages in the current session.",
        );
        if (!allow) return { cancel: true };
      }
    }
  });
}
