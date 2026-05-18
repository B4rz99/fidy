---
name: review
description: Review the current diff before a PR or handoff. Use when the user asks for a review, diff review, pre-PR review, security review, quality review, or wants changes checked before commit.
---

Use this workflow to review the current diff before a PR, commit, or handoff. Keep the output focused on actionable findings and fixes.

## Step 1 — Establish Scope

Inspect the current branch and diff. Identify which files are part of the intended change and ignore unrelated dirty work unless it affects the review.

## Step 2 — Review The Diff

Review the current diff. When the user explicitly asks for subagents, deploy multiple subagents in parallel, each focused on one review lens:

- perform a high-quality security review, including secrets, unsafe data handling, auth boundaries, privacy leaks, and injection risks
- perform a quality code review, including correctness, regressions, edge cases, error handling, naming, and missing tests
- simplify code by consolidating related logic where reuse would reduce duplication or clarify ownership
- check functional programming patterns, especially avoiding unnecessary mutation in pure modules
- check atomicity patterns, especially transaction boundaries, partial writes, stale completions, and cleanup on failure
- check purism patterns, especially side effects leaking into `lib/`, schemas, utilities, or other pure surfaces
- identify where Sentry logs or breadcrumbs are necessary for production diagnosability without adding noisy or sensitive logging

If subagents are not available or not requested, cover the same lenses locally.

## Step 3 — Synthesize And Act

Synthesize findings before editing. Fix important issues when the user asked you to prepare the change for PR or handoff.

Do not defer findings that would make the PR unsafe, misleading, or difficult to review.

## Step 4 — Report

Lead with findings, ordered by severity, with file and line references where possible. If no issues are found, say so clearly and mention any remaining test gaps or residual risk.
