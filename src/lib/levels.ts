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
import { getHistory } from "./history";
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
        label: "站在 main 分支上完成了合并",
        check: async (s) => {
          if (!(await isAncestor(s.dir, "feature", "main"))) return false;
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
        check: async (s) =>
          (await isAncestor(s.dir, "feature", "main")) && (await cleanTree(s)),
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
        check: async (s) =>
          (await mergeCommitCount(s.dir, "main")) >= 1 &&
          (await fileHasNoConflictMarkers(s, "story.txt")),
      },
      {
        label: "冲突解决已提交，工作区干净",
        check: async (s) =>
          (await mergeCommitCount(s.dir, "main")) >= 1 && (await cleanTree(s)),
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
  {
    id: "10",
    title: "第 10 关 · 头飞了：detached HEAD",
    subtitle: "checkout 历史提交 / 游离头指针",
    story:
      "时间机器启动！你想回到过去看看小镇最早的样子。用 checkout 直接跳到某个历史提交上时，Git 会警告你「detached HEAD」——头飞了。" +
      "别慌，这一关教你安全地观光历史，还能顺手把过去锚定成一个新分支。",
    steps: [
      "git log --oneline — 找到最早的提交哈希（最下面那行）",
      "git checkout <最早的提交哈希> — 时光倒流（注意 detached HEAD 提示）",
      "ls 或 cat story.txt — 看看旧时光里的文件长什么样",
      "git switch -c time-travel — 把这个历史时刻锚定成新分支",
      "git switch main — 平安回到现在",
      "git log --oneline --all — 注意 time-travel 停在过去，main 继续向前",
    ],
    hints: [
      "detached HEAD = 你站在一个提交上，而不是某个分支上。此时产生的提交不属于任何分支，切走就可能丢。",
      "想把过去留住？像本关这样：git switch -c 新分支名，从当前所在的位置长出一条新分支。",
      "git switch - 可以瞬间回到你上一次所在的分支，很省心。",
    ],
    goals: [
      {
        label: "成功把历史时刻锚定为 time-travel 分支（指向 main 的祖先提交）",
        check: async (s) => {
          if (!(await branchExists(s.dir, "time-travel"))) return false;
          const tt = await revParse(s.dir, "time-travel");
          const main = await revParse(s.dir, "main");
          if (!tt || !main || tt === main) return false;
          return isAncestor(s.dir, "time-travel", "main");
        },
      },
      {
        label: "观光结束，HEAD 回到 main（不再分离）",
        check: async (s) => {
          if (!(await branchExists(s.dir, "time-travel"))) return false;
          const r = await runGit(s.dir, ["symbolic-ref", "-q", "--short", "HEAD"]);
          return r.code === 0 && r.stdout.trim() === "main";
        },
      },
      {
        label: "主线历史完好无损（main 上仍是原来的 3 个提交）",
        check: async (s) => {
          if (!(await branchExists(s.dir, "time-travel"))) return false;
          return (await revListCount(s.dir, "main")) === 3;
        },
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "第一章：小镇的诞生。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第一章：小镇的诞生"]);
      await write(s, "story.txt", "第一章：小镇的诞生。\n第二章：第一栋房子。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第二章：第一栋房子"]);
      await write(s, "story.txt", "第一章：小镇的诞生。\n第二章：第一栋房子。\n第三章：第一位居民。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第三章：第一位居民"]);
    },
  },
  {
    id: "11",
    title: "第 11 关 · 历史考古",
    subtitle: "log -p / diff / show 定位问题",
    story:
      "事故调查：小镇之歌 poem.txt 的第一句被人改出了错别字，但没人承认是哪次提交干的。" +
      "拿起考古工具（git log -p / git diff / git show），找出「真凶提交」，修好它，并留下修复记录。",
    steps: [
      "git log --oneline — 纵览全部提交",
      "git log -p poem.txt — 逐条查看这个文件的每一处变迁（考古核心技能！）",
      "定位改坏第一句的那次提交（也可以用 git diff HEAD~2 HEAD~1 对比某两步）",
      "把 poem.txt 的第一句改回「小镇的夜晚星光闪耀。」（保留后两句，可用文件编辑器或 echo 覆盖）",
      'git add poem.txt && git commit -m "修复歌词错别字"',
    ],
    hints: [
      "git log -p 文件名 是考古利器：按提交顺序展示这个文件的每一处改动，谁的锅一目了然。",
      "只想对比相邻两次提交？git diff HEAD~2 HEAD~1 会显示这两个快照之间的差异。",
      "git show 提交哈希 可以查看任意一次提交的完整改动详情。",
    ],
    goals: [
      {
        label: "至少做过一次考古对比（git log -p / git diff / git show）",
        check: async (s) =>
          getHistory(s.sessionId).some((h) => /^git (diff|log -p|show)\b/.test(h.cmd)),
      },
      {
        label: "错别字已修复：第一句恢复为「小镇的夜晚星光闪耀。」",
        check: async (s) => {
          try {
            const content = await fs.readFile(path.join(s.dir, "poem.txt"), "utf8");
            return content.includes("小镇的夜晚星光闪耀。") && !content.includes("小珍");
          } catch {
            return false;
          }
        },
      },
      {
        label: "修复已提交：历史变成 5 个提交，工作区干净",
        check: async (s) => (await revListCount(s.dir, "HEAD")) === 5 && (await cleanTree(s)),
      },
    ],
    setup: async (s) => {
      await write(s, "poem.txt", "小镇的夜晚星光闪耀。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "创作小镇之歌"]);
      await write(s, "poem.txt", "小镇的夜晚星光闪耀。\n湖面倒映着灯火。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "补上第二句"]);
      // 伪装成正常提交的"破坏"
      await write(s, "poem.txt", "小珍的夜晚星光闪耀。\n湖面倒映着灯火。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "统一用词"]);
      await write(s, "poem.txt", "小珍的夜晚星光闪耀。\n湖面倒映着灯火。\n孩子们唱着歌回家。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加结尾"]);
    },
  },
  {
    id: "12",
    title: "第 12 关 · 提交打磨：amend",
    subtitle: "commit --amend / 补救最后一次提交",
    story:
      "刚才那次提交手滑了：说明书文件忘了加进去，提交信息也写错了。" +
      "好消息：还没 push 出门，一切都来得及。amend 就是「重写最后一次提交」的橡皮擦。",
    steps: [
      "git status — 发现 feature.md 还躺在工作区没被提交",
      "git add feature.md",
      "git commit --amend --no-edit — 把它悄悄塞进上一次提交（不产生新提交）",
      "git log --oneline — 确认还是 2 个提交，没有多出来",
      'git commit --amend -m "添加功能说明书" — 顺手把提交信息也改对',
    ],
    hints: [
      "amend = 丢掉上一次提交，用一个全新的提交替代它（内容 + 信息都能改）。只对「最后一次提交」生效。",
      "--no-edit 表示沿用原提交信息；想改信息就写 -m。两个动作可以合并成一步：git commit --amend -m \"新信息\"。",
      "和 L6 一样：已 push 的提交不要 amend，历史会分叉。没出门的提交随便改。",
    ],
    goals: [
      {
        label: "feature.md 已补进仓库，且没有多出新提交（历史仍是 2 个提交）",
        check: async (s) =>
          (await listTrackedFiles(s.dir)).includes("feature.md") &&
          (await revListCount(s.dir, "HEAD")) === 2,
      },
      {
        label: "提交信息已改为包含「说明书」",
        check: async (s) => {
          if ((await revListCount(s.dir, "HEAD")) !== 2) return false;
          const r = await runGit(s.dir, ["log", "-1", "--format=%s"]);
          return r.code === 0 && r.stdout.trim().includes("说明书");
        },
      },
      {
        label: "工作区干干净净",
        check: cleanTree,
      },
    ],
    setup: async (s) => {
      await write(s, "app.txt", "小镇应用 v1。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "初始版本"]);
      await write(s, "docs.txt", "功能简介。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加功能说明"]);
      // 故意漏提交的文件
      await write(s, "feature.md", "# 功能说明书\n\n1. 天气系统\n2. 留言板\n");
    },
  },
  {
    id: "13",
    title: "第 13 关 · 分支清理",
    subtitle: "branch -d / -D / 保鲜的仓库",
    story:
      "上一版的合并工作完成了，仓库里却躺着几条用完的旧分支——像散落一地的工具。" +
      "这一关学习分支的「善后」：已合并的温柔删（-d），没合并的要三思（Git 会拦你，-D 才能强删）。",
    steps: [
      "git switch main",
      "git merge feature — 先把 feature 的成果收进 main",
      "git branch -d feature — 已合并的分支可以安全删除（内容都在 main 里）",
      "git branch -d experiment — 试试删未合并的分支，看 Git 怎么拦你",
      "确认 experiment 的实验真的不要了 → git branch -D experiment 强制删除",
      "git branch — 最后清点一下仓库里的分支",
    ],
    hints: [
      "-d 是安全删除：只删「已经合并」的分支，防手滑。Git 拦住你时，先想清楚那条分支上有没有没合并的宝贝。",
      "-D 是强制删除，删掉的分支指针就没了（提交对象还会活一阵子，但很难找）。强删前深呼吸一次。",
      "合并后删分支不会丢提交——分支只是个指向提交的路标，路标撤了，路（提交）还在 main 的历史里。",
    ],
    goals: [
      {
        label: "feature 的成果已并入 main，且该分支已被清理",
        check: async (s) =>
          (await hasCommitWithSubject(s.dir, "main", "feature：新剧情")) &&
          !(await branchExists(s.dir, "feature")),
      },
      {
        label: "未合并的 experiment 分支也已处理（删除）",
        check: async (s) => !(await branchExists(s.dir, "experiment")),
      },
      {
        label: "main 上保留了合并记录（出现合并提交）",
        check: async (s) => (await mergeCommitCount(s.dir, "main")) >= 1,
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "第一章。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第一章"]);

      await git(s, ["switch", "-c", "feature"]);
      await write(s, "feature.txt", "feature 分支的成果。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "feature：新剧情"]);

      await git(s, ["switch", "main"]);
      await write(s, "notes.txt", "主线的推进。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "主线推进"]);

      await git(s, ["switch", "-c", "experiment"]);
      await write(s, "实验草稿.txt", "大胆但未完成的实验。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "大胆实验（未完成）"]);

      await git(s, ["switch", "main"]);
    },
  },
  {
    id: "14",
    title: "第 14 关 · 被拒绝的 push",
    subtitle: "non-fast-forward / pull 再 push",
    story:
      "你在飞机上离线写完了一个提交，落地后兴冲冲 git push——被拒绝了！" +
      "远程在你不知情的时候多了同事的紧急修复。这就是传说中的 non-fast-forward：学会礼貌地化解它。",
    steps: [
      "git push — 看看被拒绝时的报错（重点读 non-fast-forward 那段）",
      "git pull — 把远程上同事的提交接下来（会自动生成一个合并提交）",
      "git log --oneline --graph — 确认两边的历史都完整保留",
      "git push — 这次顺利推上去",
    ],
    hints: [
      "被拒绝不是坏事：Git 在保护远程，防止你不知不觉覆盖别人的成果。",
      "化解套路固定：先 pull（把远程新历史接进来）→ 有冲突就解决 → 再 push。永远不要用 -f 强推来绕过它。",
      "git pull 会用合并提交把两条线缝起来；如果更喜欢线性历史，可以 git pull --rebase（变基你的本地提交）。",
    ],
    goals: [
      {
        label: "本地与远程重新完全一致（main 与 origin/main 指向同一提交）",
        check: async (s) => {
          const local = await revParse(s.dir, "main");
          const remote = await revParse(s.dir, "refs/remotes/origin/main");
          return local !== null && local === remote;
        },
      },
      {
        label: "双方成果都在：同事的紧急修复和你的本地提交都进了 main",
        check: async (s) =>
          (await hasCommitWithSubject(s.dir, "main", "同事：紧急修复")) &&
          (await hasCommitWithSubject(s.dir, "main", "我的本地提交")),
      },
      {
        label: "同步完成后工作区干净",
        check: async (s) => {
          const local = await revParse(s.dir, "main");
          const remote = await revParse(s.dir, "refs/remotes/origin/main");
          if (local === null || local !== remote) return false;
          return cleanTree(s);
        },
      },
    ],
    setup: async (s) => {
      const parent = path.dirname(s.dir);
      const bare = path.join(parent, `level-${s.levelId}-remote.git`);
      const colleague = path.join(parent, `level-${s.levelId}-colleague`);

      await git(s, ["init"]);
      await write(s, "README.md", "# 小镇项目 · 协作演习\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "项目初始化"]);
      await git(s, ["init", "--bare", bare]);
      await git(s, ["remote", "add", "origin", bare]);
      await git(s, ["push", "-u", "origin", "main"]);

      // 同事抢先推了一个提交
      await git(s, ["clone", bare, colleague]);
      await fs.writeFile(path.join(colleague, "urgent.txt"), "紧急修复：大门漏风。\n", "utf8");
      await gitIn(colleague, ["add", "."]);
      await gitIn(colleague, ["commit", "-m", "同事：紧急修复"]);
      await gitIn(colleague, ["push", "origin", "main"]);

      // 你在"飞机上"离线写了一个提交（本地领先 1，远程也领先 1 → 分叉）
      await write(s, "local.txt", "飞机上写的本地成果。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "我的本地提交"]);
    },
  },
  {
    id: "15",
    title: "第 15 关 · 综合大演练：v2.0 发布日",
    subtitle: "pull / branch / merge / tag / push 全流程",
    story:
      "毕业考试！今天是小镇 v2.0 的发布日。你需要像真正的团队开发者一样完成一整套日常操作：" +
      "同步远程 → 开分支开发两个功能 → 合并回主线 → 打上版本标签 → 发布。所有学过的招式都用上了。",
    steps: [
      "git pull — 先同步远程上同事的新提交",
      "git switch -c feature — 为 v2.0 开一个功能分支",
      'echo 留言板 > feat1.txt && git add . && git commit -m "功能一：留言板"',
      'echo 暗黑模式 > feat2.txt && git add . && git commit -m "功能二：暗黑模式"',
      "git switch main && git merge feature",
      "git push — 先把主分支推上远程",
      'git tag v2.0 -m "小镇 v2.0 正式发布"',
      "git push --tags — 标签默认不随 push 走，要单独推！",
    ],
    hints: [
      "这一关没有新知识，是把 pull / branch / merge / tag / push 串成肌肉记忆。迷路就回到「建议路径」。",
      "git push 默认不推标签！git push --tags 一次推全部，或者 git push origin v2.0 只推一个。但也别忘了先推分支本身。",
      "发布前用 git log --oneline --graph 确认：同事的提交、你的两个功能、合并提交，一个都不能少。",
    ],
    goals: [
      {
        label: "远程上同事的提交已同步进本地 main",
        check: (s) => hasCommitWithSubject(s.dir, "main", "同事：更新导航栏"),
      },
      {
        label: "两个功能提交都已进入 main",
        check: async (s) =>
          (await hasCommitWithSubject(s.dir, "main", "功能一：留言板")) &&
          (await hasCommitWithSubject(s.dir, "main", "功能二：暗黑模式")),
      },
      {
        label: "v2.0 标签盖在合并后的最新提交上",
        check: async (s) => {
          const t = await tagCommit(s.dir, "v2.0");
          const h = await revParse(s.dir, "main");
          return t !== null && t === h;
        },
      },
      {
        label: "发布完成：远程 main 与标签 v2.0 都已更新",
        check: async (s) => {
          const local = await revParse(s.dir, "main");
          const remote = await revParse(s.dir, "refs/remotes/origin/main");
          if (local === null || local !== remote) return false;
          const r = await runGit(s.dir, ["ls-remote", "--tags", "origin"]);
          return r.code === 0 && r.stdout.includes("refs/tags/v2.0");
        },
      },
    ],
    setup: async (s) => {
      const parent = path.dirname(s.dir);
      const bare = path.join(parent, `level-${s.levelId}-remote.git`);
      const colleague = path.join(parent, `level-${s.levelId}-colleague`);

      await git(s, ["init"]);
      await write(s, "app.txt", "小镇应用 v1。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "初始版本"]);
      await git(s, ["init", "--bare", bare]);
      await git(s, ["remote", "add", "origin", bare]);
      await git(s, ["push", "-u", "origin", "main"]);

      // 同事往远程推了 v2.0 依赖的准备工作
      await git(s, ["clone", bare, colleague]);
      await fs.writeFile(path.join(colleague, "nav.txt"), "导航栏升级方案。\n", "utf8");
      await gitIn(colleague, ["add", "."]);
      await gitIn(colleague, ["commit", "-m", "同事：更新导航栏"]);
      await gitIn(colleague, ["push", "origin", "main"]);
    },
  },
  {
    id: "16",
    title: "第 16 关 · 摘樱桃：cherry-pick",
    subtitle: "只摘需要的那个提交",
    story:
      "feature 分支上有一堆提交：一次宝贵的重要修复，混着一些乱七八糟的实验。" +
      "全合并进来？不行，实验还没好。这时候就该请出 cherry-pick——像摘樱桃一样，只摘下你要的那一颗。",
    steps: [
      "git log --oneline feature — 看看 feature 上都有什么",
      "git switch main — 摘到的樱桃要放在 main 上",
      "git cherry-pick <重要修复的提交哈希> — 只摘这一个提交",
      "git log --oneline --graph — 注意：摘过来的是内容相同、哈希不同的新提交",
      "git status — 确认实验性的乱改没有混进来",
    ],
    hints: [
      "cherry-pick 的对象是「提交」而不是文件——它会把那次提交的完整改动复制到当前分支。",
      "找哈希用 git log --oneline feature，摘樱桃时人在哪个分支，樱桃就落在哪个分支。",
      "摘完不会删掉 feature 上的原提交（只是复制）。原分支等实验做完再另行处理。",
    ],
    goals: [
      {
        label: "重要修复已摘到 main（fix.txt 出现在 main 的文件树里）",
        check: async (s) => (await lsTree(s.dir, "main")).includes("fix.txt"),
      },
      {
        label: "实验性的乱改没有混进来（weird.txt 不在 main 上）",
        check: async (s) => {
          const tree = await lsTree(s.dir, "main");
          return tree.includes("fix.txt") && !tree.includes("weird.txt");
        },
      },
      {
        label: "只摘了一颗樱桃（没有产生合并提交），工作区干净",
        check: async (s) =>
          (await lsTree(s.dir, "main")).includes("fix.txt") &&
          (await mergeCommitCount(s.dir, "main")) === 0 &&
          (await cleanTree(s)),
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "第一章。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "第一章"]);
      await write(s, "notes.txt", "主线笔记。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "主线笔记"]);

      await git(s, ["switch", "-c", "feature"]);
      await write(s, "fix.txt", "关键修复：大门漏风补好了。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "feature：重要修复"]);
      await write(s, "weird.txt", "乱七八糟的实验中间产物。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "feature：实验性乱改"]);

      await git(s, ["switch", "main"]);
    },
  },
  {
    id: "17",
    title: "第 17 关 · 二分捉虫：bisect",
    subtitle: "自动定位引入 bug 的提交",
    story:
      "计算器突然出 BUG 了！八次提交里藏着一次手滑，逐个翻太慢。" +
      "git bisect 会自动二分搜索：你只需要告诉它每个中间版本是「好」还是「坏」，几步就能锁定真凶。",
    steps: [
      "git log --oneline — 记下最早提交的哈希",
      "git bisect start — 开始捉虫",
      "git bisect bad HEAD — 标记当前版本是坏的",
      "git bisect good <最早提交哈希> — 标记最早版本是好的，Git 自动跳到中间某次提交",
      "cat calc.txt — 测试当前版本：看到 BUG 标记就 git bisect bad，没有就 git bisect good",
      "重复几步，Git 会宣布「X is the first bad commit」",
      "git bisect reset — 结束捉虫，回到 main",
      "修好 calc.txt（删掉 BUG 行，可用文件编辑器），git add + git commit",
    ],
    hints: [
      "bisect 的原理是二分法：8 次提交只要 3 步左右就能锁定。你只负责「验货」，其余全自动。",
      "每一步只做一件事：看 calc.txt 有没有 BUG 行，然后 bad 或 good。不确定时再看一眼。",
      "捉虫结束后一定要 git bisect reset，否则你会一直停在分离 HEAD 状态。",
    ],
    goals: [
      {
        label: "BUG 已修复：calc.txt 里不再有 BUG 行",
        check: async (s) => {
          try {
            const content = await fs.readFile(path.join(s.dir, "calc.txt"), "utf8");
            return !content.includes("BUG");
          } catch {
            return false;
          }
        },
      },
      {
        label: "修复已提交且收工：回到 main、历史 9 个提交、没有残留捉虫会话",
        check: async (s) => {
          const r = await runGit(s.dir, ["symbolic-ref", "-q", "--short", "HEAD"]);
          if (r.code !== 0 || r.stdout.trim() !== "main") return false;
          if ((await revListCount(s.dir, "HEAD")) !== 9) return false;
          try {
            await fs.stat(path.join(s.dir, ".git", "BISECT_LOG"));
            return false; // 还有残留的 bisect 会话
          } catch {
            return true;
          }
        },
      },
      {
        label: "你是真的用 bisect 捉的虫（历史命令里有 git bisect）",
        check: async (s) => getHistory(s.sessionId).some((h) => /^git bisect\b/.test(h.cmd)),
      },
    ],
    setup: async (s) => {
      const lines: string[] = [];
      await git(s, ["init"]);
      for (let i = 1; i <= 8; i++) {
        lines.push(`第${i}步计算完成。`);
        if (i === 6) lines.push("BUG: 除零错误！");
        await write(s, "calc.txt", lines.join("\n") + "\n");
        await git(s, ["add", "."]);
        await git(s, ["commit", "-m", `提交 ${i}`]);
      }
    },
  },
  {
    id: "18",
    title: "第 18 关 · 时光邮差：reflog",
    subtitle: "找回以为永远丢失的提交",
    story:
      "惨案！一次手滑的 git reset --hard 把「重要成果」从历史上抹掉了，git log 里怎么也找不到。" +
      "别急——只要提交过，它就在 reflog 的漂流瓶里。这封「时光邮差」的信，现在去取回来。",
    steps: [
      "git log --oneline — 确认：重要成果真的不见了",
      "git reflog — 翻看 HEAD 的每一次移动记录（每条前面是哈希）",
      '找到写着「重要成果：藏宝图」的那条，抄下它的哈希',
      "git reset --hard <那个哈希> — 让 main 重新指向它",
      "git log --oneline — 藏宝图回来了！",
    ],
    hints: [
      "reflog 记录的是「HEAD 走过的每一步」，reset、checkout、commit 全都逃不过它的眼睛——这是 Git 的后悔药底线。",
      "reflog 里的记录默认保留 90 天，所以「丢了」的提交基本都能捞回来。",
      "找回的方式不止 reset --hard 一种：git branch rescued <哈希> 再合并，更温和。",
    ],
    goals: [
      {
        label: "丢失的提交找回来了（treasure.txt 重新出现在 main）",
        check: async (s) => (await lsTree(s.dir, "main")).includes("treasure.txt"),
      },
      {
        label: "你是真的用了时光邮差（历史命令里有 git reflog）",
        check: async (s) => getHistory(s.sessionId).some((h) => /^git reflog\b/.test(h.cmd)),
      },
      {
        label: "main 历史恢复完整：3 个提交都在，工作区干净",
        check: async (s) => (await revListCount(s.dir, "HEAD")) === 3 && (await cleanTree(s)),
      },
    ],
    setup: async (s) => {
      await write(s, "story.txt", "冒险开始。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "初始版本"]);
      await write(s, "notes.txt", "日常记录。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "日常更新"]);
      await write(s, "treasure.txt", "藏宝图：X 标记宝藏的位置。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "重要成果：藏宝图"]);
      // 模拟手滑事故
      await git(s, ["reset", "--hard", "HEAD~1"]);
    },
  },
  {
    id: "19",
    title: "第 19 关 · 看不见的文件：.gitignore",
    subtitle: "忽略规则 / 停止跟踪",
    story:
      "仓库被塞得乱七八糟：调试日志、临时目录、密码配置文件全被 git status 盯上了，" +
      "连构建产物都被误跟踪了。用 .gitignore 给仓库立规矩：什么该管，什么别管。",
    steps: [
      "git status — 看看当前有哪些「不速之客」（debug.log、temp/、secrets.env）",
      'echo "*.log" > .gitignore — 创建忽略清单',
      'echo "temp/" >> .gitignore 和 echo "*.env" >> .gitignore — 补上另外两条规则',
      "git add .gitignore && git commit -m \"添加忽略规则\" — 规则本身也要提交",
      "git rm --cached build/output.txt — 让误跟踪的构建产物脱离 Git（文件还在磁盘上）",
      'echo "build/" >> .gitignore — 把 build/ 也写进忽略规则，不然它马上又回来了',
      'git add .gitignore && git commit -m "停止跟踪构建产物" && git status — 现在清爽了',
    ],
    hints: [
      "规则一行一条：*.log 忽略所有日志、temp/ 忽略目录、!keep.txt 感叹号表示例外。",
      ".gitignore 只对「未跟踪」的文件生效——已经提交过的文件要先 git rm --cached 请出仓库。",
      "--cached 的意思是「只从 Git 里删，磁盘上的文件留着」——构建产物需要留在本地。",
    ],
    goals: [
      {
        label: ".gitignore 已创建并提交",
        check: async (s) => (await listTrackedFiles(s.dir)).includes(".gitignore"),
      },
      {
        label: "垃圾文件不再被 Git 盯上（debug.log / temp / secrets.env 从 status 消失）",
        check: async (s) => {
          if (!(await listTrackedFiles(s.dir)).includes(".gitignore")) return false;
          const paths = new Set((await gitStatus(s.dir)).map((f) => f.path));
          return !paths.has("debug.log") && !paths.has("secrets.env") && !paths.has("temp") && ![...paths].some((p) => p.startsWith("temp/"));
        },
      },
      {
        label: "build/output.txt 已停止跟踪，但文件还留在磁盘上",
        check: async (s) => {
          if (!(await listTrackedFiles(s.dir)).includes(".gitignore")) return false;
          const tracked = await listTrackedFiles(s.dir);
          try {
            await fs.stat(path.join(s.dir, "build", "output.txt"));
            return !tracked.includes("build/output.txt");
          } catch {
            return false;
          }
        },
      },
      {
        label: "收拾完毕：工作区干干净净",
        check: cleanTree,
      },
    ],
    setup: async (s) => {
      await write(s, "app.txt", "小镇应用。\n");
      await git(s, ["init"]);
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "初始版本"]);
      // 误跟踪的构建产物
      await write(s, "build/output.txt", "构建输出（每次都会变）。\n");
      await git(s, ["add", "."]);
      await git(s, ["commit", "-m", "添加构建产物（失误）"]);
      // 未跟踪的垃圾
      await write(s, "debug.log", "DEBUG 12:00 灵异事件\n");
      await write(s, "temp/t1.txt", "临时文件。\n");
      await write(s, "secrets.env", "PASSWORD=123456\n");
    },
  },
];

/** 二期路线图（仅展示，未开放） */
export const ROADMAP = [];

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
