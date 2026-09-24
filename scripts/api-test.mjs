/**
 * Git 练功房 API 端到端测试：模拟玩家依次打通 4 个关卡。
 * 运行前提：npm run dev 已启动。
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

// ---------- 第 1 关 ----------
let st = await post("/api/state", { sessionId: sid });
check("进入第 1 关", st.levelId === "01");

let r = await post("/api/exec", { sessionId: sid, command: "git init" });
check("L1 git init → 目标1", r.state.goals[0].done === true, JSON.stringify(r.output?.slice(0, 80)));

r = await post("/api/exec", { sessionId: sid, command: "echo 你好，像素小镇 > story.txt" });
const storyFile = r.state.files.find((f) => f.path === "story.txt");
check("L1 echo 写文件中文不乱码", storyFile?.content.includes("你好，像素小镇"), JSON.stringify(storyFile?.content));

r = await post("/api/exec", { sessionId: sid, command: 'git add . && git commit -m "中文提交信息：初始化小镇"' });
check("L1 add+commit → 目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 100)));

r = await post("/api/exec", { sessionId: sid, command: "git log --oneline" });
check("L1 git log 中文提交信息不乱码", r.output?.includes("中文提交信息：初始化小镇"), JSON.stringify(r.output));

// ---------- 第 2 关 ----------
st = await post("/api/level", { sessionId: sid, levelId: "02" });
check("进入第 2 关（重置成功）", st.levelId === "02" && st.goals.every((g) => !g.done));

r = await post("/api/exec", { sessionId: sid, command: "git switch -c feature" });
check("L2 创建并切换分支", r.state.branch === "feature", JSON.stringify(r.output));

r = await post("/api/exec", { sessionId: sid, command: "echo 新功能实验 > feature.txt && git add . && git commit -m \"开始新功能实验\"" });
check("L2 feature 上有新提交", r.state.goals[1].done === true);

r = await post("/api/exec", { sessionId: sid, command: "git switch main" });
const l2done = r.state.goals.every((g) => g.done);
check("L2 回到 main → 目标全过", l2done);
check("L2 分支图有 3 个提交节点", r.state.graph.nodes.length === 3, `实际 ${r.state.graph.nodes.length}`);

// ---------- 第 3 关 ----------
st = await post("/api/level", { sessionId: sid, levelId: "03" });
check("进入第 3 关", st.levelId === "03");

r = await post("/api/exec", { sessionId: sid, command: "git switch main && git merge feature" });
check("L3 合并 → 目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 120)));
check("L3 图中出现合并提交（两个父提交）", r.state.graph.nodes.some((n) => n.parents.length === 2));

// ---------- 第 4 关 ----------
st = await post("/api/level", { sessionId: sid, levelId: "04" });
check("进入第 4 关", st.levelId === "04");

r = await post("/api/exec", { sessionId: sid, command: "git switch main && git merge feature" });
check("L4 合并触发冲突", r.state.conflict === true && !r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 150)));
const conflicted = r.state.files.find((f) => f.path === "story.txt");
check("L4 story.txt 带冲突标记", conflicted?.content.includes("<<<<<<<"), JSON.stringify(conflicted?.content));

r = await post("/api/files", { sessionId: sid, path: "story.txt", content: "小镇的天气总是大雾。\n" });
check("L4 文件编辑器保存解决内容", !r.state.files.find((f) => f.path === "story.txt")?.content.includes("<<<<<<<"));

r = await post("/api/exec", { sessionId: sid, command: 'git add story.txt && git commit -m "解决冲突：统一天气设定"' });
check("L4 提交后目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 100)));
check("L4 图中出现合并提交", r.state.graph.nodes.some((n) => n.parents.length === 2));

// ---------- 第 5 关：rebase ----------
st = await post("/api/level", { sessionId: sid, levelId: "05" });
check("进入第 5 关", st.levelId === "05" && st.goals.every((g) => !g.done));

r = await post("/api/exec", { sessionId: sid, command: "git switch feature && git rebase main" });
check("L5 rebase → 目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 150)));
check("L5 图为笔直历史（全是单父提交）", r.state.graph.nodes.every((n) => n.parents.length <= 1));

// ---------- 第 6 关：撤销 ----------
st = await post("/api/level", { sessionId: sid, levelId: "06" });
check("进入第 6 关", st.levelId === "06");

r = await post("/api/exec", {
  sessionId: sid,
  command: 'git restore draft.txt && git reset --soft HEAD~1 && git rm -f secret.txt && git commit -m "添加配置（这次没有密码）"',
});
check("L6 撤销组合拳 → 目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 200)));

// ---------- 第 7 关：标签 ----------
st = await post("/api/level", { sessionId: sid, levelId: "07" });
check("进入第 7 关", st.levelId === "07");

r = await post("/api/exec", { sessionId: sid, command: "git tag v1.0" });
check("L7 v1.0 打上", r.state.goals[0].done === true && r.state.goals[1].done === true);

r = await post("/api/exec", { sessionId: sid, command: "git rev-list --max-parents=0 HEAD" });
const rootHash = r.output.trim().split("\n").filter(Boolean).pop();
r = await post("/api/exec", { sessionId: sid, command: `git tag -a v0.1 -m "小镇的第一个版本" ${rootHash}` });
check("L7 v0.1 补盖到根提交 → 目标全过", r.state.goals.every((g) => g.done), `root=${rootHash} ${JSON.stringify(r.output?.slice(0, 120))}`);

// ---------- 第 8 关：远程 ----------
st = await post("/api/level", { sessionId: sid, levelId: "08" });
check("进入第 8 关", st.levelId === "08" && st.goals.every((g) => !g.done));

check("L8 初始：同事提交还没同步", st.goals[0].done === false);

r = await post("/api/exec", { sessionId: sid, command: "git pull" });
check("L8 pull 同步同事提交", r.state.goals[0].done === true, JSON.stringify(r.output?.slice(0, 150)));

r = await post("/api/exec", { sessionId: sid, command: 'echo 我的新功能 > feature.txt && git add feature.txt && git commit -m "我的新功能" && git push' });
check("L8 push → 目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 250)));
check("L8 图中出现 origin/main 镜像", r.state.graph.nodes.some((n) => n.refs.includes("origin/main")));

// ---------- 第 9 关：stash ----------
st = await post("/api/level", { sessionId: sid, levelId: "09" });
check("进入第 9 关", st.levelId === "09" && st.goals.every((g) => !g.done));
check("L9 初始：story.txt 带未提交半成品", st.files.find((f) => f.path === "story.txt")?.status === "已修改");

r = await post("/api/exec", { sessionId: sid, command: "git stash" });
check("L9 stash 后工作区干净", (r.state.files.find((f) => f.path === "story.txt"))?.status === "已提交", JSON.stringify(r.output));

r = await post("/api/exec", { sessionId: sid, command: 'git switch main && echo 补丁 > hotfix.txt && git add hotfix.txt && git commit -m "修复线上bug"' });
check("L9 main 上修好线上 bug", r.state.goals[0].done === true);

r = await post("/api/exec", { sessionId: sid, command: "git switch feature && git stash pop" });
check("L9 回 feature 取回半成品 → 目标全过", r.state.goals.every((g) => g.done), JSON.stringify(r.output?.slice(0, 200)));

console.log(failed ? "\n❌❌ 存在失败项" : "\n🎉 全部 9 关 API 测试通过");
process.exit(failed ? 1 : 0);
