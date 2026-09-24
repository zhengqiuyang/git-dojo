import { spawn } from "child_process";
import path from "path";

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * 在指定目录里执行一条 git 命令。
 * 通过环境变量保证：无分页器、无编辑器交互、统一的默认分支与身份配置。
 */
export function runGit(dir: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd: dir,
      env: {
        ...process.env,
        // 让 git 在沙盒里"开箱即用"：跳过分页器和编辑器，统一行为
        GIT_PAGER: "cat",
        PAGER: "cat",
        GIT_EDITOR: "true",
        EDITOR: "true",
        LC_ALL: "C",
        GIT_CONFIG_COUNT: "8",
        GIT_CONFIG_KEY_0: "init.defaultBranch",
        GIT_CONFIG_VALUE_0: "main",
        GIT_CONFIG_KEY_1: "user.name",
        GIT_CONFIG_VALUE_1: "学员",
        GIT_CONFIG_KEY_2: "user.email",
        GIT_CONFIG_VALUE_2: "student@git-dojo.local",
        GIT_CONFIG_KEY_3: "core.autocrlf",
        GIT_CONFIG_VALUE_3: "false",
        GIT_CONFIG_KEY_4: "core.quotepath",
        GIT_CONFIG_VALUE_4: "false",
        GIT_CONFIG_KEY_5: "advice.detachedHead",
        GIT_CONFIG_VALUE_5: "false",
        GIT_CONFIG_KEY_6: "pull.rebase",
        GIT_CONFIG_VALUE_6: "false",
        GIT_CONFIG_KEY_7: "commit.gpgsign",
        GIT_CONFIG_VALUE_7: "false",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr!.on("data", (d: Buffer) => (stderr += d.toString("utf8")));

    const timer = setTimeout(() => child.kill(), 15_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

const SEP = "\x1f";

export interface LogEntry {
  id: string;
  hash: string;
  subject: string;
  parents: string[];
}

/** 拿到所有分支上的提交（按时间倒序），仓库还没有提交时返回空数组 */
export async function gitLogAll(dir: string): Promise<LogEntry[]> {
  const r = await runGit(dir, [
    "log",
    "--all",
    `--format=%H${SEP}%h${SEP}%s${SEP}%P`,
  ]);
  if (r.code !== 0) return [];
  return r.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, hash, subject, parents] = line.split(SEP);
      return {
        id,
        hash,
        subject: subject ?? "",
        parents: (parents ?? "").split(" ").filter(Boolean),
      };
    });
}

export interface RefInfo {
  headBranch: string | null; // 当前分支名；detached 时为 null
  headId: string | null; // HEAD 指向的提交；未出生时为 null
  unborn: boolean; // 分支存在但还没有任何提交
  branches: { name: string; id: string }[];
}

export async function gitRefs(dir: string): Promise<RefInfo> {
  const [sym, rev, forRef] = await Promise.all([
    runGit(dir, ["symbolic-ref", "-q", "--short", "HEAD"]),
    runGit(dir, ["rev-parse", "--verify", "-q", "HEAD"]),
    runGit(dir, [
      "for-each-ref",
      "refs/heads",
      "refs/remotes",
      `--format=%(objectname)${SEP}%(refname:short)`,
    ]),
  ]);

  const branches = forRef.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [id, name] = l.split(SEP);
      return { id, name };
    });

  const unborn = rev.code !== 0 && sym.code === 0;
  return {
    headBranch: sym.code === 0 ? sym.stdout.trim() : null,
    headId: rev.code === 0 ? rev.stdout.trim() : null,
    unborn,
    branches,
  };
}

export interface StatusFile {
  path: string;
  x: string; // 暂存区状态
  y: string; // 工作区状态
}

export async function gitStatus(dir: string): Promise<StatusFile[]> {
  const r = await runGit(dir, ["status", "--porcelain=v1", "-z"]);
  if (r.code !== 0) return [];
  const parts = r.stdout.split("\0").filter(Boolean);
  const out: StatusFile[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const x = entry[0];
    const y = entry[1];
    let p = entry.slice(3);
    // 重命名格式 "new\0old\0"
    if (x === "R" || x === "C") i++;
    out.push({ path: p, x, y });
  }
  return out;
}

export async function isRepo(dir: string): Promise<boolean> {
  const r = await runGit(dir, ["rev-parse", "--is-inside-work-tree"]);
  return r.code === 0 && r.stdout.trim() === "true";
}

export async function revListCount(dir: string, range: string): Promise<number> {
  const r = await runGit(dir, ["rev-list", "--count", range]);
  return r.code === 0 ? parseInt(r.stdout.trim(), 10) || 0 : 0;
}

export async function mergeCommitCount(dir: string, ref: string): Promise<number> {
  const r = await runGit(dir, ["rev-list", "--merges", "--count", ref]);
  return r.code === 0 ? parseInt(r.stdout.trim(), 10) || 0 : 0;
}

export async function isAncestor(dir: string, a: string, b: string): Promise<boolean> {
  const r = await runGit(dir, ["merge-base", "--is-ancestor", a, b]);
  return r.code === 0;
}

/** 解析引用（分支 / 标签 / 标签^{commit}），失败返回 null */
export async function revParse(dir: string, ref: string): Promise<string | null> {
  const r = await runGit(dir, ["rev-parse", "--verify", "-q", ref]);
  return r.code === 0 ? r.stdout.trim() : null;
}

/** 标签指向的提交（剥掉附注标签对象本身） */
export async function tagCommit(dir: string, tag: string): Promise<string | null> {
  return revParse(dir, `${tag}^{commit}`);
}

/** 某个引用文件树里的文件列表 */
export async function lsTree(dir: string, ref: string): Promise<string[]> {
  const r = await runGit(dir, ["ls-tree", "--name-only", "-r", ref]);
  return r.code === 0
    ? r.stdout.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];
}

/** 某个引用的历史里是否存在指定说明的提交 */
export async function hasCommitWithSubject(
  dir: string,
  ref: string,
  subject: string
): Promise<boolean> {
  const r = await runGit(dir, ["log", "--format=%s", ref]);
  if (r.code !== 0) return false;
  return r.stdout.split("\n").map((s) => s.trim()).includes(subject);
}

export async function listTrackedFiles(dir: string): Promise<string[]> {
  const r = await runGit(dir, ["ls-files"]);
  return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

export async function branchExists(dir: string, name: string): Promise<boolean> {
  const r = await runGit(dir, ["rev-parse", "--verify", "-q", `refs/heads/${name}`]);
  return r.code === 0;
}

export function resolveInside(dir: string, p: string): string {
  const target = path.resolve(dir, p);
  const norm = path.normalize(dir);
  if (target !== norm && !target.startsWith(norm + path.sep)) {
    throw new Error("只能在练习沙盒目录内操作哦 🙅");
  }
  return target;
}
