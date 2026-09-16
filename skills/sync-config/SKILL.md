---
name: sync-config
description: Apply Anish's published pi config from git (lazuli-admin/anish-pi-config) to the live ~/.pi/agent directory, or publish local changes back to the repo. Trigger with /sync-config, "apply my config", "update my config", or "publish my config".
---

# Sync Pi Config

The source of truth for Anish's pi config is the git repo **`lazuli-admin/anish-pi-config`**. The live config is `~/.pi/agent/`. The repo is a structural mirror of `~/.pi/agent/` (same layout: `settings.json`, `mcp.json`, `mcp-cache.json`, `mcp-onboarding.json`, `AGENTS.md`, `extensions/`, `skills/`, `pi-inline/`, plus empty `git/` and `npm/` placeholder dirs).

## Cloning / refreshing the mirror

The repo clone lives at `~/.pi/agent/git/github.com/lazuli-admin/anish-pi-config` (pi's package-clone location). Refresh it before any sync:

```bash
cd ~/.pi/agent/git/github.com/lazuli-admin/anish-pi-config && git pull
```

If it doesn't exist yet, clone it there:

```bash
git clone https://github.com/lazuli-admin/anish-pi-config ~/.pi/agent/git/github.com/lazuli-admin/anish-pi-config
```

## Apply (repo → live)

"Apply my config" = overlay the repo onto `~/.pi/agent/`. **No deletions** — the live dir has extra files the repo doesn't track (`auth.json`, `trust.json`, `sessions/`, `models-store.json`, `bin/`, `bridge/`, local-only skills like `new-work`, build artifacts like `pi-inline/out/` and `*.vsix`).

```bash
rsync -a \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude '.env.example' \
  ~/.pi/agent/git/github.com/lazuli-admin/anish-pi-config/ ~/.pi/agent/
```

`-a` without `--delete` overlays changed files and adds new ones; untouched live-only files survive. `.env` is live-only (contains real API keys: `YOU_API_KEY`, `OPENROUTER_API_KEY`) — never overwrite it, and never commit it; the repo only carries `.env.example`.

After rsync, reconcile `settings.json` — two fields are intentionally not taken verbatim from the repo:

1. `lastChangelogVersion`: keep the **higher** of local and repo values (it's a "changelog already shown" marker; downgrading it re-shows the changelog popup).
2. `defaultThinkingLevel`: repo says `medium` — that's intentional, keep it.

Also note: the repo's `settings.json` does **not** list `anish-pi-config` as a package. That's correct — the config loads directly from `~/.pi/agent/` (extensions/, skills/ are discovered natively). Do NOT run `pi install git:github.com/lazuli-admin/anish-pi-config`; that would load the same extensions twice (once natively, once via the package). If a package entry exists, remove it.

Then diff-verify before declaring done:

```bash
R=~/.pi/agent/git/github.com/lazuli-admin/anish-pi-config
for f in AGENTS.md settings.json mcp.json mcp-cache.json mcp-onboarding.json; do
  diff -q ~/.pi/agent/$f $R/$f || echo "$f DIFFERS"
done
```

Finally: restart pi to pick up changes (extensions, skills, mcp servers don't hot-reload).

## Publish (live → repo)

"Publish my config" = copy live-only and changed files back into the repo, then commit/push (ask Anish before committing or pushing — always).

```bash
R=~/.pi/agent/git/github.com/lazuli-admin/anish-pi-config
rsync -a --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'auth.json' \
  --exclude 'trust.json' \
  --exclude 'models-store.json' \
  --exclude 'sessions/' \
  --exclude 'bin/' \
  --exclude 'bridge/' \
  --exclude 'npm/' \
  --exclude 'git/' \
  --exclude 'pi-inline/out/' \
  --exclude 'pi-inline/node_modules/' \
  --exclude 'pi-inline/*.vsix' \
  ~/.pi/agent/ $R/
```

Review `git status`/`git diff` in the repo before proposing a commit; flag anything surprising (e.g. `mcp-cache.json` churn, secrets-looking strings) instead of blindly committing. `.gitignore` already excludes `.env`.

## Nuances

- **mcp.json drift**: repo pins the `clavis` MCP server (`https://monkfish-app-kq9zw.ondigitalocean.app/mcp`, `directTools: true`, `autoAuth`). If live `mcp.json` has import-based config (`imports: [claude-code, ...]`), that's an older layout — repo version wins on apply.
- **mcp-cache.json** is a server tool cache; safe to overwrite either direction (it self-refreshes), but its churn creates noisy diffs on publish.
- **Disabled extensions** use a `.ts.disabled` suffix locally (e.g. `image-router.ts.disabled`). The repo carries the enabled `.ts`. If Anish wants an extension off, ask whether to publish the rename to the repo rather than leaving it local-only — otherwise the next apply re-enables it.
- **pi-mcp-adapter** (npm) and **ponytail** (git) stay in `settings.json`'s `packages` array; they're real pi packages, not part of the mirror.
- Never touch: `auth.json` (credentials), `.env` (secrets), `sessions/`, `trust.json`.
