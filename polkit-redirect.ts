import type { BashOperations, ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { createBashToolDefinition, createLocalBashOperations } from "@earendil-works/pi-coding-agent"
import { polkitShimsPathExportLine, removePolkitShims, withPolkitShimsOnPath } from "./polkit-shims"

/**
 * Redirects sudo, doas and su -c to pkexec inside Pi, so authorisation goes
 * through the desktop's polkit agent instead of a terminal the shell tools do
 * not have. Applies to the `bash` tool and to `!` user commands; `sudo` in other
 * terminals is unchanged.
 *
 * The redirect is a PATH prepend, not a command rewrite: the shims in
 * polkit-shims.ts stand in for the sudo/doas/su binaries, and the shell's own
 * name resolution picks them up for `sudo`, `$(sudo …)`, `xargs sudo`,
 * `FOO=1 sudo` and nested scripts alike. Nothing parses the command string,
 * and nothing parses pkexec's output: the shims hand pkexec's exit status
 * (126 dismissed, 127 not authorized) back to the caller unchanged.
 */
export default function polkitRedirect(pi: ExtensionAPI): void {
  // The bash tool spawns with a prepared environment, so the shims reach it as
  // a PATH prepend. Registering the built-in's own definition under its own
  // name replaces it and keeps its prompt metadata and renderers.
  const bash = createBashToolDefinition(process.cwd(), {
    spawnHook: ({ command, cwd, env }) => ({ command, cwd, env: withPolkitShimsOnPath(env) }),
  })
  // The model plans privilege with what it knows about sudo. Say once, in the
  // system prompt, how this shell differs, so it does not learn it by failing.
  bash.promptGuidelines?.push(
    "`sudo`, `doas` and `su -c` are routed to pkexec, so a desktop polkit dialog authorises them instead of a terminal password prompt. `sudo -n` runs the command only if polkit would authorise it without asking, `sudo -v` performs a real authentication, and `sudo -l` prints the polkit policy that decides. Ask the user before retrying a dismissed or failed dialog instead of looping: on systems with pam_faillock, failed or empty password submissions count toward a system-wide lockout shared with login, while dismissing the dialog does not.",
  )
  pi.registerTool(bash)

  pi.on("user_bash", () => ({ operations: polkitShimsUserBashOperations() }))

  // The shims are session-scoped; the next session recreates them lazily.
  pi.on("session_shutdown", () => removePolkitShims())
}

/**
 * Local shell operations whose commands resolve sudo and su through the shims. The
 * `!` user commands run through pi's own bash backend with no prepared
 * environment, so the PATH prepend happens as the first command line; the
 * exit status and output of the command itself are unchanged.
 */
function polkitShimsUserBashOperations(): BashOperations {
  const local = createLocalBashOperations()
  return {
    exec: (command, cwd, options) => local.exec(`${polkitShimsPathExportLine()}\n${command}`, cwd, options),
  }
}
