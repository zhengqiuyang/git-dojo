/**
 * Git 练功房 API 端到端测试：模拟玩家依次打通全部 15 个关卡。
 * 运行前提：npm run dev（或 npm run start）已启动。
 *
 * 不变量：每关刚进入时，所有学习目标必须全部未完成（防止"没做就打勾"）。
 */
const BASE = "http://localhost:3000";

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`${path} 失败: ${JSON.stringify(d)}`);
  return d;
}

let failed = false;
function check(name, cond, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? "  | " + extra : ""}`);
  if (!cond) failed = true;
}

const sid = "apitest-" + Math.random().toString(36).slice(2, 8);
console.log(`会话: ${sid}\n`);

/** 进入/重置某关，并断言"进场所有目标未完成" */
async function enter(levelId, name) {
  const st = await post("/api/level", { sessionId: sid, levelId });
  check(
    `进入第 ${levelId} 关（进场目标全未完成）`,
    st.levelId === levelId && st.goals.every((g) => !g.done),
    st.goals.map((g) => (g.done ? "提前✓" : "")).filter(Boolean).join(",") ||
      JSON.stringify(st.output?.slice(0, 60) ?? "")
  );
  return st;
}

async function exec(command) {
  return post("/api/exec", { sessionId: sid, command });
}

function allDone(r) {
  return r.state.goals.every((g) => g.done);
}

// ---------- 第 1 关 ----------
let st = await post("/api/state", { sessionId: sid });
check("进入第 1 关（进场目标全未完成）", st.levelId === "01" && st.goals.every((g) => !g.done));

let r = await exec("git init");
check("L1 git init → 目标1", r.state.goals[0].done === true);

r = await exec("echo 你好，像素小镇 > story.txt");
const storyFile = r.state.files.find((f) => f.path === "story.txt");
check("L1 echo 写文件中文不乱码", storyFile?.content.includes("你好，像素小镇"));

r = await exec('git add . && git commit -m "中文提交信息：初始化小镇"');
check("L1 add+commit → 目标全过", allDone(r));

r = await exec("git log --oneline");
check("L1 git log 中文提交信息不乱码", r.output?.includes("中文提交信息：初始化小镇"));

// ---------- 第 2 关 ----------
st = await enter("02");
r = await exec("git switch -c feature");
check("L2 创建并切换分支", r.state.branch === "feature");
r = await exec('echo 新功能实验 > feature.txt && git add . && git commit -m "开始新功能实验"');
check("L2 feature 上有新提交", r.state.goals[1].done === true);
r = await exec("git switch main");
check("L2 回到 main → 目标全过", allDone(r));
check("L2 分支图有 3 个提交节点", r.state.graph.nodes.length === 3, `实际 ${r.state.graph.nodes.length}`);

// ---------- 第 3 关 ----------
st = await enter("03");
r = await exec("git switch main && git merge feature");
check("L3 合并 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 120)));
check("L3 图中出现合并提交（两个父提交）", r.state.graph.nodes.some((n) => n.parents.length === 2));

// ---------- 第 4 关 ----------
st = await enter("04");
r = await exec("git switch main && git merge feature");
check("L4 合并触发冲突", r.state.conflict === true && !allDone(r));
r = await post("/api/files", { sessionId: sid, path: "story.txt", content: "小镇的天气总是大雾。\n" });
r = await exec('git add story.txt && git commit -m "解决冲突：统一天气设定"');
check("L4 提交后目标全过", allDone(r));
check("L4 图中出现合并提交", r.state.graph.nodes.some((n) => n.parents.length === 2));

// ---------- 第 5 关 ----------
st = await enter("05");
r = await exec("git switch feature && git rebase main");
check("L5 rebase → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 150)));
check("L5 图为笔直历史（全是单父提交）", r.state.graph.nodes.every((n) => n.parents.length <= 1));

// ---------- 第 6 关 ----------
st = await enter("06");
r = await exec('git restore draft.txt && git reset --soft HEAD~1 && git rm -f secret.txt && git commit -m "添加配置（这次没有密码）"');
check("L6 撤销组合拳 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 200)));

// ---------- 第 7 关 ----------
st = await enter("07");
r = await exec("git tag v1.0");
check("L7 v1.0 打上", r.state.goals[0].done === true && r.state.goals[1].done === true);
r = await exec("git rev-list --max-parents=0 HEAD");
const rootHash = r.output.trim().split("\n").filter(Boolean).pop();
r = await exec(`git tag -a v0.1 -m "小镇的第一个版本" ${rootHash}`);
check("L7 v0.1 补盖到根提交 → 目标全过", allDone(r), `root=${rootHash}`);

// ---------- 第 8 关 ----------
st = await enter("08");
check("L8 初始：同事提交还没同步", st.goals[0].done === false);
r = await exec("git pull");
check("L8 pull 同步同事提交", r.state.goals[0].done === true, JSON.stringify(r.output?.slice(0, 120)));
r = await exec('echo 我的新功能 > feature.txt && git add feature.txt && git commit -m "我的新功能" && git push');
check("L8 push → 目标全过", allDone(r));
check("L8 图中出现 origin/main 镜像", r.state.graph.nodes.some((n) => n.refs.includes("origin/main")));

// ---------- 第 9 关 ----------
st = await enter("09");
check("L9 初始：story.txt 带未提交半成品", st.files.find((f) => f.path === "story.txt")?.status === "已修改");
r = await exec("git stash");
check("L9 stash 后工作区干净", r.state.files.find((f) => f.path === "story.txt")?.status === "已提交");
r = await exec('git switch main && echo 补丁 > hotfix.txt && git add hotfix.txt && git commit -m "修复线上bug"');
check("L9 main 上修好线上 bug", r.state.goals[0].done === true);
r = await exec("git switch feature && git stash pop");
check("L9 回 feature 取回半成品 → 目标全过", allDone(r));

// ---------- 第 10 关：detached HEAD ----------
st = await enter("10");
r = await exec("git rev-list --max-parents=0 HEAD");
const oldestHash = r.output.trim().split("\n").filter(Boolean).pop();
r = await exec(`git checkout ${oldestHash}`);
check("L10 checkout 历史提交进入分离状态", r.state.branch === null);
r = await exec("git switch -c time-travel && git switch main");
check("L10 锚定新分支并回到 main → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 120)));

// ---------- 第 11 关：历史考古 ----------
st = await enter("11");
r = await exec("git log -p poem.txt");
check("L11 用 log -p 做过考古（目标1达成）", r.state.goals[0].done === true);
r = await exec(
  "echo 小镇的夜晚星光闪耀。 > poem.txt && echo 湖面倒映着灯火。 >> poem.txt && echo 孩子们唱着歌回家。 >> poem.txt && git add poem.txt && git commit -m \"修复歌词错别字\""
);
check("L11 修复错别字并提交 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 100)));

// ---------- 第 12 关：amend ----------
st = await enter("12");
r = await exec("git add feature.md && git commit --amend --no-edit");
check("L12 amend 补入漏掉的文件（仍 2 个提交）", r.state.goals[0].done === true, JSON.stringify(r.output?.slice(0, 100)));
r = await exec('git commit --amend -m "添加功能说明书"');
check("L12 amend 修改提交信息 → 目标全过", allDone(r));

// ---------- 第 13 关：分支清理 ----------
st = await enter("13");
r = await exec("git switch main && git merge feature");
r = await exec("git branch -d feature");
check("L13 -d 删除已合并分支", !r.state.graph.nodes.some(() => false) && r.output?.includes("Deleted branch"), JSON.stringify(r.output?.slice(0, 80)));
r = await exec("git branch -d experiment");
check("L13 -d 拒绝删除未合并分支", r.output?.includes("not fully merged") || r.output?.includes("未合并"), JSON.stringify(r.output?.slice(0, 100)));
r = await exec("git branch -D experiment");
check("L13 -D 强制删除 → 目标全过", allDone(r));

// ---------- 第 14 关：被拒绝的 push ----------
st = await enter("14");
r = await exec("git push");
check("L14 push 被拒绝（non-fast-forward）", !allDone(r) && /rejected|non-fast-forward/i.test(r.output ?? ""), JSON.stringify(r.output?.slice(0, 150)));
r = await exec("git pull");
r = await exec("git push");
check("L14 pull 再 push → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 150)));

// ---------- 第 15 关：综合大演练 ----------
st = await enter("15");
r = await exec("git pull");
r = await exec("git switch -c feature");
r = await exec('echo 留言板 > feat1.txt && git add . && git commit -m "功能一：留言板"');
r = await exec('echo 暗黑模式 > feat2.txt && git add . && git commit -m "功能二：暗黑模式"');
r = await exec("git switch main && git merge feature");
r = await exec("git push");
r = await exec('git tag v2.0 -m "小镇 v2.0 正式发布"');
r = await exec("git push --tags");
check("L15 全流程演练 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 200)));
check("L15 远程已有 v2.0 标签", r.state.goals[3].done === true);

// ---------- 第 16 关：cherry-pick ----------
st = await enter("16");
r = await exec("git rev-list --reverse feature");
const featHashes = r.output.trim().split("\n"); // [第一章, 主线笔记, 重要修复, 实验乱改]
r = await exec(`git switch main && git cherry-pick ${featHashes[2]}`);
check("L16 摘樱桃 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 150)));

// ---------- 第 17 关：bisect ----------
st = await enter("17");
r = await exec("git rev-list --reverse HEAD");
const hs = r.output.trim().split("\n"); // 8 个提交，第 6 个（下标 5）引入 BUG
await exec("git bisect start");
await exec("git bisect bad HEAD");
r = await exec(`git bisect good ${hs[0]}`);
for (let i = 0; i < 12; i++) {
  if (/is the first '?bad'? commit/.test(r.output ?? "")) break;
  r = await exec("git rev-parse HEAD");
  const cur = r.output.trim();
  const idx = hs.indexOf(cur);
  if (idx === -1) break;
  r = await exec(`git bisect ${idx >= 5 ? "bad" : "good"}`);
}
check("L17 bisect 锁定真凶提交", /is the first '?bad'? commit/.test(r.output ?? ""), JSON.stringify(r.output?.slice(0, 140)));
r = await exec("git bisect reset");
for (let i = 1; i <= 8; i++) await exec(`echo 第${i}步计算完成。${i === 1 ? " >" : " >>"} calc.txt`);
r = await exec('git add calc.txt && git commit -m "修复除零错误"');
check("L17 修复并收工 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 150)));

// ---------- 第 18 关：reflog ----------
st = await enter("18");
r = await exec("git reflog");
r = await exec("git log -g --format=%H|%gs");
const lostLine = (r.output ?? "").split("\n").find((l) => l.includes("重要成果"));
const lostHash = lostLine?.split("|")[0];
check("L18 reflog 里找到丢失提交", !!lostHash, `hash=${lostHash}`);
r = await exec(`git reset --hard ${lostHash}`);
check("L18 找回提交 → 目标全过", allDone(r));

// ---------- 第 19 关：gitignore ----------
st = await enter("19");
r = await exec(
  'echo "*.log" > .gitignore && echo "temp/" >> .gitignore && echo "*.env" >> .gitignore && git add .gitignore && git commit -m "添加忽略规则"'
);
check("L19 忽略规则生效（垃圾文件从 status 消失）", r.state.goals[0].done === true && r.state.goals[1].done === true, JSON.stringify(r.output?.slice(0, 100)));
r = await exec('git rm --cached build/output.txt && echo "build/" >> .gitignore && git add .gitignore && git commit -m "停止跟踪构建产物"');
check("L19 停止跟踪误跟踪文件 → 目标全过", allDone(r), JSON.stringify(r.output?.slice(0, 150)));

console.log(failed ? "\n❌❌ 存在失败项" : "\n🎉 全部 19 关 API 测试通过");
process.exit(failed ? 1 : 0);
