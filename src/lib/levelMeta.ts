/** 关卡元信息（客户端安全，不含任何服务器逻辑） */
export const LEVEL_META = [
  { id: "01", title: "第 1 关 · 你的第一个仓库", short: "第一个仓库" },
  { id: "02", title: "第 2 关 · 平行宇宙：分支", short: "分支" },
  { id: "03", title: "第 3 关 · 时光交汇：合并", short: "合并" },
  { id: "04", title: "第 4 关 · 冲突化解现场", short: "解决冲突" },
  { id: "05", title: "第 5 关 · 笔直的历史：变基", short: "变基" },
  { id: "06", title: "第 6 关 · 撤销的艺术", short: "撤销" },
  { id: "07", title: "第 7 关 · 标签与版本", short: "标签" },
  { id: "08", title: "第 8 关 · 连接远程仓库", short: "远程协作" },
  { id: "09", title: "第 9 关 · 随身行李：stash", short: "stash" },
  { id: "10", title: "第 10 关 · 头飞了：detached HEAD", short: "detached HEAD" },
  { id: "11", title: "第 11 关 · 历史考古", short: "考古" },
  { id: "12", title: "第 12 关 · 提交打磨：amend", short: "amend" },
  { id: "13", title: "第 13 关 · 分支清理", short: "分支清理" },
  { id: "14", title: "第 14 关 · 被拒绝的 push", short: "push 被拒" },
  { id: "15", title: "第 15 关 · 综合大演练：v2.0 发布日", short: "综合演练" },
  { id: "16", title: "第 16 关 · 摘樱桃：cherry-pick", short: "cherry-pick" },
  { id: "17", title: "第 17 关 · 二分捉虫：bisect", short: "bisect" },
  { id: "18", title: "第 18 关 · 时光邮差：reflog", short: "reflog" },
  { id: "19", title: "第 19 关 · 看不见的文件：.gitignore", short: "gitignore" },
];

/** 后续路线图（仅展示，未开放） */
export const ROADMAP = [
  { title: "第 20 关 · 分身术", subtitle: "worktree：多分支并行（需要多终端支持，开发中）" },
  { title: "第 21 关 · 交互式变基", subtitle: "rebase -i：重排/合并/改写提交" },
  { title: "第 22 关 · 仓库套娃", subtitle: "submodule：仓库里的仓库" },
  { title: "第 23 关 · 团队实战模拟", subtitle: "模拟真实多人协作工作流" },
];
