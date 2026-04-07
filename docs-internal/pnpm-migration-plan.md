# pnpm Migration - Incremental Phased Plan

**Status: COMPLETE** -- All 6 phases implemented and CI-verified on branch `pnpm-phased-migration`.

## Context

MachinaOs used npm 10 with workspaces but had 3 fragmented Node.js dependency trees (root, `client/`, orphaned `server/nodejs/`), no `packageManager` pinning, no CI cache strategy, and heavy `node_modules` duplication from React 19 + Ant Design 5. This plan broke the migration into 6 self-contained commits ordered by performance gain and risk.

**Pain points:**
1. **Fragmented lockfiles** -- 3 uncoordinated Node projects with separate `package-lock.json` files that drift over time
2. **No `packageManager` field** -- Different contributors run different npm versions; CI runs whatever GitHub Actions ships
3. **Heavy duplicated `node_modules`** -- React 19 + Ant Design 5 + React Flow 11 = hundreds of MB duplicated across 3 installs
4. **No CI cache strategy** -- Cold installs are slow for ~35 deps
5. **Global CLI flakiness** -- `install.sh` has ~50 lines of WSL/nvm workarounds

**Constraint**: End users still install via `npm install -g machinaos`. Publish target unchanged.

**Prior art**: A worktree at `.claude/worktrees/pnpm-migration/` has working pnpm config files (`pnpm-workspace.yaml`, `.npmrc`, `pnpm-lock.yaml`, `package.json` with `packageManager`).

---

## Phase 1: Config Files Only (additive, zero-risk) -- DONE

**Goal**: Land pnpm config files so any developer with pnpm can run `pnpm install`. npm continues to work unchanged.

| Action | File |
|--------|------|
| Create | `pnpm-workspace.yaml` -- `packages: [client, server/nodejs]` |
| Create | `.npmrc` -- `auto-install-peers=true`, `strict-peer-dependencies=false`, `shamefully-hoist=false`, `node-linker=isolated` |
| Edit | `package.json` -- add `"packageManager": "pnpm@9.15.0"` + `pnpm.peerDependencyRules.allowedVersions` |
| Edit | `.gitignore` -- add `pnpm-store/`, `.pnpm-debug.log` |

**Why first**: Purely additive. npm ignores pnpm-specific files. The `packageManager` field is informational until corepack is enabled. Zero risk of breaking any existing workflow.

**Verify**: `pnpm install && pnpm run build && pnpm run start -- --skip-whatsapp`

**PR scope**: ~4 files, all additive.

---

## Phase 2: Lockfile Swap + Workspace Unification -- DONE

**Goal**: Replace `package-lock.json` with `pnpm-lock.yaml`. Bring `server/nodejs` into the workspace. This is the commitment point -- contributors must use pnpm after this.

| Action | File |
|--------|------|
| Generate | `pnpm-lock.yaml` via `pnpm install` |
| Delete | `package-lock.json` |
| Delete | `server/nodejs/package-lock.json` |

**Why second**: Phase 1 already proved pnpm works. The `preinstall.js` lifecycle scripts still execute under pnpm. Low risk.

**Verify**: Clean clone + `corepack enable && pnpm install`, verify `server/nodejs/node_modules` populated via workspace.

**PR scope**: 2 files deleted, 1 file generated.

---

## Phase 3: CI Pipeline Migration (biggest perf win) -- DONE

**Goal**: Switch GitHub Actions from npm to pnpm with content-addressable store caching. Expected 30-50% faster CI cold installs.

| Action | File | Detail |
|--------|------|--------|
| Edit | `.github/actions/setup/action.yml` | Add `pnpm/action-setup@v4` step, change `setup-node` cache to `pnpm` |
| Edit | `.github/workflows/predeploy.yml` | `npm install` -> `pnpm install`, `npm run` -> `pnpm run` |
| Edit | `.github/workflows/release.yml` | pnpm for build steps, **keep `npm publish`** for releases |
| Edit | `.github/workflows/test-install.yml` | pnpm for source builds, keep npm for end-user install test |

**Key decisions**:
- Global CLI tools (`temporal-server`): keep `npm install -g` in CI (simpler than pnpm global bin path config)
- Publish steps: stay `npm publish` (provenance + registry auth already configured)
- `test-npm-install` job: stays npm (tests end-user experience)

**Verify**: Push branch, verify CI green on all 3 OS matrix runners. Check cache hit on second push.

**PR scope**: 4 workflow files.

---

## Phase 4: Script Migration (developer experience) -- DONE

**Goal**: Internal scripts use pnpm. `pnpm run start/dev/build/clean` all work natively.

| Action | File | Change |
|--------|------|--------|
| Edit | `scripts/build.js` | `npm install` -> `pnpm install`, `npm run build` -> `pnpm run build` |
| Edit | `scripts/install.js` | Remove separate client `npm install` (workspace handles it), use `pnpm install` at root |
| Edit | `scripts/start.js` | `npx concurrently` -> `pnpm exec concurrently`, `npm:python:start` -> `"pnpm run python:start"` |
| Edit | `scripts/dev.js` | Same concurrently changes as start.js |
| Edit | `scripts/clean.js` | Add pnpm awareness to cleanup targets |

**Critical detail**: concurrently's `npm:xxx` shorthand calls npm directly. Must replace with `"pnpm run xxx"` strings in all service arrays.

**NOT changed**: `bin/cli.js` stays calling npm -- end users installed via npm, so `machina start` correctly calls `npm run start`. Source developers run `pnpm run start` directly.

**Verify**: `pnpm run build`, `pnpm run start -- --skip-whatsapp`, `pnpm run dev -- --skip-whatsapp`, `pnpm run clean`

**PR scope**: ~5 script files.

---

## Phase 5: End-User Hardening + `machina doctor` -- DONE

**Goal**: Better diagnostics, clearer contributor guidance.

| Action | File | Change |
|--------|------|--------|
| Edit | `bin/cli.js` | Add `doctor` command |
| Edit | `install.sh` | Print pnpm recommendation for source developers after install |
| Edit | `install.ps1` | Same as install.sh |

**`machina doctor` checks**:
- Node.js >= 22, Python >= 3.12, uv installed
- pnpm version matches `packageManager` field (if source checkout)
- `pnpm-lock.yaml` exists (source) vs `package-lock.json` (global npm install)
- Disk usage report (node_modules size)

**Verify**: Run `install.sh` in fresh Ubuntu. Run `machina doctor` from both global install and source checkout.

**PR scope**: 3 files.

---

## Phase 6: Strictness + Scale -- DONE

**Goal**: Prevent regression, catch lockfile drift, block accidental npm usage.

| Action | File | Change |
|--------|------|--------|
| Edit | `.npmrc` | `strict-peer-dependencies=true` (tighten from false) |
| Edit | `package.json` | Replace `preinstall` with `npx only-allow pnpm` |
| Edit | CI workflows | Add `--frozen-lockfile` to all `pnpm install` |
| Add | CI workflows | `pnpm audit --prod` step in release workflow |
| Edit | `package.json` | Move client `overrides` to root `pnpm.overrides` |

**Verify**: Confirm `npm install` at root is blocked. Confirm `--frozen-lockfile` catches intentional mismatch. Run `pnpm audit`.

**PR scope**: 3-5 files.

---

## Phase Dependency Graph

```
Phase 1 (config files) -- no deps, merge first
   |
Phase 2 (lockfile swap) -- depends on 1
   |
   +--- Phase 3 (CI pipeline) -- depends on 2
   |
   +--- Phase 4 (scripts) -- depends on 2, can parallel with 3
          |
       Phase 5 (end-user) -- depends on 4
          |
       Phase 6 (strictness) -- depends on 3 + 5
```

## Risk Summary

| Phase | Risk | Breaking? | Rollback |
|-------|------|-----------|----------|
| 1 | Near zero | No | Delete added files |
| 2 | Low | Yes (devs need pnpm) | Restore `package-lock.json` from git |
| 3 | Medium | No | Revert workflow files |
| 4 | Medium | No | Revert script changes |
| 5 | Low | No | Revert installer changes |
| 6 | Low | No | Revert strictness settings |

## Key Files Reference

| File | Phases |
|------|--------|
| `package.json` | 1, 6 |
| `pnpm-workspace.yaml` | 1 |
| `.npmrc` | 1, 6 |
| `.gitignore` | 1 |
| `package-lock.json` | 2 (delete) |
| `server/nodejs/package-lock.json` | 2 (delete) |
| `pnpm-lock.yaml` | 2 (create) |
| `.github/actions/setup/action.yml` | 3 |
| `.github/workflows/predeploy.yml` | 3, 6 |
| `.github/workflows/release.yml` | 3, 6 |
| `.github/workflows/test-install.yml` | 3 |
| `scripts/build.js` | 4 |
| `scripts/install.js` | 4 |
| `scripts/start.js` | 4 |
| `scripts/dev.js` | 4 |
| `scripts/clean.js` | 4 |
| `bin/cli.js` | 5 |
| `install.sh` | 5 |
| `install.ps1` | 5 |

## Existing Resources

The prior worktree at `.claude/worktrees/pnpm-migration/` (branch `pnpm-migration-docker-removal`) has working versions of:
- `pnpm-workspace.yaml`, `.npmrc`, `package.json` (with `packageManager` + `peerDependencyRules`)
- `pnpm-lock.yaml` (347KB)

These can be copied directly for Phases 1-2.
