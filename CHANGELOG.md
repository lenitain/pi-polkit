# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-05

### Added

- `sudo -n`, `doas -n`: a non-interactive `pkcheck` on
  `org.freedesktop.policykit.exec` decides whether the command runs. polkit grants
  it without asking, or the shim exits `1` with `sudo: a password is required` and
  the reason that dropping `-n` lets the agent answer. Measured: a successful
  `pkexec` leaves no temporary authorization behind (`pkcheck --list-temp` stays
  empty), so the silent second run is the agent's own password cache and no
  non-interactive query can predict it; `-n` therefore reports policy, not a
  guess.
- `sudo -v` performs the authentication (`pkcheck --allow-user-interaction`) and
  exits `0`, `1`, `126` when the dialog is dismissed, or `127`; `sudo -nv` uses
  the non-interactive check.
- `sudo -l` prints `pkaction --verbose` for the action and this session's
  temporary authorizations.
- `sudo -k`/`-K` revoke polkit's temporary authorizations and say that an agent's
  own password cache cannot be cleared from here.
- `sudo -H`, `-N`, `-P` are accepted as no-ops: pkexec already sets `HOME`, keeps
  no timestamp and leaves groups alone.
- `sudo -s COMMAND` and `--shell` run the command through a shell, `sudo -b`
  starts it in the background and returns, and `sudo -E`/
  `--preserve-env[=LIST]` re-export the environment inside the command.
- `sudo --help` and `sudo -V` are answered by the real binary, so scripts that
  probe sudo keep working.
- Short options bundle (`sudo -nu bob`), and unknown long options report their own
  name instead of `--`.
- Registered bash tool: one guideline line tells the model that elevation goes
  through polkit, what `-n`, `-v` and `-l` answer, so it plans with the real
  contract instead of learning it from a failed call.
- `pi-polkit-env`: helper that turns `NAME=VALUE` arguments into export
  statements. `-E` passes entries through argv (`env -0` into `xargs -0`), so
  spaces, quotes and newlines survive, and it drops every shim directory from
  `PATH` so an elevated command cannot resolve sudo back to a shim.

### Changed

- The shims share one prologue: `fail`, the polkit subject (pinned with
  `pid,start-time,uid` as `pkcheck(1)` requires), the two checks and the `pkexec`
  wrapper.
- `-n` failures exit `1` like sudo, not `64`: `64` now means only that the
  invocation cannot be expressed. README documents the four-way handling
  (translated, no-op, checked, refused) and polkit's missing temp authorization.
- `sudo -i`, `-S`, `-A`, `sudoedit` and `visudo` still refuse, now from the shared
  prelude.

## [0.1.1] - 2026-11-04

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
