# pi-polkit

Redirects `sudo` and `doas` to `pkexec` inside Pi and PiG, so authorisation
goes through the desktop's polkit agent (KDE, GNOME, …) instead of a terminal
the shell tools do not have. Applies to the `bash` tool and to `!` user
commands; `sudo` in other terminals is unchanged.

A single Pi-compatible extension: Pi and PiG load the same source.

## Installation

Copy or symlink this directory into the extension location of the harness you
use:

```sh
# Pi
cp -r pi-polkit ~/.pi/agent/extensions/pi-polkit

# PiG
cp -r pi-polkit ~/.pig/agent/extensions/pi-polkit
```

For a quick test without installing, pass the directory to either harness:

```sh
pi -e ./pi-polkit
pig -e ./pi-polkit
```

## Behavior

| Command                | Result                                      |
|------------------------|---------------------------------------------|
| `sudo apt install x`   | polkit dialog, then runs as root            |
| `sudo -u bob …`        | as above, as `bob`                          |
| `cat x \| sudo tee y`  | dialog for `tee`                            |
| `sudo -n …`            | refused: pkexec has no non-interactive mode |
| `sudo -i`, `-s`, `-b`  | refused, with the equivalent command        |
| `sudoedit`, `visudo`   | refused, with the alternative               |
| `pkexec …`             | passed through                              |

Refused invocations exit with status 64 and one line naming the alternative.

## How it works

`sudo` and `doas` stand-ins are placed first on `PATH`, so the shell resolves
those instead of the system binaries, and they forward the command to
`pkexec`. Command text is never rewritten, so quoting, pipes and subshells need
no special handling.

Two wiring paths put the stand-ins on `PATH`, one per execution form:

- The `bash` tool is replaced by the built-in's own definition with a
  `spawnHook` that prepends the shim directory to the spawned environment.
- `!` user commands run through Pi's local bash backend with no prepared
  environment, so their wrapper prepends `export PATH=…` as the first command
  line instead.

The shim directory is created lazily in `$XDG_RUNTIME_DIR` (falling back to
`/tmp`) as `0700` and removed at session shutdown.

## Authorisation

`polkitd` decides whether a password is required. These commands always require
one; other actions may not, according to policy. The extension takes no part in
that decision.

## Limitations

- Absolute paths (`/usr/bin/sudo`) and relative ones (`./sudo`) bypass `PATH`.
- Commands that reset `PATH` (`env -i`, `PATH=/usr/bin …`) bypass it as well.
- Programs that invoke `sudo` with a scrubbed environment bypass it.
- PowerShell is not handled; the extension targets Linux only.

These bypass the redirect, not polkit, which still decides whether the command
runs.

## Requirements

`polkit` and a registered authentication agent. Desktop environments start one;
without one, `pkexec` fails instead of prompting.

## Exit status

| Status | Meaning                                      |
|--------|----------------------------------------------|
| 126    | the polkit dialog was dismissed              |
| 127    | not authorized, or the program could not run |
| 64     | the extension refused the invocation         |

Messages are in English.

## Development

`npm install && npm run check` type-checks against the pinned
`@earendil-works/pi-coding-agent` 1.4.0, the API both harnesses serve to Node
extensions. `pig install --validate-only ./pi-polkit` launches the extension
through PiG's real extension host without installing it.

## License

MIT
