---
name: prd-to-issues
description: Break a PRD into independently grabbable GitHub issues using tracer-bullet vertical slices. Use when user wants to convert a PRD to issues, create implementation tickets, or break down a PRD into work items.
---

# PRD to Issues

Break a PRD into independently grabbable GitHub issues using vertical slices
(tracer bullets).

## Process

### 1. Locate the PRD

Ask the user for the parent PRD GitHub issue number or URL.

If the PRD is not already in your context window:

- fetch the parent issue using the GitHub connector when available, or
- use `gh issue view <number>` as fallback

If the local markdown PRD file is not already in context, ask for its path and
read it as well. Prefer using both the local file and the parent issue when
available.

### 2. Explore the Codebase

If you have not already explored the codebase, do so to understand the current
state of the system.

### 3. Draft Vertical Slices

Break the PRD into tracer-bullet issues. Each issue must be a thin vertical
slice that cuts through all relevant integration layers end-to-end, not a
horizontal slice of one layer.

Slices may be `HITL` or `AFK`.

- `HITL`: requires explicit human interaction or approval
- `AFK`: can be implemented and merged without waiting on the human

Prefer `AFK` where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through every affected layer
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over a few thick ones
</vertical-slice-rules>

### 4. Quiz the User

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**
- **Type**: `HITL` or `AFK`
- **Blocked by**
- **User stories covered**

Ask:

- Does the granularity feel right?
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked `HITL` and `AFK`?

Iterate until the user approves the breakdown.

### 5. Create the GitHub Issues

For each approved slice, create a GitHub issue using `gh issue create`.

Use the parent PRD issue as the source of truth. Each child issue body should
include:

- a short problem statement
- the slice solution
- covered user stories
- acceptance criteria
- dependency notes
- `Part of #<parent-issue-number>`

Create issues in dependency order so blockers exist before dependent issues.

### 6. Link Child Issues Back to the Parent

GitHub does not give you a universal parent-child issue API across all repos, so
link them in a durable, tool-agnostic way:

- every child issue body must reference the parent issue
- add a parent issue comment listing all child issues in dependency order
- if the repo already uses issue task lists or sub-issue features, update the
  parent accordingly as an enhancement, not a blocker

Do not close or otherwise mutate the parent PRD issue beyond adding child links
or a child-issues summary.

## Next Step

After all child issues are created and linked, suggest:
"Issues are ready. Pick one and run `/prd-to-plan` to plan its implementation."
