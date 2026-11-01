# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-01

### Added

- `polkit-shims.ts`: `sudo`, `doas`, `sudoedit` and `visudo` scripts written to
  a private `0700` directory under `$XDG_RUNTIME_DIR` (falling back to `/tmp`)
  on first use and removed at session shutdown. `sudo` and `doas` forward to
  `pkexec`; `sudoedit` and `visudo` refuse, because polkit has no equivalent
  flow.
- Deterministic option contract in the shims: `-u USER`, `-uUSER`, `--user USER`
  and `--user=USER` become `pkexec --user USER`, `--` ends option parsing, and
  every other option is refused with exit status `64` and a message naming the
  alternative (`-n` → polkit decides, `-i`/`-s` → `pkexec bash`, `-E`/`-H`/`-P`
  → pkexec sanitizes the environment, `-b` → append `&`). `pkexec` would
  otherwise reject them with `Cannot run program`, which says nothing about what
  to do next.
- `polkit-redirect.ts`: one Pi-compatible extension factory for both Pi and
  PiG. The `bash` tool is replaced by the built-in's own definition with a
  `spawnHook` that prepends the shim directory to `PATH`, and `!` user commands
  run through `createLocalBashOperations` with the same prepend as their first
  command line. Command text is never rewritten.
- Authentication outcomes are reported from exit status alone (`126` dismissed,
  `127` not authorized, `64` refused invocation); the shims print one line
  explaining status `126`, the only pkexec failure path that is silent.
- `SHIM_USAGE_EXIT` (64) documents that the refusal status is the shim's own
  and cannot be confused with pkexec's `126`/`127`.
- Engineering scaffolding: `npm run check` type-checks against the pinned
  `@earendil-works/pi-coding-agent` 1.4.0, GitHub Actions CI runs it on every
  push and pull request, and `.gitignore`/`.editorconfig` match the sibling
  opencode-polkit project.
