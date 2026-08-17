#!/usr/bin/env node
/**
 * Reproducible build for dsh-ppt-master.
 *
 * The plugin is written as plain JavaScript in `src/index.ts` (no TS-only
 * syntax, so no compiler is required). This script materializes the runtime
 * entry `lib/index.js` and the type stub `lib/types/index.d.ts` from it, so a
 * clean checkout is fully buildable with zero dependencies — matching the
 * bundle contract the dsh plugin checker expects.
 */

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const libDir = join(root, 'lib')
const typesDir = join(libDir, 'types')

mkdirSync(typesDir, { recursive: true })
copyFileSync(join(root, 'src', 'index.ts'), join(libDir, 'index.js'))

writeFileSync(
  join(typesDir, 'index.d.ts'),
  `/**
 * dsh-ppt-master — keep the ppt-master project installed and up to date.
 * Type stub for the runtime entry; implementation lives in lib/index.js.
 */
export interface PptMasterConfig {
  /** Local checkout directory. Default: $DSH_HOME/ppt-master */
  targetDir?: string
  /** Upstream git URL. Default: https://github.com/hugohe3/ppt-master.git */
  repoUrl?: string
  /** Update-check interval in ms. Default 21600000 (6h); 0 disables. */
  checkIntervalMs?: number
  /** Auto fast-forward on remote updates. Default true. */
  autoPull?: boolean
  /** Clone on activation when the checkout is missing. Default true. */
  cloneOnInstall?: boolean
  /** Shallow clone/fetch (--depth 1). Default true. */
  shallow?: boolean
}

export function apply(ctx: unknown, config?: PptMasterConfig): void
`,
)

console.log('dsh-ppt-master: built lib/index.js + lib/types/index.d.ts')
