/**
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
