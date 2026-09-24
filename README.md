# 🥋 Git 练功房

一个专门面向 **Git 新手** 的闯关式学习平台。在真实的沙盒仓库里敲 `git` 命令闯关，分支图实时可视化，闯不过去还能看提示、重置重来。

## ✨ 核心功能

| 功能 | 说明 |
| --- | --- |
| 🖥️ 沙盒终端 | 内嵌真终端，跑的是**真实的 git**，所有练习都在独立沙盒目录里，弄不坏自己的电脑 |
| 🌳 分支图可视化 | 每敲一条命令，提交历史 / 分支 / 远程镜像 / HEAD 的拓扑图实时刷新，看得见仓库里发生了什么 |
| 🎯 闯关课程 | 8 个新手关卡：init+commit → branch → merge → 解决冲突 → rebase → 撤销 → tag → 远程协作，目标自动判分 |
| 🤖 AI 助教 | **看得见你的仓库的 AI Agent**：每次对话自动注入关卡进度、提交图、工作区状态、最近命令；苏格拉底式引导（不直接剧透答案）；支持任何 OpenAI 兼容接口（智谱 GLM / DeepSeek / OpenAI / Ollama） |
| 📖 场景速查手册 | 按"我遇到了什么问题"组织的速查卡（撤销 / 冲突 / stash / detached HEAD…） |

> 竞品对比与差异化分析见 [docs/竞品分析.md](docs/竞品分析.md)。

## 🚀 运行

需要先装好 [Node.js](https://nodejs.org)（18 以上）和 [Git](https://git-scm.com)。

```bash
npm install     # 首次运行需要
npm run dev     # 启动
```

然后浏览器打开 [http://localhost:3000](http://localhost:3000) 即可。

Windows 下也可以直接**双击 `启动.bat`**。

## 🎮 玩法

1. 左侧看剧情和「学习目标」，在中间终端敲 git 命令；
2. 右侧「分支图」实时展示仓库内部状态（含 origin/main 远程镜像），「文件」页可以像记事本一样编辑文件（解决冲突全靠它）；
3. 目标全部打勾即过关，卡住了点「看个提示」，练坏了点「重置本关」。

## 📚 关卡列表

| 关卡 | 主题 | 知识点 |
| --- | --- | --- |
| 01 · 第一个仓库 | 仓库诞生 | init / status / add / commit |
| 02 · 分支 | 平行宇宙 | branch / switch |
| 03 · 合并 | 时光交汇 | merge / 合并提交 |
| 04 · 解决冲突 | 冲突化解 | 冲突标记 / 三步解决法 |
| 05 · 变基 | 笔直历史 | rebase / 线性历史 |
| 06 · 撤销 | 灾难自救 | restore / reset --soft / rm |
| 07 · 标签 | 版本里程碑 | tag / 附注标签 / 历史回溯 |
| 08 · 远程协作 | 团队节拍 | remote / pull / push / origin/main |

第 8 关在沙盒里用**裸仓库模拟 GitHub 远程**，还内置了一个"同事"的克隆仓库往远程推代码，完整体验协作流程。

## 🤖 配置 AI 助教（可选）

在服务端 `.env`（参考 `.env.example`）或网页 AI 面板的 ⚙️ 设置里配置：

```bash
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
AI_API_KEY=你的Key
AI_MODEL=glm-4-flash
```

网页里的 Key 只保存在浏览器本地。验证链路可用 mock 服务器：

```bash
node scripts/mock-ai-server.mjs &   # 本地 mock（OpenAI 兼容 SSE）
# AI 面板 ⚙️ 里填 base url = http://localhost:8787/v1，key 任意，model = mock-model
```

## 🧪 自动化测试

```bash
npm run dev &          # 先启动服务
node scripts/api-test.mjs   # 模拟玩家打通全部 8 关，31 项断言
```

## 🛠️ 技术栈

Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + xterm.js；后端用 Node 直接执行真实 git（白名单命令，不经过 shell，路径全部限制在沙盒内）。

## 🗺️ 路线图（二期）

- 第 9 关 stash：随身行李
- 第 10 关 detached HEAD 探险
- 第 11 关 历史考古（log / show / diff）
- 第 12 关 综合大演练（模拟真实项目工作流）
- 多人对战 / 排行榜 / 关卡编辑器
