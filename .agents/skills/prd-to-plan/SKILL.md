---
name: prd-to-plan
description: Turn one child issue derived from a PRD into a local implementation plan using tracer-bullet vertical slices, saved in ./plans/. Use when user wants a plan for a single issue before Ralph execution.
---

# PRD to Plan

Turn one child issue derived from a PRD into a local implementation plan using
vertical slices (tracer bullets). The output is a markdown file in `./plans/`.

## Process

### 1. Confirm the Issue Is In Context

Ask the user for the child GitHub issue number or URL.

If the issue is not already in the conversation, fetch it using the GitHub
connector when available or `gh issue view <number>` as fallback.

If there is relevant parent PRD context, load it too.

### 2. Explore the Codebase

Understand the current architecture, existing patterns, and real integration
layers before planning implementation.

### 3. Identify Durable Architectural Decisions

Before slicing, identify high-level decisions that are unlikely to change while
implementing this issue:

- route structures or navigation entry points
- schema shape
- key data models
- service boundaries
- testing seams

These go in the plan header so each phase can reference them.

### 4. Draft Tracer-Bullet Phases

Break the issue into vertical implementation phases. Even for a single issue,
do not default to horizontal layer-by-layer plans.

<vertical-slice-rules>
- Each phase delivers a narrow but complete path through the affected system
- A completed phase is demoable or verifiable on its own
- Prefer many thin phases over few thick ones
- Do not include brittle file-by-file implementation details
- Do include durable decisions: route paths, schema shapes, model names, public boundaries
</vertical-slice-rules>

### 5. Quiz the User

Present the proposed breakdown as a numbered list. For each phase show:

- **Title**
- **What user-visible or system-visible behavior it unlocks**

Ask:

- Does the granularity feel right?
- Should any phases be merged or split further?

Iterate until the user approves the breakdown.

### 6. Write the Plan File

Create `./plans/` if it doesn't exist. Write the plan as a markdown file named
after the issue, for example:

- `./plans/123-auto-create-discovered-accounts.md`

Use this template:

```markdown
# Plan: <Issue Title>

> Source issue: #<number>

## Architectural decisions

- **Routes**: ...
- **Schema**: ...
- **Key models**: ...

---

## Phase 1: <Title>

### What to build

A concise description of this vertical slice.

### Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

---
```

Repeat for each phase.

## Next Step

After the plan file is written, suggest:
"Plan is ready. Run `/ralph` to convert it into `prd.json` for execution."
