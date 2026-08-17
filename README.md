# dsh-ppt-master

DeepSeek Harness 插件:开机自动安装并持续更新 **ppt-master** 项目(AI 生成原生 PowerPoint 的工具,上游仓库 [github.com/hugohe3/ppt-master](https://github.com/hugohe3/ppt-master))。

## 它能做什么

- **安装即拉取**:插件激活后自动 `git clone` ppt-master 最新版到本地(默认 `$DSH_HOME/ppt-master`,即 `~/.dsh/ppt-master`)。
- **自动检测更新**:每 6 小时(可配置)自动 `git fetch` 上游仓库;发现新提交时自动 fast-forward 合并,始终保持最新。
- **可查询/手动更新**:为 Agent 注册 `ppt_master` 工具,可查看本地路径、本地/远端 HEAD、是否落后、最近错误,或强制立即更新。

---

## 使用指南

### 1. 安装插件

**方式 A:插件市场安装(推荐)**

本仓库已收录进 dsh 插件市场(`topic: dsh-plugin`)。打开 DeepSeek Harness 网页界面的**插件市场**,搜索 `ppt-master`,找到 **ppt-master-cloner** 一键安装,重启 dsh 生效。

**方式 B:命令行安装**

```bash
dsh plugin --profile web add https://github.com/sol5766/ppt-master-cloner.git
# 重启 dsh 后插件生效
```

**方式 C:本地开发安装**

```bash
dsh plugin --profile web add /path/to/dsh-ppt-master
```

> 提示:安装后**务必重启 dsh**。首次启动时插件会在后台自动克隆 ppt-master(浅克隆,快),克隆完成前 `ppt_master` 工具的状态会显示 `not checked`。

### 2. 验证安装成功

重启后,在任意 Agent 会话里让模型执行:

```text
用 ppt_master 工具查看状态
```

正常输出类似:

```text
path: /root/.dsh/ppt-master
repo: https://github.com/hugohe3/ppt-master.git
local:  e7dda31
remote: e7dda31
last check: 2026-08-17T15:00:00.000Z
last error: none
```

看到 `local` 与 `remote` 一致、`last error: none`,即表示安装成功且已是最新。

### 3. 生成 PPT(核心用法)

插件本身只负责**拉取和维护 ppt-master 源码**;生成 PPT 靠的是 ppt-master 项目的技能与脚本,插件安装后它们就在本地可用。

**在 Agent 会话中直接说:**

```text
用 ppt-master 把这份文档做成 12 页 PPT
```

模型会自动加载本地的 `ppt-master` 技能,并按其标准工作流执行:

1. **资料收集** → `sources/research.md`
2. **设计规格** → `spec_lock.md`(画布/配色/字体/页面节奏)
3. **SVG 设计** → 12 页幻灯片(SVG)
4. **导出 PPTX** → 原生可编辑的 `.pptx`(可加转场、动画、旁白)

**手动运行(不走 Agent,直接命令行):**

```bash
# 进入 ppt-master 项目根目录
cd ~/.dsh/ppt-master

# 使用运行时 Python(系统 Python 可能缺依赖)
/vol1/@appcenter/trim.hermes/runtime/python/bin/python3.11 \
  skills/ppt-master/scripts/svg_to_pptx.py projects/<project> \
  -o projects/<project>/exports/<project>.pptx
```

**快速路径(无 SVG 管线时):** 直接 python-pptx 生成,复用模板框架
`skills/ppt-master/templates/pptx_framework.py`(深蓝+金金融风设计令牌 + 常用组件 helper)。

> 完整的 PPT 制作流程、坑位记录与 QA 方案,以技能文档 `~/.dsh/ppt-master/skills/ppt-master/SKILL.md` 为准。

### 4. 查看与强制更新

| 需求 | 对 Agent 说 |
|---|---|
| 查看当前状态 | `用 ppt_master 工具查看状态` |
| 强制立即更新 | `用 ppt_master 工具强制更新` |
| 关闭自动更新 | 在配置里设 `checkIntervalMs: 0` |

---

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

---

## 常见问题

**Q:安装后 `ppt_master` 工具显示 `not checked` / `last check: never`?**
首次克隆在后台进行,大仓库(含示例 deck)可能需要几分钟。稍等后再次查询即可。若长时间不变,检查网络能否访问 GitHub,或手动执行一次"强制更新"。

**Q:克隆很慢?**
默认已开启浅克隆(`--depth 1`),只拉取最新提交,大幅减少下载量。若仍慢,大概率是网络到 GitHub 的带宽问题;可把 `repoUrl` 指向可达的镜像/fork。

**Q:更新时提示 `error: git fetch ... failed`?**
一般是网络问题或上游仓库暂时不可用,不影响已克隆的版本;下次自动检查会重试。

**Q:想完全自己控制 ppt-master 版本,不让它自动更新?**
设置 `autoPull: false`(只报告不拉取)或 `checkIntervalMs: 0`(关闭自动检查),需要时手动强制更新。

**Q:这个插件和"PPT 模式"是什么关系?**
本插件负责**让 ppt-master 源码常驻最新**;"PPT 模式"是 dsh 的 agent 预设,负责**让 Agent 带着 PPT 专属 persona 和技能目录工作**。两者配合使用:装好本插件,再用"PPT 模式"新建会话做 PPT。

---

## 安全与合规

- 无遥测、无外部服务;唯一的出站流量是对 `repoUrl` 的 git fetch/clone。
- 本插件为独立打包层,不声明版权;保留了上游 [MIT LICENSE](./LICENSE)(Copyright (c) 2025-2026 Hugo He),再分发请遵守上游许可。
- 插件自身无任何隐藏行为;所有源码见 [`src/index.ts`](./src/index.ts)。

## 相关链接

- 插件仓库:https://github.com/sol5766/ppt-master-cloner
- 上游项目:https://github.com/hugohe3/ppt-master
