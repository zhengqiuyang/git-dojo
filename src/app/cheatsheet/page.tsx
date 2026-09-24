import Link from "next/link";
import type { Metadata } from "next";
import CopyButton from "@/components/CopyButton";

export const metadata: Metadata = {
  title: "场景速查手册 — Git 练功房",
};

interface Scenario {
  icon: string;
  title: string;
  scene: string;
  commands: { code: string; note?: string }[];
  warn?: string;
}

const SCENARIOS: Scenario[] = [
  {
    icon: "✏️",
    title: "最后一次提交的信息写错了",
    scene: "刚 commit 完就发现提交信息有错别字，还没 push 给别人。",
    commands: [
      { code: 'git commit --amend -m "正确的提交信息"', note: "把上一次提交整体替换掉" },
    ],
    warn: "amend 会生成一个全新的提交替换旧的。如果已经 push 出去，慎用（需要强推，会影响协作者）。",
  },
  {
    icon: "🚿",
    title: "放弃工作区里没提交的修改",
    scene: "把文件改乱了，想恢复到上次提交的样子，改动还没 add / 没提交。",
    commands: [
      { code: "git restore <文件>", note: "只恢复某个文件" },
      { code: "git restore .", note: "恢复当前目录下所有被改动的文件" },
      { code: "git checkout -- <文件>", note: "老版本 Git 的等价写法" },
    ],
    warn: "被放弃的修改找不回来！执行前想清楚。",
  },
  {
    icon: "📦",
    title: "add 多了，想把文件从暂存区取出来",
    scene: "git add . 的时候把不想提交的文件也加进去了。",
    commands: [
      { code: "git restore --staged <文件>", note: "从暂存区取出，文件的修改还在" },
      { code: "git reset HEAD <文件>", note: "老版本 Git 的等价写法" },
    ],
  },
  {
    icon: "⏪",
    title: "想撤销上一次提交",
    scene: "commit 完发现改错了内容，或者压根不该提交这个。",
    commands: [
      { code: "git reset --soft HEAD~1", note: "撤销提交，改动保留在暂存区" },
      { code: "git reset --mixed HEAD~1", note: "撤销提交，改动留在工作区（默认）" },
      { code: "git reset --hard HEAD~1", note: "撤销提交，改动全部丢弃，回到上次提交" },
    ],
    warn: "--hard 会销毁未提交的改动，是最危险的命令之一。--soft 最安全，推荐先用它。",
  },
  {
    icon: "🛸",
    title: "已经 push 的提交需要撤销",
    scene: "提交已经推送到远程，别人可能已经拉取了，不能用 reset 改写历史。",
    commands: [
      { code: "git revert <提交哈希>", note: "生成一个「反向提交」抵消它" },
      { code: "git revert HEAD", note: "撤销最近一次提交" },
    ],
    warn: "revert 不改写历史，而是追加一条新提交，因此对已推送的提交是安全的。",
  },
  {
    icon: "⚔️",
    title: "合并冲突了怎么办",
    scene: "git merge 时两个人改了同一个文件的同一处，Git 停下来等你裁决。",
    commands: [
      { code: "git status", note: "看哪些文件在冲突" },
      { code: "# 打开文件，删掉 <<<<<<< ======= >>>>>>> 标记，保留最终内容", note: "<<<<<<< HEAD 是你的，另一边是对方的" },
      { code: "git add <解决好的文件>", note: "标记冲突已解决" },
      { code: 'git commit -m "解决合并冲突"', note: "完成合并" },
      { code: "git merge --abort", note: "不想合了，整体撤退重来" },
    ],
  },
  {
    icon: "🙈",
    title: "有些文件不想被 Git 管理",
    scene: "日志、临时文件、node_modules、密码配置……不该进仓库。",
    commands: [
      { code: "echo node_modules/ > .gitignore", note: "创建忽略清单" },
      { code: "# .gitignore 里每行一个规则：*.log 忽略所有日志；build/ 忽略目录；!keep.txt 感叹号是例外", note: "" },
      { code: "git rm --cached <文件>", note: "已经被跟踪的文件，停止跟踪但保留在磁盘上" },
    ],
    warn: ".gitignore 只对「未跟踪」的文件生效，已提交过的文件要先 git rm --cached。",
  },
  {
    icon: "🧭",
    title: "历史看不懂了，想看清全貌",
    scene: "分支多了、合并多了，普通的 git log 已经不够直观。",
    commands: [
      { code: "git log --oneline --graph --all", note: "一行一提交，画出所有分支的拓扑图" },
      { code: "git log -p <文件>", note: "看某个文件每次提交的具体改动" },
      { code: "git show <提交哈希>", note: "看某一次提交的详情" },
    ],
  },
  {
    icon: "🧳",
    title: "手头改动没做完，但必须先切分支",
    scene: "正在改一半，线上出了 bug 要马上修，又不想提交半成品。",
    commands: [
      { code: "git stash", note: "把当前改动收进「行李箱」，工作区变干净" },
      { code: "git switch 其他分支", note: "放心切换" },
      { code: "git stash pop", note: "回来后把行李取出来" },
      { code: "git stash list", note: "看看攒了几个行李箱" },
    ],
  },
  {
    icon: "👻",
    title: "进入了 detached HEAD 状态",
    scene: "git checkout 某个提交哈希后，Git 提示 You are in 'detached HEAD' state——头飞了？",
    commands: [
      { code: "git switch -", note: "回到上一个分支" },
      { code: "git switch main", note: "回到指定分支" },
      { code: "git switch -c 新分支名", note: "如果想在那个提交基础上继续开发，就从这里建分支" },
    ],
    warn: "detached HEAD 下做的提交不挂在任何分支上，切走后容易「丢失」，先建分支再动手。",
  },
];

export default function CheatsheetPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥋</span>
            <div>
              <h1 className="text-base font-bold text-slate-100">场景速查手册</h1>
              <p className="text-[11px] text-slate-500">按「我遇到了什么问题」来查，而不是按命令字典背</p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
          >
            ← 回练功房
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {SCENARIOS.map((s) => (
            <article
              key={s.title}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700"
            >
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <span className="text-lg">{s.icon}</span>
                {s.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.scene}</p>
              <div className="mt-3 space-y-2">
                {s.commands.map((c) => (
                  <div key={c.code} className="group relative">
                    <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 pr-14 font-mono text-xs text-emerald-300">
                      {c.code}
                    </pre>
                    <CopyButton text={c.code} />
                    {c.note && <p className="mt-0.5 pl-1 text-[11px] text-slate-500">{c.note}</p>}
                  </div>
                ))}
              </div>
              {s.warn && (
                <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                  ⚠️ {s.warn}
                </p>
              )}
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-violet-900/60 bg-violet-950/20 p-5">
          <h2 className="text-sm font-bold text-violet-300">🎓 新手三条军规</h2>
          <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300">
            <li>1️⃣ <b>迷路就敲 git status</b>——它永远会告诉你现在的状态和下一步的选项。</li>
            <li>2️⃣ <b>小步提交</b>——每完成一个小功能就 commit 一次，回退的时候才有「存档点」。</li>
            <li>3️⃣ <b>危险的命令想三秒</b>——凡是带 --hard、-f、--amend 的命令，执行前先确认自己知道会丢什么。</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
