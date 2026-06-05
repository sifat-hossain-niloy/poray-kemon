# ADR-008: pnpm as Package Manager

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

We need a Node.js package manager. The choice affects installation speed, disk usage, and CI performance.

---

## Decision

Use **pnpm 9**.

---

## Rationale

| Factor                      | pnpm                       | npm                 | yarn        |
| --------------------------- | -------------------------- | ------------------- | ----------- |
| Installation speed          | Fastest (hard links)       | Slowest             | Fast        |
| Disk usage                  | Minimal (global store)     | Largest             | Medium      |
| Lockfile                    | `pnpm-lock.yaml`           | `package-lock.json` | `yarn.lock` |
| Strict dependency isolation | ✅ (prevents phantom deps) | ❌                  | ⚠️          |
| Monorepo support            | Excellent (workspaces)     | Basic               | Good        |
| Next.js compatibility       | Full                       | Full                | Full        |

pnpm's content-addressable store means packages are stored once globally and hard-linked into each project. CI installs are ~2-3× faster than npm after the first run.

---

## Consequences

**Positive:**

- `pnpm install` is significantly faster in CI (cached store)
- Strict mode prevents accidentally importing a package that isn't in `package.json`
- If we ever add a separate packages (e.g., a shared types package), pnpm workspaces handles it cleanly

**Negative:**

- Slightly less familiar than npm for developers who haven't used it
- Some older scripts assume `npm run` — must use `pnpm run` or add `pnpm` aliases

**Constraints:**

- `.npmrc` must include `shamefully-hoist=false` (default) — don't hoist to avoid phantom dependency issues
- CI must cache `~/.local/share/pnpm/store` to get the speed benefit
- `package.json` must include `"packageManager": "pnpm@9.x.x"` to enforce version
