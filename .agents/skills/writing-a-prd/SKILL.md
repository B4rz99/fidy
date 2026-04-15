---
name: writing-a-prd
description: Create a PRD through user interview, codebase exploration, and module design, then save it locally and create a parent GitHub issue for it. Use when user wants to write a PRD, create a product requirements document, or plan a new feature.
---

# Writing a PRD

Create a PRD through user interview, codebase exploration, and module design.
Save it locally and then create a parent GitHub issue that represents the PRD.

You may skip steps only when they are genuinely unnecessary.

## Process

### 1. Gather the Problem

Ask the user for a long, detailed description of the problem they want to solve
and any ideas they already have for solutions.

### 2. Explore the Repo

Explore the codebase to verify assertions and understand the current state of
the system.

### 3. Interview Relentlessly

Interview the user about every aspect of the plan until you reach a shared
understanding. Walk down each branch of the design tree, resolving dependencies
one by one.

Ask questions one at a time.

### 4. Sketch the Major Modules

Sketch the major modules you will need to build or modify. Actively look for
opportunities to extract deep modules that can be tested in isolation.

A deep module is one that encapsulates a lot of functionality behind a small,
stable, testable interface.

Check with the user that these modules match expectations. Check which modules
they want tests written for.

### 5. Write the Local PRD Copy

Once the problem and solution are clear, write the PRD as a local markdown file.
This local file is a copy of the PRD content that will also be used for the
parent GitHub issue.

Default location:

- `tasks/prd-<feature-name>.md`

If `tasks/` does not exist, create it.

The local PRD should include:

- problem statement
- solution summary
- extensive user stories
- intended users
- security and permission considerations
- proposal / implementation decisions
- test plan
- success criteria
- out-of-scope items
- links and references

### 6. Create the Parent GitHub Issue

After the local PRD is written, create a parent GitHub issue using `gh issue create`.

Recommended title:

- `PRD: <Feature Name>`

The issue body should contain the full PRD, not a summary. The parent GitHub
issue is the canonical PRD record, and the local markdown file is a copy.

### 7. Share the Results

Return both:

- the local PRD path
- the parent GitHub issue URL or number

## Next Step

After the PRD issue is created, suggest:
"PRD is up. Ready to split it into grabbable issues? Run `/prd-to-issues`."
