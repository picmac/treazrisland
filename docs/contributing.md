# Contributing Guide

Welcome to Treazr Island! This document explains how we collaborate and keep our history clean and traceable. Please follow these standards for every change.

## Branch Naming

Create branches from `main` and use kebab-case identifiers that describe the work:

- `feature/<short-description>` for new functionality.
- `fix/<short-description>` for bug fixes.
- `chore/<short-description>` for maintenance tasks (tooling, docs, CI).
- `hotfix/<short-description>` for urgent production fixes.

Use one branch per focused outcome and avoid long-lived branches. Prefer referencing tracking IDs where available, such as `feature/map-navigation-123`.

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org) so that semantic-release can automate versioning and changelog generation.

Each commit message must follow the pattern:

```
<type>(<scope>): <subject>
```

- **type**: One of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, or `test`.
- **scope**: Optional, kebab-case identifier for the affected area (e.g. `frontend`, `backend`, `docs`). Omit the parentheses entirely when scope is not needed.
- **subject**: Lowercase, imperative summary under 72 characters (e.g. `add treasure chest spawn timer`).

Provide extra context in the body when necessary, wrapping lines at 100 characters. Avoid breaking changes unless essential, and include a `BREAKING CHANGE:` footer when you do.

## Pull Requests

Every pull request **must** use the provided template. Populate each section before requesting review:

1. **Summary** – bullet list describing the changes and their rationale.
2. **Testing** – commands executed and outcomes (include ✅/⚠️/❌ indicators).
3. **Decision Log** – call out any non-obvious choices, trade-offs, or follow-up actions.
4. **Additional Notes** – link related issues, designs, or TODOs.

Ensure the branch is up to date with `main`, reference relevant issues, and confirm that CI passes before merging.

## Expectations

- Keep changes focused and reviewable.
- Run available tests or linters before pushing.
- Never commit generated binaries or secrets; note required assets in TODO lists instead.
- Document meaningful decisions either in commit messages or the pull request’s Decision Log section.

Thank you for helping us build Treazr Island responsibly!
