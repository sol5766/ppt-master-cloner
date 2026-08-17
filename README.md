# dsh-ppt-master

DeepSeek Harness 插件:开机自动安装并持续更新 **ppt-master** 项目(AI 生成原生 PowerPoint 的工具,上游仓库 [github.com/hugohe3/ppt-master](https://github.com/hugohe3/ppt-master))。

## 它能做什么

- **安装即拉取**:插件激活后自动 `git clone` ppt-master 最新版到本地(默认 `$DSH_HOME/ppt-master`,即 `~/.dsh/ppt-master`)。
- **自动检测更新**:每 6 小时(可配置)自动 `git fetch` 上游仓库;发现新提交时自动 fast-forward 合并,始终保持最新。
- **可查询/手动更新**:为 Agent 注册 `ppt_master` 工具,可查看本地路径、本地/远端 HEAD、是否落后、最近错误,或强制立即更新。

## 安装

```bash
dsh plugin --profile web add <本仓库 git 地址或本地路径>
# 重启 dsh 后插件生效
```

安装后重启,首次启动会自动 clone;后续每次启动和每 6 小时检查一次更新。

## 配置

插件行支持以下配置(编辑安装后 profile 的 patch 层):

| 键 | 默认值 | 说明 |
|---|---|---|
| `targetDir` | `$DSH_HOME/ppt-master` | ppt-master 本地检出路径 |
| `repoUrl` | `https://github.com/hugohe3/ppt-master.git` | 上游仓库地址(可指向 fork) |
| `checkIntervalMs` | `21600000` (6h) | 自动更新检查间隔;`0` 关闭 |
| `autoPull` | `true` | 检测到更新时自动 fast-forward;`false` 只报告不拉取 |
| `cloneOnInstall` | `true` | 激活时是否自动 clone;`false` 仅初始化 |
| `shallow` | `true` | 浅克隆/浅 fetch(`--depth 1`),首次安装快;`false` 全量克隆 |

示例(patch 层):

```yaml
- id: ppt-master-updater
  name: dsh-ppt-master
  config:
    targetDir: /vol1/data/ppt-master
    checkIntervalMs: 3600000
```

## 使用 ppt-master

安装后,在 Agent 会话中让模型加载 `ppt-master` 技能并按其工作流生成 PPT:

```text
用 ppt-master 把这份文档做成 12 页 PPT
```

脚本位置:`~/.dsh/ppt-master/skills/ppt-master/scripts/`,运行时 Python 见该技能说明。

## 安全与合规

- 无遥测、无外部服务;唯一的出站流量是对 `repoUrl` 的 git fetch/clone。
- 本插件为独立打包层,不声明版权;保留了上游 [MIT LICENSE](./LICENSE)(Copyright (c) 2025-2026 Hugo He),再分发请遵守上游许可。
- 插件自身无任何隐藏行为;所有源码见 [`lib/index.js`](./lib/index.js)。
