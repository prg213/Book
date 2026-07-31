---
name: EAS .easignore pnpm store exclusion
description: EAS archive upload fails with EDQUOT (error -122) if .local/ is not excluded — pnpm global store is at .local/share/pnpm/store and gets copied into the archive tarball
---

## Rule
Always include `.local/` in `.easignore` for this monorepo.

**Why:** EAS's shallow-clone step copies the full workspace including `/home/runner/workspace/.local/share/pnpm/store` (the global pnpm cache). This makes the archive huge and hits the disk quota (EDQUOT, error -122) during `copyfile`. Adding `.local/` to `.easignore` drops the archive from ~1.9 GB to ~476 MB and makes the upload succeed.

**How to apply:** The root `.easignore` already has `.local/` excluded. If it ever goes missing or builds fail with "Unknown system error -122, copyfile ... /pnpm/store/", add `.local/` back to `.easignore`.

Also exclude on each build: `rm -rf /tmp/runner` before invoking `eas build` to prevent stale temp artifacts from a previous failed upload from eating disk space.
