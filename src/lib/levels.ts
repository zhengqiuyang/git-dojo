import fs from "fs/promises";
import path from "path";
import {
  branchExists,
  hasCommitWithSubject,
  isAncestor,
  isRepo,
  listTrackedFiles,
  lsTree,
  mergeCommitCount,
  revListCount,
  revParse,
  runGit,
  gitStatus,
  tagCommit,
} from "./git";
import type { Sandbox } from "./sandbox";
import { LEVEL_META } from "./levelMeta";

interface Goal {
  label: string;
  check: (s: Sandbox) => Promise<boolean>;
}

export interface Level {
  id: string;
  title: string;
  subtitle: string;
  story: string;
  steps: string[];
  hints: string[];
  goals: Goal[];
  setup: (s: Sandbox) => Promise<void>;
}

async function write(s: Sandbox, rel: string, content: string) {
  const target = path.join(s.dir, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function git(s: Sandbox, args: string[]) {
  await gitIn(s.dir, args);
}

async function gitIn(dir: string, args: string[]) {
  const r = await runGit(dir, args);
  if (r.code !== 0) {
    throw new Error(`关卡初始化失败: git ${args.join(" ")}\n${r.stderr}`);
  }
}

async function cleanTree(s: Sandbox) {
  // 不是仓库时谈不上"干净"，避免未 init 就打勾
  if (!(await isRepo(s.dir))) return false;
  return (await gitStatus(s.dir)).length === 0;
}

async function fileHasNoConflictMarkers(s: Sandbox, rel: string) {
  try {
    const content = await fs.readFile(path.join(s.dir, rel), "utf8");
    return !content.includes("<<<<<<<") && !content.includes(">>>>>>>");
  } catch {
    return false;
  }
}

export const LEVELS: Level[] = [
  {
    id: "01",
    title: "第 1 关 · 你的第一个仓库",
    subtitle: "init / status / add / commit",
    story:
      "你刚刚加入「像素小镇」开发组，领到了一个只有一份 README 的新项目文件夹。" +
      "第一步：把它变成 Git 仓库，并完成人生第一次提交。" +
      "体会一下代码的旅程：工作区 → 暂存区 → 仓库。",
    steps: [
      "git init — 让这个文件夹变成 Git 仓库",
      "git status — 看看 Git 说了什么（红色的文件 = 还不被管理）",
      "git add README.md — 把文件放进暂存区，再 status 看看变化",
      "git commit -m \"第一个提交\" — 正式存档！",
      "git log — 欣赏一下你的第一次提交",
    ],
    hints: [
      "git init 会在文件夹里生成一个隐藏的 .git 目录，仓库从此诞生。它不会碰你现有的任何文件。",
      "add 是「打包进暂存区」，commit 才是「真正存档」。提交信息用 -m 直接写：git commit -m \"你的信息\"",
      "迷路了就敲 git status，它会告诉你下一步该做什么。",
    ],
    goals: [
      {
        label: "已经 git init，这里是一个真正的 Git 仓库",
        check: (s) => isRepo(s.dir),
      },
      {
        label: "README.md 已被 Git 纳入管理",
        check: async (s) => (await listTrackedFiles(s.dir)).includes("README.md"),
      },
      {
        label: "至少完成了一次提交",
        check: async (s) => (await revListCount(s.dir, "HEAD")) >= 1,
      },
      {
        label: "工作区干干净净（没有未保存的改动）",
        check: cleanTree,
      },
    ],
    setup: async (s) => {
      await write(
        s,
        "README.md",
        "# 像素小镇 · 开发者日记\n\n欢迎来到 Git 的世界！这个小镇的一切都从这里开始。\n"
      );
    },
  },
  {
    id: "02",
    title: "第 2 关 · 平行宇宙：分支",
    subtitle: "branch / switch / 独立开发",
    story:
      "你想实验一个大胆的新想法，但又不敢乱动稳定的 main 分支。" +
      "分支就是平行宇宙：从当前时间线分出去，互不干扰，随时切换。",
    steps: [
      "git branch feature — 创建一个叫 feature 的分支（此时它只是个路标）",
      "git switch feature — 切换到新宇宙",
      "echo 新功能实验 > feature.txt — 造一个只属于实验宇宙的文件",
      "git add feature.txt 然后 git commit -m \"开始新功能实验\"",
      "git switch main — 回主线，注意 feature.txt 是不是「消失」了？",
      "git log --oneline --all — 俯瞰两条时间线",
    ],
    hints: [
      "创建并切换可以一步到位：git switch -c feature（老版本 Git 用 git checkout -b）",
      "新提交必须发生在 feature 上：先 switch 过去，再 add + commit。在哪个分支，提交就落在哪个分支。",
      "想偷看另一个宇宙的进度？在 main 上敲 git log feature。",
    ],
    goals: [
      {
        label: "存在一个叫 feature 的分支",
        check: (s) => branchExists(s.dir, "feature"),
      },
      {
        label: "你的新提交落在 feature 上（而不是 main）",
        check: async (s) => (await revListCount(s.dir, "main..feature")) >= 1,
      },
      {
        label: "完成实验后回到了 main 分支",
        check: async (s) => {
          if (!(await branchExists(s.dir, "feature"))) return false;
          if ((await revListCount(s.dir, "main..feature")) < 1) return false;
          const r = await runGit(s.dir, ["symbolic-ref", "-q", "--short", "HEAD"]);
          return r.code === 0 && r.stdout.trim() === "main";
        },
      },
    ],
    setup: async (s) => {
      await write(s, "README.md", "# 像素小镇 · 开发者日记\n\n项目已经开始啦。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "初始提交：创建 README"]);
      await write(s, "notes.txt", "学习笔记 v1：main 分支上的日常开发。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加学习笔记"]);
    },
  },
  {
    id: "03",
    title: "第 3 关 · 时光交汇：合并",
    subtitle: "merge / 合并分支",
    story:
      "feature 宇宙里的实验成功了！现在把它的成果合并回 main。" +
      "两个分支都有各自的新提交，Git 会创造一个「合并提交」把两条时间线缝合起来。",
    steps: [
      "git switch main — 合并前先站到主线",
      "git merge feature — 把 feature 的成果带回来",
      "git log --oneline --graph — 找到那个交汇的合并提交",
      "git status — 确认一切干净",
    ],
    hints: [
      "merge 的意思是「把对方合并到我这里来」，所以要先站在 main 上：git switch main 之后再 merge。",
      "如果两边改的是同一个文件的同一处，Git 会停下来请你裁决——那就是下一关的故事。这一关两边改的东西不同，可以放心合并。",
      "合并完成后用 git log --graph 能看到两条线汇成一体的样子。",
    ],
    goals: [
      {
        label: "当前在 main 分支上完成合并",
        check: async (s) => {
          const r = await runGit(s.dir, ["symbolic-ref", "-q", "--short", "HEAD"]);
          return r.code === 0 && r.stdout.trim() === "main";
        },
      },
      {
        label: "feature 的提交已完全并入 main",
        check: (s) => isAncestor(s.dir, "feature", "main"),
      },
      {
        label: "main 上出现了合并提交（有两个父提交）",
        check: async (s) => (await mergeCommitCount(s.dir, "main")) >= 1,
      },
      {
        label: "工作区干净，合并顺利完成",
        check: cleanTree,
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "第一章：小镇的早晨。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第一章：小镇的早晨"]);

      await git(s, ["switch", "-c", "feature"]);
      await write(
        s,
        "story.txt",
        "第一章：小镇的早晨。\n第二章：新居民来了。（feature 分支上的剧情）\n"
      );
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第二章：新居民来了"]);

      await git(s, ["switch", "main"]);
      await write(s, "notes.txt", "main 分支上的独立更新：小镇基础设施维护。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "主线的独立更新"]);
    },
  },
  {
    id: "04",
    title: "第 4 关 · 冲突化解现场",
    subtitle: "merge conflict / 冲突解决",
    story:
      "风暴来了：main 和 feature 都改了 story.txt 的同一句话。" +
      "Git 不知道该听谁的，合并被卡住——冲突！这是每个开发者的必经仪式，" +
      "别怕，解决冲突只是「改文件 → add → commit」三步走。",
    steps: [
      "git switch main",
      "git merge feature — 看！冲突发生了",
      "打开右侧「文件」标签页，编辑 story.txt：删掉 <<<<<<<、=======、>>>>>>> 这些标记行，留下你想要的最终版本",
      "git add story.txt — 告诉 Git「我裁决定毕」",
      'git commit -m "解决冲突：统一天气设定" — 完成合并',
      "git log --oneline --graph — 欣赏你的第一个合并提交",
    ],
    hints: [
      "冲突标记的含义：<<<<<<< HEAD 到 ======= 是你（main）的版本，======= 到 >>>>>>> feature 是对方的版本。删掉三行标记，内容你自己定。",
      "三步口诀：改文件 → git add → git commit。缺一步 Git 都不会认为冲突解决了。",
      "实在想逃？git merge --abort 可以完全撤销这次合并，从头再来。或者点「重置本关」。",
    ],
    goals: [
      {
        label: "main 上出现了合并提交",
        check: async (s) => (await mergeCommitCount(s.dir, "main")) >= 1,
      },
      {
        label: "feature 的提交已并入 main",
        check: (s) => isAncestor(s.dir, "feature", "main"),
      },
      {
        label: "story.txt 里没有残留的冲突标记",
        check: (s) => fileHasNoConflictMarkers(s, "story.txt"),
      },
      {
        label: "冲突解决已提交，工作区干净",
        check: cleanTree,
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "小镇的天气总是晴朗。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "设定：小镇的天气"]);

      await git(s, ["switch", "-c", "feature"]);
      await write(s, "story.txt", "小镇的天气总是暴雨。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "feature：改成暴雨剧情"]);

      await git(s, ["switch", "main"]);
      await write(s, "story.txt", "小镇的天气总是大雾。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "main：改成大雾剧情"]);
    },
  },
  {
    id: "05",
    title: "第 5 关 · 笔直的历史：变基",
    subtitle: "rebase / 线性历史",
    story:
      "你在 feature 上创作了两个章节，同时主编在 main 上修订了开篇。" +
      "合并会把历史拧成麻花；这一次试试「变基」：把你的提交整体搬到 main 的最新进度之后，让历史保持一条笔直的线。",
    steps: [
      "git switch feature — 变基前先站到要搬动的分支上",
      "git rebase main — 把 feature 的提交搬到 main 之后",
      "git log --oneline --graph — 欣赏笔直的历史",
    ],
    hints: [
      "方向感：「站在 feature 上，变基到 main」＝ 把我的提交挪到对方后面。别站在 main 上 rebase feature，那是反方向。",
      "变基会生成「内容相同、身份全新」的提交（哈希变了）——正常现象，就像把行李搬进了新家。",
      "搞砸了？git rebase --abort 可以完整回到变基之前的样子。",
    ],
    goals: [
      {
        label: "feature 已包含 main 的全部提交（主编的修订被纳入）",
        check: (s) => isAncestor(s.dir, "main", "feature"),
      },
      {
        label: "变基后章节提交一个不少（feature 恰好领先 main 2 个提交）",
        check: async (s) =>
          (await isAncestor(s.dir, "main", "feature")) &&
          (await revListCount(s.dir, "main..feature")) === 2,
      },
      {
        label: "历史保持笔直（整条 feature 线上没有合并提交）",
        check: async (s) =>
          (await isAncestor(s.dir, "main", "feature")) &&
          (await mergeCommitCount(s.dir, "main..feature")) === 0,
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "第一章：开端。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第一章：开端"]);

      await git(s, ["switch", "-c", "feature"]);
      await write(s, "chapter2.txt", "第二章：平行线。（feature 上创作）\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第二章：平行线"]);
      await write(s, "chapter3.txt", "第三章：交汇。（feature 上创作）\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第三章：交汇"]);

      await git(s, ["switch", "main"]);
      await write(s, "notes.txt", "主编的修订意见：开篇要更抓人。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "主编修订开篇"]);
    },
  },
  {
    id: "06",
    title: "第 6 关 · 撤销的艺术",
    subtitle: "restore / reset / 灾难自救",
    story:
      "事故现场！你把 draft.txt 改得一团糟（还没提交），更糟的是——刚才手滑把 secret.txt（里面有密码）提交进了仓库。" +
      "还好还没推给任何人。这一关练习灾难自救两件套：丢弃工作区误改 + 从历史里抹掉错误提交。",
    steps: [
      "git status — 盘点烂摊子：draft.txt 被误改，secret.txt 在最后一次提交里",
      "git restore draft.txt — 丢弃工作区里对草稿的误改",
      "git reset --soft HEAD~1 — 撤销最后一次提交（改动回到暂存区，不会丢）",
      "git rm -f secret.txt — 把密码文件从暂存区和磁盘一起删掉",
      'git commit -m "添加配置（这次没有密码）" — 干净地重新提交',
      "git log --oneline — 确认历史已经干净",
    ],
    hints: [
      "分工：restore 管「未提交的」，reset 管「已提交的」。restore 丢弃工作区改动；reset --soft 回退提交但保留改动。",
      "reset 三兄弟：--soft 改动留在暂存区，--mixed（默认）改动回到工作区，--hard 连改动一起扔——最危险，想三秒。",
      "为什么不用 revert？revert 是追加一个「反向提交」，适合已经推送的历史；这里的提交还没出门，直接改写历史更干净。",
    ],
    goals: [
      {
        label: "draft.txt 的误改已放弃（相对最新提交没有任何未提交改动）",
        check: async (s) => {
          const r = await runGit(s.dir, ["diff", "--name-only", "HEAD"]);
          return !r.stdout.split("\n").map((l) => l.trim()).includes("draft.txt");
        },
      },
      {
        label: "含密码的提交已从历史移除（历史只剩 2 个提交，secret.txt 不再被跟踪）",
        check: async (s) =>
          (await revListCount(s.dir, "HEAD")) === 2 &&
          !(await listTrackedFiles(s.dir)).includes("secret.txt"),
      },
      {
        label: "收拾完毕：工作区干干净净",
        check: cleanTree,
      },
    ],
    setup: async (s) => {
      await write(s, "app.js", "console.log('小镇正常运行');\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "提交功能代码"]);

      await write(s, "draft.txt", "第 2 章草稿：一切正常。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加草稿"]);

      await write(s, "secret.txt", "数据库密码 = 123456\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加配置"]);

      // 制造工作区误改
      await write(s, "draft.txt", "第 2 章草稿：;; 崩坏的半成品(((\n");
    },
  },
  {
    id: "07",
    title: "第 7 关 · 标签与版本",
    subtitle: "tag / 发布里程碑",
    story:
      "小镇的代码越来越稳，是时候学会给重要的时刻「盖章」了：发布 v1.0！" +
      "顺便给最早的第一个提交补一个 v0.1 纪念标签，让未来的自己能一键回到起点。",
    steps: [
      "git tag v1.0 — 给当前提交打个轻量标签",
      "git log --oneline — 找到最早的提交哈希（最下面那行）",
      'git tag -a v0.1 -m "小镇的第一个版本" <最早的提交哈希> — 附注标签，写给未来的自己',
      "git tag — 看看所有标签",
      "git show v1.0 — 检查标签盖在了哪里",
    ],
    hints: [
      "轻量标签像便利贴（只指向一个提交）；附注标签（-a）像正式证书，带说明、作者和日期。正式发布一般用附注标签。",
      "给历史提交打标签：把它的哈希写在命令最后，例如 git tag -a v0.1 -m \"说明\" 3f2a1bc",
      "注意：标签默认不跟着 git push 走，要单独推送：git push origin v1.0（或 git push --tags）。",
    ],
    goals: [
      {
        label: "存在名为 v1.0 的标签",
        check: async (s) => (await revParse(s.dir, "refs/tags/v1.0")) !== null,
      },
      {
        label: "v1.0 盖在了最新的提交上",
        check: async (s) => {
          const t = await tagCommit(s.dir, "v1.0");
          const h = await revParse(s.dir, "HEAD");
          return t !== null && t === h;
        },
      },
      {
        label: "v0.1 存在，且指向历史的起点（根提交）",
        check: async (s) => {
          const t = await tagCommit(s.dir, "v0.1");
          if (!t) return false;
          const r = await runGit(s.dir, ["rev-list", "--max-parents=0", "HEAD"]);
          if (r.code !== 0) return false;
          return r.stdout.split("\n").map((x) => x.trim()).filter(Boolean).includes(t);
        },
      },
    ],
    setup: async (s) => {
      await write(s, "app.txt", "小镇大厅 v0.1：能开门。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "初始版本：小镇大厅"]);
      await write(s, "feature.txt", "新增：天气系统。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加天气系统"]);
      await write(s, "fix.txt", "修复：雨天大门打不开。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "修复大门问题"]);
    },
  },
  {
    id: "08",
    title: "第 8 关 · 连接远程仓库",
    subtitle: "remote / pull / push",
    story:
      "恭喜，小镇项目上「远程」了！本关用本地一个裸仓库模拟 GitHub 远程 origin。" +
      "同事小 G 刚刚往远程推了一个提交，而你手里也有一份新功能要发布。" +
      "体会团队协作的日常节拍：pull → 提交 → push。",
    steps: [
      "git pull — 把远程上同事的新提交拉下来（pull = fetch + merge）",
      "echo 我的新功能 > feature.txt — 开发你的新功能",
      'git add feature.txt && git commit -m "我的新功能"',
      "git push — 把你的成果发布到远程",
      "git log --oneline --all — 注意看 origin/main 这面「远程的镜子」",
    ],
    hints: [
      "origin/main 不是远程仓库本身，而是「远程仓库在你本地的镜子」——只有在 pull / push 时它才会更新。",
      "push 被拒绝（non-fast-forward）？说明远程上有你没有的提交：先 git pull 把别人的成果接进来，再 push。",
      "团队协作黄金节拍：开工先 pull，完工就 push，冲突早解决。",
    ],
    goals: [
      {
        label: "同事的提交已同步进你的 main",
        check: (s) => hasCommitWithSubject(s.dir, "main", "同事：添加服务器代码"),
      },
      {
        label: "你的新提交已推上远程（main 与 origin/main 完全一致，包含双方成果）",
        check: async (s) => {
          const local = await revParse(s.dir, "main");
          const remote = await revParse(s.dir, "refs/remotes/origin/main");
          if (local === null || local !== remote) return false;
          return (
            (await hasCommitWithSubject(s.dir, "main", "我的新功能")) &&
            (await hasCommitWithSubject(s.dir, "main", "同事：添加服务器代码"))
          );
        },
      },
      {
        label: "远程仓库的文件树里能看到 feature.txt",
        check: async (s) => (await lsTree(s.dir, "origin/main")).includes("feature.txt"),
      },
    ],
    setup: async (s) => {
      const parent = path.dirname(s.dir);
      const bare = path.join(parent, `level-${s.levelId}-remote.git`);
      const colleague = path.join(parent, `level-${s.levelId}-colleague`);

      await git(s, ["init"]);
      await write(s, "README.md", "# 像素小镇 · 团队协作版\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "项目初始化"]);

      // 建立模拟远程（裸仓库）并推送 main
      await git(s, ["init", "--bare", bare]);
      await git(s, ["remote", "add", "origin", bare]);
      await git(s, ["push", "-u", "origin", "main"]);

      // 同事克隆仓库、开发并推送
      await git(s, ["clone", bare, colleague]);
      await fs.writeFile(
        path.join(colleague, "server.py"),
        "# 小镇服务器\nprint('hello, pixel town')\n",
        "utf8"
      );
      await gitIn(colleague, ["add", "."]);
      await gitIn(colleague, ["commit", "-m", "同事：添加服务器代码"]);
      await gitIn(colleague, ["push", "origin", "main"]);
    },
  },
  {
    id: "09",
    title: "第 9 关 · 随身行李：stash",
    subtitle: "stash / 未完成改动的进退之道",
    story:
      "紧急任务！你在 feature 分支上把剧情改到一半（还没法提交），线上却出了 bug 要马上切回 main 修。" +
      "半成品既不能提交、又不能丢——stash 就是你的随身行李箱：把改动收起来，办完事回来再取。",
    steps: [
      "git status — 看看随身带着的半成品（story.txt 被改了一半）",
      "git stash — 把改动收进行李箱（工作区瞬间变干净）",
      "git switch main — 回主线修线上 bug",
      'echo 修复补丁 > hotfix.txt && git add hotfix.txt && git commit -m "修复线上bug"',
      "git switch feature — 回到自己的分支",
      "git stash pop — 取出行李，半成品改动原样回来了",
      "git stash list — 确认行李箱已经清空",
    ],
    hints: [
      "stash 之后工作区会变干净——因为改动被存进了栈里，随时用 git stash list 查看攒了几个行李。",
      "取行李用 git stash pop：取出并从栈里删掉。想保留备份就用 git stash apply（取出但不删）。",
      "注意：git stash 默认不收「未跟踪」的新文件，要连它们一起收得用 git stash -u。",
    ],
    goals: [
      {
        label: "线上 bug 已修：hotfix.txt 已提交进 main",
        check: async (s) => (await lsTree(s.dir, "main")).includes("hotfix.txt"),
      },
      {
        label: "带着修好的 bug 回到 feature 分支继续创作",
        check: async (s) => {
          if (!(await lsTree(s.dir, "main")).includes("hotfix.txt")) return false;
          const r = await runGit(s.dir, ["symbolic-ref", "-q", "--short", "HEAD"]);
          return r.code === 0 && r.stdout.trim() === "feature";
        },
      },
      {
        label: "半成品改动原样回到工作区（stash pop 成功，story.txt 的修改恢复了）",
        check: async (s) => {
          if (!(await lsTree(s.dir, "main")).includes("hotfix.txt")) return false;
          try {
            const content = await fs.readFile(path.join(s.dir, "story.txt"), "utf8");
            if (!content.includes("写到一半")) return false;
            return (await gitStatus(s.dir)).some((f) => f.path === "story.txt" && f.y === "M");
          } catch {
            return false;
          }
        },
      },
      {
        label: "行李箱清空，轻装继续（stash 列表为空）",
        check: async (s) => {
          if (!(await lsTree(s.dir, "main")).includes("hotfix.txt")) return false;
          const r = await runGit(s.dir, ["stash", "list"]);
          return r.code === 0 && r.stdout.trim() === "";
        },
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "第一章：开端。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第一章：开端"]);
      await write(s, "notes.txt", "日常笔记。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "日常笔记"]);

      await git(s, ["switch", "-c", "feature"]);
      // 制造未提交的半成品
      await write(s, "story.txt", "第一章：开端。\n第二章：写到一半的剧情(((\n");
    },
  },
];

/** 二期路线图（仅展示，未开放） */
export const ROADMAP = [];

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
