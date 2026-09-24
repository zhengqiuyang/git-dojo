import type { LogEntry, RefInfo } from "./git";

export interface GraphNode {
  id: string;
  hash: string;
  subject: string;
  parents: string[];
  refs: string[]; // 指向这个提交的分支名
  lane: number;
  row: number;
}

export interface GraphEdge {
  fromRow: number;
  fromLane: number;
  toRow: number;
  toLane: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  laneCount: number;
  headBranch: string | null;
  headId: string | null;
  unborn: boolean;
  isRepo: boolean;
}

/**
 * 把 git log 的提交列表排布成泳道图：
 * 每个提交占一行，分支线占一条泳道，合并时画出弧线。
 */
export function computeGraph(
  log: LogEntry[],
  refs: RefInfo,
  isRepoFlag: boolean
): GraphData {
  if (!isRepoFlag || log.length === 0) {
    return {
      nodes: [],
      edges: [],
      laneCount: 1,
      headBranch: refs.headBranch,
      headId: refs.headId,
      unborn: refs.unborn,
      isRepo: isRepoFlag,
    };
  }

  const refMap = new Map<string, string[]>();
  for (const b of refs.branches) {
    const arr = refMap.get(b.id) ?? [];
    arr.push(b.name);
    refMap.set(b.id, arr);
  }

  const laneOf = new Map<string, number>();
  // 每条泳道"期待"出现的下一个提交 id
  const slots: (string | null)[] = [];

  const nodes: GraphNode[] = [];

  for (let row = 0; row < log.length; row++) {
    const c = log[row];

    let lane = laneOf.get(c.id);
    if (lane === undefined) {
      lane = slots.findIndex((s) => s === c.id);
      if (lane === -1) {
        // 新线头（分支顶端）：找空位，没有就扩一位
        lane = slots.findIndex((s) => s === null);
        if (lane === -1) {
          lane = slots.length;
          slots.push(null);
        }
      }
    }
    laneOf.set(c.id, lane);
    slots[lane] = null;

    if (c.parents.length > 0) {
      // 第一父提交沿本泳道继续
      slots[lane] = c.parents[0];
      // 其余父提交（合并来源）：可能已在其他泳道上
      for (const p of c.parents.slice(1)) {
        let pl = slots.findIndex((s) => s === p);
        if (pl === -1) pl = laneOf.get(p) ?? -1;
        if (pl === -1) {
          const free = slots.findIndex((s) => s === null);
          if (free === -1) {
            slots.push(p);
            pl = slots.length - 1;
          } else {
            slots[free] = p;
            pl = free;
          }
        }
      }
    }

    nodes.push({
      id: c.id,
      hash: c.hash,
      subject: c.subject,
      parents: c.parents,
      refs: refMap.get(c.id) ?? [],
      lane,
      row,
    });
  }

  const rowOf = new Map(nodes.map((n) => [n.id, n.row]));
  const edges: GraphEdge[] = [];
  for (const n of nodes) {
    for (const p of n.parents) {
      const toRow = rowOf.get(p);
      const toLane = laneOf.get(p);
      if (toRow !== undefined && toLane !== undefined) {
        edges.push({
          fromRow: n.row,
          fromLane: n.lane,
          toRow,
          toLane,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    laneCount: Math.max(1, slots.length),
    headBranch: refs.headBranch,
    headId: refs.headId,
    unborn: false,
    isRepo: true,
  };
}
