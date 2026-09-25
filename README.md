# 🥋 Git 练功房

> 仓库地址：https://github.com/zhengqiuyang/git-dojo

![CI](https://github.com/zhengqiuyang/git-dojo/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green)

一个专门面向 **Git 新手** 的闯关式学习平台。在真实的沙盒仓库里敲 `git` 命令闯关，分支图实时可视化，有看得见你仓库的 AI 助教，闯不过去还能看提示、重置重来。

欢迎贡献：新关卡创意、判分优化、文案润色都欢迎，见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## ✨ 核心功能

| 功能 | 说明 |
| --- | --- |
| 🖥️ 沙盒终端 | 内嵌真终端，跑的是**真实的 git**，所有练习都在独立沙盒目录里，弄不坏自己的电脑 |
| 🌳 分支图可视化 | 每敲一条命令，提交历史 / 分支 / 远程镜像 / HEAD 的拓扑图实时刷新，看得见仓库里发生了什么 |
| 🎯 闯关课程 | 19 个关卡：基础五关（init→分支→合并→冲突→rebase）+ 进阶五关（撤销→tag→远程→stash→detached HEAD）+ 实战五关（考古→amend→分支清理→push 被拒→综合演练）+ 高手四关（cherry-pick→bisect→reflog→gitignore），目标自动判分 |
| 🤖 AI 助教 | **看得见你的仓库的 AI Agent**：每次对话自动注入关卡进度、提交图、工作区状态、**操作轨迹（命令+输出）**；可一键「复盘我的轨迹」找出走偏的一步；苏格拉底式引导（不直接剧透答案）；支持任何 OpenAI 兼容接口（智谱 GLM / DeepSeek / OpenAI / Ollama） |
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
| 09 · stash | 随身行李 | stash / stash pop / 未完成改动的进退之道 |
| 10 · detached HEAD | 时光机器 | checkout 历史提交 / 游离头指针 / switch -c 锚定 |
| 11 · 历史考古 | 事故调查 | log -p / diff / show 定位问题提交 |
| 12 · 提交打磨 | 橡皮擦 | commit --amend 补文件改信息 |
| 13 · 分支清理 | 善后 | branch -d / -D，已合并与未合并的差别 |
| 14 · push 被拒 | 化解冲突 | non-fast-forward / pull 再 push |
| 15 · 综合演练 | 发布日 | pull→branch→merge→tag→push 全流程串烧 |
| 16 · cherry-pick | 摘樱桃 | 只摘需要的那个提交，乱改不混入 |
| 17 · bisect | 二分捉虫 | 自动二分定位引入 bug 的提交 |
| 18 · reflog | 时光邮差 | 找回被 reset --hard 弄丢的提交 |
| 19 · gitignore | 看不见的文件 | 忽略规则 / rm --cached 停止跟踪 |

第 8 关在沙盒里用**裸仓库模拟 GitHub 远程**，还内置了一个"同事"的克隆仓库往远程推代码，完整体验协作流程。第 11 关是"找出是谁改坏了文件"的侦探剧情；第 17 关模拟真实的 bisect 逐次验货；第 15 关把所有招式串成一次真实发布。

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
node scripts/api-test.mjs   # 模拟玩家打通全部 19 关，64 项断言
```

测试包含一条铁律不变量：**每关刚进入时所有目标必须未完成**（杜绝"没做就打勾"）。

## 🛠️ 技术栈

Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + xterm.js；后端用 Node 直接执行真实 git（白名单命令，不经过 shell，路径全部限制在沙盒内）。

## 🗺️ 路线图

- 第 20 关 worktree：分身术（多分支并行，需要多终端支持，开发中）
- 第 21 关 rebase -i：交互式变基（重排/合并/改写提交）
- 第 22 关 submodule：仓库里的仓库
- 第 23 关 团队实战模拟（模拟真实多人协作工作流）
- AI 操作轨迹回放式点评（已在 AI 助教中支持）、错题本 + 间隔复习、关卡编辑器 + 社区共创
- 多人对战 / 排行榜
