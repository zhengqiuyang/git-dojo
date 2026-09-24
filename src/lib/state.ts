import fs from "fs/promises";
import path from "path";
import { gitLogAll, gitRefs, gitStatus, isRepo } from "./git";
import { computeGraph } from "./graph";
import { getLevel } from "./levels";
import type { Sandbox } from "./sandbox";

export interface FileEntry {
  path: string;
  content: string;
  status: string; // 未跟踪 / 已暂存 / 已修改 / 冲突 等
}

export interface DojoState {
  levelId: string;
  levelTitle: string;
  levelSubtitle: string;
  story: string;
  steps: string[];
  hints: string[];
  hintsTotal: number;
  goals: { label: string; done: boolean }[];
  completed: boolean;
  graph: ReturnType<typeof computeGraph>;
  files: FileEntry[];
  branch: string | null;
  conflict: boolean; // 当前处于合并冲突中
}

const STATUS_LABEL: Record<string, string> = {
  "?": "未跟踪",
  A: "已暂存(新)",
  M: "已修改",
  D: "已删除",
  U: "冲突中",
  R: "已重命名",
  C: "已复制",
};

async function listFiles(sb: Sandbox): Promise<FileEntry[]> {
  const status = await gitStatus(sb.dir);
  const statusMap = new Map(status.map((s) => [s.path, s]));

  const out: FileEntry[] = [];

  async function walk(rel: string, depth: number) {
    if (depth > 4 || out.length > 80) return;
    const abs = path.join(sb.dir, rel);
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === ".git") continue;
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(relPath, depth + 1);
      } else {
        let content = "";
        try {
          const stat = await fs.stat(path.join(sb.dir, relPath));
          if (stat.size <= 200_000) {
            content = await fs.readFile(path.join(sb.dir, relPath), "utf8");
          } else {
            content = "（文件太大，不支持在编辑器中打开）";
          }
        } catch {
          content = "（无法读取，可能是二进制文件）";
        }
        const st = statusMap.get(relPath);
        const label = st
          ? STATUS_LABEL[st.x === "?" ? "?" : st.x !== " " ? st.x : st.y] ?? "已修改"
          : "已提交";
        out.push({ path: relPath, content, status: label });
      }
    }
  }

  await walk("", 0);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

export async function buildState(sb: Sandbox): Promise<DojoState> {
  const level = getLevel(sb.levelId)!;
  const [repo, refs, log, files] = await Promise.all([
    isRepo(sb.dir),
    gitRefs(sb.dir),
    gitLogAll(sb.dir),
    listFiles(sb),
  ]);
  const graph = computeGraph(log, refs, repo);

  const goals = await Promise.all(
    level.goals.map(async (g) => ({ label: g.label, done: await g.check(sb) }))
  );
  const completed = goals.every((g) => g.done);

  // 是否正处于合并冲突中：有未合并路径
  const status = await gitStatus(sb.dir);
  const conflict = status.some((s) => s.x === "U" || s.y === "U" || s.x === "A" || (s.x === "D" && s.y === "U"));

  return {
    levelId: sb.levelId,
    levelTitle: level.title,
    levelSubtitle: level.subtitle,
    story: level.story,
    steps: level.steps,
    hints: level.hints,
    hintsTotal: level.hints.length,
    goals,
    completed,
    graph,
    files,
    branch: refs.headBranch,
    conflict,
  };
}
