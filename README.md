# pi-polkit

Redirects `sudo`, `doas` and `su -c` to `pkexec` inside Pi, so authorisation
goes through the desktop's polkit agent (KDE, GNOME, …) instead of a terminal
the shell tools do not have. Applies to the `bash` tool and to `!` user
commands; `sudo` in other terminals is unchanged.

## Scope

This extension covers one category: **elevation → polkit**. It exists because
the `bash` tool has no terminal, so any program that reads a password from
`/dev/tty` fails there. `sudo`, `doas` and `su -c` are that category, and they
are routed to `pkexec`, which asks the desktop's polkit agent instead.

Password prompts that are not polkit's business are out of scope: `ssh`,
`ssh-add`, `gpg`/pinentry, keyrings (`secret-tool`, KWallet), database clients
(`psql`, `mysql -p`, `redis-cli`), `kinit`, and disk encryption (`cryptsetup`,
`fscrypt`, `gocryptfs`). They read the process's own terminal, so they need an
askpass helper or a pseudo-terminal, not polkit; mixing them in would make this
extension's boundary meaningless.

## Installation

Install as a Pi package (published on npm):

```sh
pi install npm:pi-polkit
```

Or copy or symlink this directory into Pi's extension location:

```sh
cp -r pi-polkit ~/.pi/agent/extensions/pi-polkit
```

For a quick test without installing, pass the directory to Pi:

```sh
pi -e ./pi-polkit
```

## Behavior

| Command                | Result                                      |
|------------------------|---------------------------------------------|
| `sudo apt install x`   | polkit dialog, then runs as root            |
| `sudo -u bob …`        | as above, as `bob`                          |
| `cat x \| sudo tee y`  | dialog for `tee`                            |
| `sudo -n …`            | runs only if polkit would authorise without asking; otherwise exit 1 with `sudo: a password is required` |
| `sudo -v`              | performs the authentication, as `sudo -v` does |
| `sudo -l`              | prints the polkit policy and this session's temporary authorizations |
| `sudo -k`, `-K`        | revokes polkit's temporary authorizations   |
| `sudo -H`, `-N`, `-P`  | accepted: pkexec already does what they ask |
| `sudo -s CMD`          | runs `CMD` through a shell, as root         |
| `sudo -E …`            | runs with the caller's environment          |
| `sudo -b …`            | starts the command in the background        |
| `sudo --help`, `-V`    | answered by the real sudo; nothing elevates |
| `sudo -i`, `-S`, `-A`  | refused, with the equivalent command        |
| `sudoedit`, `visudo`   | refused, with the alternative               |
| `su -c 'id'`           | dialog, then runs as root                   |
| `su -c 'id' bob`       | as above, as `bob` (administrator password) |
| `su`, `su -`, `su -l`  | refused: no interactive shell, no terminal  |
| `su -m`, `-s`, `-g`, `-w`, `--pty` | refused, with the alternative   |
| `pkexec …`             | passed through                              |

An option is refused only when polkit cannot express it: it needs a terminal, a
password channel polkit does not have, or an editor. Refusals exit with status 64
and one line naming the alternative.

## How it works

`sudo`, `doas` and `su` stand-ins are placed first on `PATH`, so the shell
resolves those instead of the system binaries, and they forward the command to
`pkexec`. Command text is never rewritten, so quoting, pipes and subshells need
no special handling.

Two wiring paths put the stand-ins on `PATH`, one per execution form:

- The `bash` tool is replaced by the built-in's own definition with a
  `spawnHook` that prepends the shim directory to the spawned environment.
- `!` user commands run through Pi's local bash backend with no prepared
  environment, so their wrapper prepends `export PATH=…` as the first command
  line instead.

The shim directory is created lazily in `$XDG_RUNTIME_DIR` (falling back to
`/tmp`) as `0700` and removed at session shutdown. It also holds
`pi-polkit-env`, the helper that `sudo -E` uses to re-export an environment
pkexec stripped.

## Authorisation

`polkitd` decides whether a password is required. These commands always require
one; other actions may not, according to policy. The extension takes no part in
that decision.

`org.freedesktop.policykit.exec` asks for administrator authentication on every
call, but the desktop agent may keep the password it just received and answer
the next challenge itself (KDE's agent does). A second command in the same
session then runs without a dialog. That cache belongs to the agent: another
agent, a restarted agent or a dismissed dialog means the next command prompts
again, so do not rely on it.

Measured on polkit 128 with `polkit-gnome`'s agent: after a successful `pkexec`,
`pkcheck --list-temp` prints nothing and a non-interactive `pkcheck` still
reports that authentication is required. polkit records no temporary
authorization for this action, so the silent second run is the agent answering
from its own copy of the password, and no user-space query can predict it. That
is why `sudo -n` reports what the policy says rather than guessing whether a
dialog would appear, and why `sudo -k` can only clear polkit's own record.

The extension keeps no authorization state of its own: `sudo -v` verifies once
and writes nothing, `sudo -n` assumes nothing, and `sudo -k` only clears polkit's
record. Authorising one command therefore leaves the next one to be decided
again, which is the point — the person who allowed an upgrade can still refuse
the deletion that follows. What widens that window is the agent's password
cache, not this extension, and nothing here can revoke it.

## Limitations

- Absolute paths (`/usr/bin/sudo`) and relative ones (`./sudo`) bypass `PATH`.
- Commands that reset `PATH` (`env -i`, `PATH=/usr/bin …`) bypass it as well.
- Programs that invoke `sudo` with a scrubbed environment bypass it.
- `su -c … USER` authenticates an administrator (polkit), not `USER`, so an
  account that real `su` would allow can be refused here.
- `su -c` runs the command with `sh -c`, not with the target user's login shell.
- `sudo -E` re-exports the environment through `pkexec`'s argument list, so the
  values are visible in `ps` while the command starts. Exported shell functions
  are skipped, and `PATH` loses the shim directories.
- `sudo -k` cannot clear the password a desktop agent holds; only polkit's
  temporary authorizations are revoked.
- PowerShell is not handled; the extension targets Linux only.

These bypass the redirect, not polkit, which still decides whether the command
runs.

## Requirements

`polkit` and a registered authentication agent. Desktop environments start one;
without one, `pkexec` fails instead of prompting.

## Exit status

| Status | Meaning                                                |
|--------|--------------------------------------------------------|
| 1      | `-n` or `-v` could not be satisfied: polkit requires authentication, or refuses |
| 126    | the polkit dialog was dismissed                        |
| 127    | not authorized, or the program could not run           |
| 64     | the extension refused the invocation                   |

Messages are in English.

## Development

`npm install && npm run check` type-checks against the pinned
`@earendil-works/pi-coding-agent` 1.4.0, the API Pi serves to Node
extensions.

## License

MIT
