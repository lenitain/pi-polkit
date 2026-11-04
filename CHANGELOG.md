# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `polkit-shims.ts`: `su` stand-in. `su -c COMMAND [USER]` (also `-cCOMMAND`,
  `--command COMMAND`, `--command=COMMAND`) becomes
  `pkexec --keep-cwd --user USER sh -c COMMAND`, because a non-login `su`
  keeps the working directory and runs its command through a shell. Every other
  form is refused with status `64` and one line naming the alternative: `su`,
  `su -`, `su -l` (login shell → `pkexec bash`), `-m`/`-p`/`-w` (pkexec
  sanitizes the environment), `-s` (name the shell in the command), `-g`/`-G`
  (pkexec cannot switch groups), `--pty` (no terminal), `-f` and
  `--session-command`.
- README scope statement: the extension covers elevation → polkit only;
  ssh, gpg/pinentry, keyrings, database clients, `kinit` and disk encryption
  are explicitly out of scope and need an askpass helper or a PTY.

### Changed

- README authorisation note: a desktop agent may reuse the password it already
  holds, so a second command can run without a dialog; that cache belongs to
  the agent and must not be relied on. `su -c … USER` authenticates an
  administrator rather than `USER`, and runs the command with `sh -c`.

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
- `polkit-redirect.ts`: the Pi extension factory. The `bash` tool is
  replaced by the built-in's own definition with a
  `spawnHook` that prepends the shim directory to `PATH`, and `!` user commands
  run through `createLocalBashOperations` with the same prepend as their first
  command line. Command text is never rewritten.
- Authentication outcomes are reported from exit status alone (`126` dismissed,
  `127` not authorized, `64` refused invocation); the shims print one line
  explaining status `126`, the only pkexec failure path that is silent.
- `SHIM_USAGE_EXIT` (64) documents that the refusal status is the shim's own
  and cannot be confused with pkexec's `126`/`127`.
- Engineering scaffolding: `npm run check` type-checks against the pinned
  `@earendil-works/pi-coding-agent` 1.4.0, and GitHub Actions CI runs it on
  every push and pull request.
