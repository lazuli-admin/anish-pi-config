---
name: personal-emails
description: Triage unread Gmail through the Clavis MCP tools — fetch all unread messages, organize them by importance and label, present a numbered triage list, then apply labels, draft replies, or mark read only on the user's explicit instruction.
---

# Personal Emails — inbox triage

## Step 1 — Fetch unread mail

Call `gmail_list_threads` with `q: "is:unread"`, `maxResults: 50`. For every thread returned,
call `gmail_get_thread` to read its messages (from, subject, snippet, unread flag).

## Step 2 — Organize before acting

Group the unread messages into these buckets, most important first:

1. **Needs reply / personal** — real humans writing to the user directly
2. **Action needed** — bills, appointments, deadlines, security notices, verification codes
3. **Informational** — receipts, confirmations, shipping notices worth keeping
4. **Noise** — marketing, newsletters, automated notifications (candidates for the user's
   existing `Useless` label or a new filter)
5. **Already labeled** — mail matching existing labels (check with `gmail_list_labels`)

Use sender, subject, and snippet to judge. When unsure, bucket it one level *more* important
than it looks — false urgency is recoverable, missed bills are not.

## Step 3 — Present, then STOP

Present a numbered list: bucket, sender, subject, snippet (one line each). Then stop and
wait. Do NOT label, draft, mark read, or create anything until the user says so.

## Step 4 — Execute only what was asked

Map the user's instructions to tools:

- "add 1 and 3 to Bills" → `gmail_label_messages` (get the label ID from `gmail_list_labels`
  first — labels are referenced by ID, not name)
- "draft a reply to 2" → `gmail_create_draft` with that thread's `threadId`, subject as
  "Re: <original>", body matching the user's intent
- "mark bucket 4 read" → `gmail_bulk_mark_read` with a narrow `q` matching that bucket's
  senders — never a bare `is:unread`
- "never see mail from X again" → `gmail_create_filter`

If the user asks for a label that doesn't exist, say so and ask whether to create one —
do not invent label IDs.

## Rules

- Never send email — drafts only, always.
- One tool call per instructed action; report results ("labeled 2 messages", "draft saved").
- If no unread mail: say so plainly and stop.
