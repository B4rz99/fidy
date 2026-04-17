---
name: to-prd
description: Turn the current conversation context into a PRD and submit it as a GitHub issue. Use when user wants to create a PRD from the current context.
---

This skill takes the current conversation context and codebase understanding and produces a PRD. Default to synthesizing what you already know. Only ask follow-up questions if a key ambiguity blocks a credible module sketch, testing plan, or GitHub issue.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already.

2. Sketch out the major modules you will need to build or modify to complete the implementation. Actively look for opportunities to extract deep modules that can be tested in isolation.

A deep module (as opposed to a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface which rarely changes.

If the module sketch and testing plan are clear from existing context, proceed without asking follow-up questions. If a key ambiguity remains, ask only the shortest question needed to resolve it before writing the PRD.

3. Write the PRD using the template below and submit it as a GitHub issue.

<prd-template>

# `<short feature title>`

## Problem

Why are we doing this? What user problem or business need does it solve?

## Proposal

High-level summary of the change.

## Intended users

Who is this for?

## User stories

- As a `<type of user>`, I want to `<do something>`, so that `<benefit>`.
- As a `<type of user>`, I want to `<do something else>`, so that `<benefit>`.

## Module sketch

- `<module or subsystem>` - what needs to change and why
- `<module or subsystem>` - what needs to change and why

## Security and permissions

Any auth, access-control, data-sensitivity, or abuse-prevention concerns.

## Testing

- what needs direct unit tests
- what needs integration or end-to-end coverage

## Success criteria

- [ ] concrete measurable outcome 1
- [ ] concrete measurable outcome 2

## Out of scope

- adjacent work not included in this PRD
- follow-up ideas that should stay separate

</prd-template>
