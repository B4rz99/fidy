# fidy-vault

## What This Vault Is
A project knowledge vault for Fidy — a personal finance app. Built on Karpathy's LLM Wiki pattern. The AI auto-logs decisions from sessions, processes meeting notes and feedback, and maintains synthesized wiki pages.

This vault is private (gitignored). It supplements the code, not replaces it.

## Vault Structure

- `raw/` — source material
  - `meetings/` — Google Docs links (API fetch or paste)
  - `decisions/sessions/` — auto-logged from AI sessions (one file per session)
  - `feedback/` — Notion page links (API fetch)
  - `experiments/` — what was tried, what happened
  - `competitive/` — notes on other fintech apps
- `wiki/` — AI-maintained synthesis
  - `index.md` — catalog of all pages
  - `log.md` — chronological record
  - `decisions/`, `users/`, `experiments/`, `strategy/` — organized by topic

## How to Maintain This Vault

### Auto-Logging Decisions
After every significant session event, append to `raw/decisions/sessions/<YYYY-MM-DD>-session-<N>.md`:
- Architecture choices (what approach was chosen and why)
- Feature scope decisions (what to ship, what not to ship)
- Technical commitments (libs, patterns, conventions)
- Failures and course corrections

Session log format:
```markdown
# Session: 2026-04-11

## Decisions
- **Auth approach**: Chose JWT over sessions. Rationale: stateless, better for mobile.
- **Database**: Went with Drizzle ORM over Prisma. Rationale: better SQLCipher support.

## Context
User wants to ship weekly digest by end of month.
```

### Process New Sources
1. Meeting notes (Google Docs) → read → synthesize into `wiki/decisions/` or `wiki/strategy/`
2. Feedback (Notion) → read → synthesize into `wiki/users/`
3. Update `index.md` and `log.md`

### Synthesize Cadence
Daily — at the start of each session, review `raw/` for new content since last run. Update wiki pages, resolve contradictions, update `index.md` and `log.md`.

### What Constitutes a "Significant Decision"
Log it if:
- It affects architecture or code structure
- It commits to a library, pattern, or convention
- It changes the roadmap or feature scope
- It abandons an approach (experiment failure)

Don't log:
- Routine refactoring within agreed architecture
- Minor UI tweaks
- Bug fixes

### Anti-Pattern Tracking
If a new decision contradicts an existing experiment or decision:
- Mark the existing page with `#status/contradicted`
- Add a note explaining the contradiction
- Log the contradiction in `log.md`

### Index Format
```markdown
# Index

## Wiki Pages
- [[decisions/auth]] — Auth approach across sessions
- [[strategy/weekly-digest]] — Weekly digest feature decisions

## Raw Sources
- [[raw/decisions/sessions/2026-04-11-session-1]] — Auth approach decided
- [[raw/feedback/2026-04-note-1]] — User reported spending issue

Last updated: 2026-04-11
```

### Log Format
```
## [YYYY-MM-DD] session | decision | "Auth approach chosen"
## [YYYY-MM-DD] ingest | meeting | "2026-04-10 standup"
## [YYYY-MM-DD] synthesize | daily | 2 decisions logged, 1 wiki page updated
```

## API Access
- **Google Docs API** — for meeting notes
- **Notion API** — for user feedback

Store credentials in environment variables or a local `.vault-env` file (gitignored).

## Tags
- `#meta/raw` — source material
- `#meta/synthesized` — AI-generated wiki page
- `#status/draft` — needs review
- `#status/confirmed` — verified
- `#status/contradicted` — contradicts another note
- `#confidence/extracted` — directly from source
- `#confidence/inferred` — AI inference, needs verification

## Frontmatter Template
```yaml
---
tags:
  - meta/synthesized
  - status/draft
  - confidence/extracted
date: 2026-04-11
source_count: 1
---
```
