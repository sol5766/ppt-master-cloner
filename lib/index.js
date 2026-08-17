/**
 * dsh-ppt-master
 *
 * DeepSeek Harness bundle plugin: keeps the ppt-master project
 * (github.com/hugohe3/ppt-master — AI native PowerPoint generator)
 * installed and up to date on this machine.
 *
 * Behavior:
 *   - On activation: if the target directory does not exist, `git clone`
 *     the upstream repo (non-blocking; status is reported through the
 *     `ppt_master` tool). If it exists, fetch origin and fast-forward
 *     merge when the remote has new commits (autoPull, default on).
 *   - Periodically (checkIntervalMs, default 6h): same fetch/merge pass.
 *   - Tool `ppt_master` (action=status|update): report local path, local
 *     and remote HEAD, staleness, and the last error; or force an update.
 *
 * No external services, no telemetry, no outbound traffic beyond the git
 * fetch/clone to the configured repository URL. All state stays on this
 * machine under the target directory.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { defineTool } from '@deepseek-ai/dsh-tools'

const execFileAsync = promisify(execFile)

const DEFAULT_REPO = 'https://github.com/hugohe3/ppt-master.git'
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const GIT_TIMEOUT_MS = 5 * 60 * 1000 // clone of the repo with examples can be slow

function defaultTargetDir() {
  const base = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(base, 'ppt-master')
}

/**
 * Run one git command inside `dir`.
 * @returns trimmed stdout, or throws with stderr attached.
 */
async function git(dir, args, timeoutMs = GIT_TIMEOUT_MS) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', dir, ...args], {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    })
    return String(stdout ?? '').trim()
  } catch (error) {
    const detail = error?.stderr ? String(error.stderr).trim() : (error?.message ?? String(error))
    throw new Error(`git ${args.join(' ')} failed: ${detail}`)
  }
}

/**
 * One synchronization pass over the ppt-master checkout.
 * @returns a short human-readable report.
 */
async function syncRepo(state, force = false) {
  const { targetDir, repoUrl } = state
  if (!existsSync(join(targetDir, '.git'))) {
    // Fresh install: clone the upstream repo. Shallow by default — the repo
    // carries large example decks, and `--depth 1` keeps first install fast
    // while still giving full updatability via fetch.
    if (force) return 'target does not exist; nothing to update'
    const cloneArgs = ['clone', ...(state.shallow ? ['--depth', '1'] : []), repoUrl, targetDir]
    await execFileAsync('git', cloneArgs, {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    })
    const head = await git(targetDir, ['rev-parse', '--short', 'HEAD'])
    state.currentHead = head
    state.lastCheck = Date.now()
    state.lastError = null
    return `cloned ${repoUrl} -> ${targetDir} (HEAD ${head}, shallow: ${state.shallow})`
  }

  const branch = await git(targetDir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const fetchArgs = ['fetch', 'origin', branch, ...(state.shallow ? ['--depth', '1'] : [])]
  await git(targetDir, fetchArgs)
  const local = await git(targetDir, ['rev-parse', 'HEAD'])
  const remote = await git(targetDir, ['rev-parse', 'FETCH_HEAD'])
  state.currentHead = local
  state.remoteHead = remote
  state.lastCheck = Date.now()
  state.lastError = null

  if (local === remote) {
    return `up to date at ${targetDir} (${local.slice(0, 7)})`
  }
  if (!state.autoPull) {
    return `update available: local ${local.slice(0, 7)} -> remote ${remote.slice(0, 7)} (autoPull disabled)`
  }
  await git(targetDir, ['merge', '--ff-only', 'FETCH_HEAD'])
  const head = await git(targetDir, ['rev-parse', '--short', 'HEAD'])
  state.currentHead = head
  state.remoteHead = remote
  return `updated ${targetDir}: ${local.slice(0, 7)} -> ${head}`
}

/** Run sync and record errors into state so the tool can report them. */
function runSync(state, force = false) {
  return syncRepo(state, force).catch((error) => {
    state.lastError = error?.message ?? String(error)
    state.lastCheck = Date.now()
    return `error: ${state.lastError}`
  })
}

export function apply(ctx, config = {}) {
  const targetDir = resolve(config.targetDir || defaultTargetDir())
  const repoUrl = config.repoUrl || DEFAULT_REPO
  const intervalMs = config.checkIntervalMs ?? DEFAULT_INTERVAL_MS
  const autoPull = config.autoPull !== false
  const cloneOnInstall = config.cloneOnInstall !== false
  const shallow = config.shallow !== false

  const state = {
    targetDir,
    repoUrl,
    autoPull,
    shallow,
    currentHead: null,
    remoteHead: null,
    lastCheck: null,
    lastError: null,
  }

  // First pass right after activation (never blocks startup).
  if (cloneOnInstall) {
    runSync(state).then((report) => {
      ctx.logger?.info?.(`[dsh-ppt-master] ${report}`) ?? console.log(`[dsh-ppt-master] ${report}`)
    })
  }

  // Periodic update check. ctx.effect makes the timer disposer-owned, so a
  // stop/update/undefine of this plugin clears it automatically.
  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    ctx.effect(() => {
      const timer = setInterval(() => {
        runSync(state).then((report) => {
          console.log(`[dsh-ppt-master] ${report}`)
        })
      }, intervalMs)
      return () => clearInterval(timer)
    }, 'dsh-ppt-master:check-interval')
  }

  ctx.tools.register(defineTool({
    name: 'ppt_master',
    description: 'Manage the local ppt-master project (AI PowerPoint generator). ' +
      'The plugin keeps it synced from GitHub automatically; use this tool to check ' +
      'status or force an update. Returns the local checkout path, local/remote HEAD, ' +
      'and staleness, or performs a fetch + fast-forward update.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['status', 'update'],
        description: 'status: report checkout path, versions, and last error. update: force a git fetch + fast-forward merge now.',
      },
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) {
        return [{ type: 'text', text: value }]
      },
    },
    async execute(args) {
      const when = state.lastCheck ? new Date(state.lastCheck).toISOString() : 'never'
      const base = [
        `path: ${state.targetDir}`,
        `repo: ${state.repoUrl}`,
        `local:  ${state.currentHead ?? '(not checked)'}`,
        `remote: ${state.remoteHead ?? '(not fetched)'}`,
        `last check: ${when}`,
        state.lastError ? `last error: ${state.lastError}` : 'last error: none',
      ]
      if (args.action === 'update') {
        const report = await runSync(state, true)
        return base.join('\n') + `\nresult: ${report}`
      }
      return base.join('\n')
    },
  }))
}
