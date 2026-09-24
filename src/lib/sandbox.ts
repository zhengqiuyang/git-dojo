import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { runGit, resolveInside } from "./git";
import { getLevel } from "./levels";

export interface Sandbox {
  sessionId: string;
  levelId: string;
  dir: string;
}

// 学员最近敲过的命令及输出（内存态，AI 助教上下文用）
export interface HistoryEntry {
  cmd: string;
  output: string; // 已截断
}

const histories = new Map<string, HistoryEntry[]>();

const OUTPUT_CAP = 300;

export function getHistory(sessionId: string): HistoryEntry[] {
  return histories.get(sessionId) ?? [];
}

function recordHistory(sessionId: string, input: string, output: string) {
  const h = histories.get(sessionId) ?? [];
  const trimmed = output.replace(/\s+\n/g, "\n").trim();
  h.push({
    cmd: input.trim(),
    output: trimmed.length > OUTPUT_CAP ? trimmed.slice(0, OUTPUT_CAP) + "…（截断）" : trimmed,
  });
  if (h.length > 40) h.shift();
  histories.set(sessionId, h);
}

export function clearHistory(sessionId: string) {
  histories.delete(sessionId);
}

const ROOT = path.join(os.tmpdir(), "git-dojo-sandboxes");
const SESSIONS_FILE = path.join(ROOT, "sessions.json");

// sessionId -> levelId，服务重启后也能恢复
const sessionLevels = new Map<string, string>();
let loaded = false;

async function persist() {
  try {
    await fsp.mkdir(ROOT, { recursive: true });
    await fsp.writeFile(
      SESSIONS_FILE,
      JSON.stringify(Object.fromEntries(sessionLevels)),
      "utf8"
    );
  } catch {
    /* 持久化失败不影响功能 */
  }
}

async function loadIfNeeded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fsp.readFile(SESSIONS_FILE, "utf8");
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) sessionLevels.set(k, v);
  } catch {
    /* 没有历史记录 */
  }
}

export function validSessionId(id: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

function sessionDir(sessionId: string): string {
  return path.join(ROOT, sessionId);
}

/** 清掉某关的全部目录（含 level-XX 附属的远程仓库、同事克隆等） */
async function cleanSessionLevel(sessionId: string, levelId: string) {
  const sd = sessionDir(sessionId);
  if (!fs.existsSync(sd)) return;
  for (const entry of await fsp.readdir(sd)) {
    if (entry === `level-${levelId}` || entry.startsWith(`level-${levelId}-`)) {
      await fsp.rm(path.join(sd, entry), { recursive: true, force: true });
    }
  }
}

async function setupLevel(sb: Sandbox) {
  const level = getLevel(sb.levelId);
  if (!level) throw new Error(`关卡不存在: ${sb.levelId}`);
  await cleanSessionLevel(sb.sessionId, sb.levelId);
  await fsp.mkdir(sb.dir, { recursive: true });
  await level.setup(sb);
}

export async function getSandbox(
  sessionId: string,
  levelId?: string
): Promise<Sandbox> {
  await loadIfNeeded();
  let current = sessionLevels.get(sessionId) ?? "01";
  if (levelId && levelId !== current) {
    current = levelId;
    sessionLevels.set(sessionId, levelId);
    await persist();
  }
  const sb: Sandbox = {
    sessionId,
    levelId: current,
    dir: path.join(ROOT, sessionId, `level-${current}`),
  };
  if (!fs.existsSync(sb.dir)) {
    await setupLevel(sb);
  }
  return sb;
}

/** 重建关卡（重置 / 首次进入） */
export async function resetSandbox(
  sessionId: string,
  levelId: string
): Promise<Sandbox> {
  await loadIfNeeded();
  sessionLevels.set(sessionId, levelId);
  await persist();
  clearHistory(sessionId);
  const sb: Sandbox = {
    sessionId,
    levelId,
    dir: path.join(ROOT, sessionId, `level-${levelId}`),
  };
  await setupLevel(sb);
  return sb;
}

// ---------- 终端命令执行（白名单，不经过 shell） ----------

export interface ExecOutcome {
  output: string;
  clear?: boolean;
  fatal?: boolean;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) tokens.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

async function runOne(sb: Sandbox, raw: string): Promise<ExecOutcome> {
  const cmd = raw.trim();
  if (!cmd) return { output: "" };
  if (cmd === "clear") return { output: "", clear: true };
  if (cmd === "help") return { output: HELP_TEXT };

  const tokens = tokenize(cmd);
  const name = tokens[0];

  // 禁止 git 通过 -C / --git-dir 等参数逃出沙盒
  const blocked = tokens.find(
    (t) =>
      t === "-C" ||
      t.startsWith("--git-dir") ||
      t.startsWith("--work-tree") ||
      t.startsWith("--super-prefix")
  );
  if (blocked) {
    return { output: `🚫 不能使用 ${blocked}，练习只在沙盒里进行哦。\n` };
  }

  try {
    switch (name) {
      case "git": {
        const r = await runGit(sb.dir, tokens.slice(1));
        const out = (r.stdout + (r.stderr ? (r.stdout ? "\n" : "") + r.stderr : "")).trimEnd();
        return { output: out ? out + "\n" : "" };
      }
      case "pwd":
        return { output: "~/sandbox\n" };
      case "ls": {
        const target = tokens[1] ? resolveInside(sb.dir, tokens[1]) : sb.dir;
        const entries = await fsp.readdir(target, { withFileTypes: true });
        const names = entries
          .filter((e) => e.name !== ".git")
          .map((e) => (e.isDirectory() ? e.name + "/" : e.name))
          .sort();
        return { output: (names.join("\n") || "(空目录)") + "\n" };
      }
      case "cat": {
        if (!tokens[1]) return { output: "用法: cat <文件>\n" };
        const target = resolveInside(sb.dir, tokens[1]);
        try {
          return { output: await fsp.readFile(target, "utf8") };
        } catch {
          return { output: `cat: ${tokens[1]}: 没有那个文件\n` };
        }
      }
      case "echo": {
        const gt = tokens.findIndex((t) => t === ">" || t === ">>");
        if (gt === -1) {
          return { output: tokens.slice(1).join(" ") + "\n" };
        }
        const text = tokens.slice(1, gt).join(" ");
        const file = tokens[gt + 1];
        if (!file) return { output: "用法: echo 文本 > 文件名\n" };
        const target = resolveInside(sb.dir, file);
        if (tokens[gt] === ">>") {
          await fsp.appendFile(target, text + "\n", "utf8");
        } else {
          await fsp.writeFile(target, text + "\n", "utf8");
        }
        return { output: "" };
      }
      case "touch": {
        if (!tokens[1]) return { output: "用法: touch <文件>\n" };
        const target = resolveInside(sb.dir, tokens[1]);
        await fsp.writeFile(target, "", { flag: "a" });
        return { output: "" };
      }
      case "rm": {
        const files = tokens.slice(1).filter((t) => t !== "-r" && t !== "-f" && t !== "-rf");
        if (!files.length) return { output: "用法: rm <文件>\n" };
        for (const f of files) {
          const target = resolveInside(sb.dir, f);
          await fsp.rm(target, { recursive: false, force: true });
        }
        return { output: "" };
      }
      case "mkdir": {
        if (!tokens[1]) return { output: "用法: mkdir <目录>\n" };
        await fsp.mkdir(resolveInside(sb.dir, tokens[1]), { recursive: true });
        return { output: "" };
      }
      default:
        return {
          output: `${name}: 未找到命令。练习环境支持 git、echo、cat、ls、pwd、touch、rm、mkdir，输入 help 查看说明。\n`,
        };
    }
  } catch (e) {
    return { output: `⚠️ ${(e as Error).message}\n` };
  }
}

/** 支持 && 串联的多条命令，全部依次执行 */
export async function execCommand(sb: Sandbox, input: string): Promise<ExecOutcome> {
  const parts = input
    .split("&&")
    .map((p) => p.trim())
    .filter(Boolean);
  let out = "";
  let clear = false;
  for (const p of parts) {
    const r = await runOne(sb, p);
    if (r.clear) clear = true;
    if (r.output) out += r.output;
  }
  recordHistory(sb.sessionId, input, out);
  return { output: out, clear };
}

const HELP_TEXT = `
📚 练习环境可用命令：
  git <子命令>          真实的 Git！init / status / add / commit / switch / merge / log ...
  echo 文本 > 文件      写文件（>> 是追加），例如: echo 你好 > story.txt
  cat <文件>            查看文件内容
  ls                    列出文件
  touch <文件>          新建空文件
  rm <文件>             删除文件
  mkdir <目录>          新建目录
  clear                 清屏
  help                  显示本说明

💡 小技巧：修改文件也可以用右侧「文件」标签页里的编辑器，改完记得 add + commit！
支持 && 串联，例如: git add . && git commit -m "x"
`.trimStart();
