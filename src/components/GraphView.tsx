"use client";

import { useEffect, useRef } from "react";
import type { GraphData } from "@/lib/graph";

const COL_W = 40;
const ROW_H = 46;
const PAD = 18;

const COLORS = ["#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#f87171"];

function laneColor(lane: number) {
  return COLORS[lane % COLORS.length];
}

export default function GraphView({ graph }: { graph: GraphData }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新提交出现在顶部，自动滚回最上面
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [graph]);

  if (!graph.isRepo) {
    return (
      <EmptyState
        icon="📁"
        text="这里还不是 Git 仓库。"
        sub="在终端里敲下 git init，让仓库诞生吧。"
      />
    );
  }
  if (graph.nodes.length === 0) {
    return (
      <EmptyState
        icon="🐣"
        text="仓库已就绪，还没有任何提交。"
        sub="完成第一次 add + commit 后，这里会画出你的第一条时间线。"
      />
    );
  }

  // 标签列的 x 位置：取「泳道区宽度」和「最长的提交说明结尾」的较大者，避免文字重叠
  const estWidth = (s: string) =>
    [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 13 : 7.2), 0);
  const maxSubjectEnd = Math.max(
    ...graph.nodes.map((n) => {
      const subject = n.subject.length > 24 ? n.subject.slice(0, 24) + "…" : n.subject;
      return PAD + n.lane * COL_W + 64 + estWidth(subject);
    })
  );
  const maxRefLen = Math.max(6, ...graph.nodes.flatMap((n) => n.refs.map((r) => r.length)));
  const labelX = Math.max(graph.laneCount * COL_W + PAD + 24, maxSubjectEnd + 28);
  const svgWidth = labelX + 50 + maxRefLen * 7 + 18 + 28;
  const height = graph.nodes.length * ROW_H + PAD * 2;

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-auto rounded-xl bg-slate-950/60 p-1"
    >
      <svg width={svgWidth} height={height} className="min-w-full">
        {/* 边 */}
        {graph.edges.map((e, i) => {
          const x1 = PAD + e.fromLane * COL_W;
          const y1 = PAD + e.fromRow * ROW_H;
          const x2 = PAD + e.toLane * COL_W;
          const y2 = PAD + e.toRow * ROW_H;
          const color = laneColor(e.fromLane);
          if (e.fromLane === e.toLane) {
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={2.5}
                opacity={0.85}
              />
            );
          }
          const dy = (y2 - y1) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              opacity={0.85}
            />
          );
        })}

        {/* 节点 + 说明 */}
        {graph.nodes.map((n) => {
          const x = PAD + n.lane * COL_W;
          const y = PAD + n.row * ROW_H;
          const isHead = graph.headId === n.id;
          return (
            <g key={n.id}>
              {isHead && (
                <circle cx={x} cy={y} r={11} fill="none" stroke="#7dd3fc" strokeWidth={1.5} opacity={0.9} />
              )}
              <circle cx={x} cy={y} r={7} fill={laneColor(n.lane)} />
              <text x={x + 14} y={y + 4} fontSize={11} fill="#64748b" fontFamily="Consolas, monospace">
                {n.hash}
              </text>
              <text x={x + 64} y={y + 4} fontSize={13} fill="#cbd5e1">
                {n.subject.length > 24 ? n.subject.slice(0, 24) + "…" : n.subject}
              </text>

              {/* 右侧分支标签 */}
              {(n.refs.length > 0 || isHead) && (
                <g transform={`translate(${labelX}, ${y - 10})`}>
                  {isHead && (
                    <>
                      <rect width={40} height={20} rx={10} fill="#0ea5e9" opacity={0.25} />
                      <text x={20} y={14} fontSize={11} textAnchor="middle" fill="#7dd3fc" fontWeight={700}>
                        HEAD
                      </text>
                    </>
                  )}
                  {n.refs.map((r, ri) => {
                    const isCurrent = graph.headBranch === r;
                    const rx = isHead ? 46 + ri * (r.length * 7 + 26) : ri * (r.length * 7 + 26);
                    return (
                      <g key={r} transform={`translate(${rx}, 0)`}>
                        <rect
                          width={r.length * 7 + 18}
                          height={20}
                          rx={10}
                          fill={isCurrent ? "#8b5cf6" : "#334155"}
                          opacity={isCurrent ? 0.9 : 1}
                        />
                        <text
                          x={(r.length * 7 + 18) / 2}
                          y={14}
                          fontSize={11}
                          textAnchor="middle"
                          fill={isCurrent ? "#fff" : "#94a3b8"}
                        >
                          {r}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl bg-slate-950/60 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="mt-3 text-sm text-slate-300">{text}</div>
      <div className="mt-1 px-6 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
