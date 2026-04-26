---
name: ubiquitous-language
description: Extract and harden Fidy domain terminology into a durable glossary, flagging ambiguous or conflicting terms. Use when the user wants a ubiquitous language, glossary, canonical terminology, DDD terminology review, or sharper domain language.
---

# Ubiquitous Language

Use this skill to turn fuzzy product or engineering language into canonical Fidy terms.

The upstream skill writes a generic `UBIQUITOUS_LANGUAGE.md` file from the current conversation alone. In this repo, that is too shallow. Terms should be checked against existing code and documentation, then written into the durable home that already owns the language.

If the user wants an interactive grilling session that resolves each term one-by-one, also use `domain-model`. This skill is the extraction and codification pass once enough context exists.

## Gather Context

Before proposing terms, inspect the relevant sources that already exist:

- the current conversation
- the relevant code and tests
- `CONTEXT.md` or `CONTEXT-MAP.md` when present
- `docs/adr/` when decisions affect terminology
- Mempalace `/search` results when durable memory may already contain the concept

Use Mempalace for durable terminology memory outside the repo.

## What To Look For

- one term used for multiple concepts
- multiple terms used for the same concept
- vague or overloaded language
- code or schema names leaking into the domain language
- contradictions between code, docs, and the current discussion

## Preferred Output Location

Do not default to a new root-level markdown file.

Write the glossary into the most appropriate durable home:

1. update the relevant `CONTEXT.md`, `CONTEXT-MAP.md`, or ADR when the terminology belongs in repo documentation
2. use Mempalace `/mine` when the terminology should live as durable memory outside the repo
3. only create a standalone glossary file when no existing page is a natural fit and the user wants repo-local documentation

If you mine terminology into Mempalace, keep the payload compact and cite the code/docs that established each term.

## Output Shape

Produce a compact glossary with:

- grouped tables with `Term`, `Definition`, and `Aliases to avoid`
- a short `Relationships` section describing how the terms connect
- a `Flagged ambiguities` section for conflicts or overloaded words
- a short example dialogue that uses the canonical terms naturally

Group terms by subdomain, actor, or lifecycle when that clarifies the language.

## Rules

- Be opinionated. Pick one canonical term when several exist.
- Keep definitions to one sentence and define what the thing is.
- Include only domain-relevant concepts.
- Skip generic implementation jargon unless it matters to users or domain experts.
- Call out mismatches between code, docs, and conversation explicitly.
- When a new canonical term replaces an old one, note what docs or code names should eventually align.

## Finish

- Summarize the chosen canonical terms inline for the user.
- If you updated durable documentation, mention the file you changed.
- If you mined terminology into Mempalace, mention that memory was updated.
