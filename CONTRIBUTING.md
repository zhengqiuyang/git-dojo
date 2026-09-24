# 贡献指南 🥋

感谢对「Git 练功房」感兴趣！无论是报 Bug、提关卡创意还是交代码，都欢迎。

## 本地开发

```bash
git clone https://github.com/zhengqiuyang/git-dojo.git
cd git-dojo
npm install
npm run dev        # http://localhost:3000
```

要求：Node.js 18+、Git 2.3x+。

提交前请跑一遍本地检查：

```bash
npx tsc --noEmit            # 类型检查
node scripts/api-test.mjs   # 9 关全流程测试（需要 dev/start 服务在跑）
```

CI 会在 push / PR 时自动执行同样的检查。

## 如何贡献一个新关卡

关卡是纯数据 + 判分函数，结构见 `src/lib/levels.ts`，一个关卡包含：

- `story` / `steps` / `hints`：剧情、建议路径、渐进提示（中文文案要口语化、有画面感）
- `goals`：每个目标是一个**基于仓库最终状态**的检查函数（`check: (sandbox) => Promise<boolean>`）——注意判分永远看状态，不看学员敲过什么命令
- `setup`：用 git 命令 + 写文件布置初始沙盒

设计新关卡时务必保证：**关卡刚进入时所有目标都是未完成状态**（否则会出现"还没做就打勾"），并通过 `scripts/api-test.mjs` 补一条全流程用例。

## 提交规范

- commit message 用 `feat:` / `fix:` / `docs:` / `chore:` 前缀
- 一个 PR 聚焦一件事；关卡内容改动请附测试结果截图或测试日志

## 行为准则

对新手友好是这个产品的立身之本——讨论中请保持耐心和善意。
