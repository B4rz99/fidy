---
name: obsidian-vault
description: Search, create, and maintain durable notes in Fidy's external vault. Use when work belongs in the shared knowledge base, when the user asks to search or update the vault, or when research, source digests, architecture notes, workflows, or domain knowledge should live outside the repo.
---

# Obsidian Vault

Use this skill for Fidy's shared vault, not a generic local Obsidian setup.

The upstream skill assumes a flat vault, Title Case note names, and `[[wikilinks]]`. None of that applies here. Fidy's vault has a typed directory structure, a repo-local bridge, and a required `index.md` / `log.md` maintenance flow.

## Start Here

1. Run `bun run vault:doctor` from the repo root. This validates the external vault and repairs `.context/fidy-vault` if needed.
2. Read `.context/fidy-vault/AGENTS.md`.

If `vault:doctor` fails, stop and report the missing bridge or files before touching the vault.

## Paths And Commands

- Stable workspace path: `.context/fidy-vault`
- Print the machine-local vault path: `bun run vault:path`
- Search the vault: `./scripts/fidy-vault search <pattern>`
- Show recent vault activity: `bun run vault:recent`
- Open the vault in Finder: `bun run vault:open`

Use `rg` on `.context/fidy-vault` when you need tighter searches, but prefer the bridge path over hard-coded machine paths.

The vault's directory contract, non-negotiables, page template, and ingest/query/lint workflows already live in `.context/fidy-vault/AGENTS.md`. Follow that file instead of duplicating it here.
