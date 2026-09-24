"use client";

import { useState } from "react";
import { LEVEL_META, ROADMAP } from "@/lib/levelMeta";
import type { DojoState } from "@/lib/state";

interface Props {
  state: DojoState;
  hintsShown: number;
  onHint: () => void;
  onEnterLevel: (levelId: string) => void;
  onReset: () => void;
}

export default function TaskPanel({ state, hintsShown, onHint, onEnterLevel, onReset }: Props) {
  const hints = state.hints ?? [];  const doneCount = state.goals.filter((g) => g.done).length;
  const isLast = state.levelId === LEVEL_META[LEVEL_META.length - 1].id;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      {/* 关卡导航 */}
      <div className="flex flex-wrap gap-2">
        {LEVEL_META.map((m) => {
          const current = m.id === state.levelId;
          return (
            <button
              key={m.id}
              onClick={() => onEnterLevel(m.id)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (current
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                  : "bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200")
              }
            >
              {m.id} · {m.short}
            </button>
          );
        })}
        {ROADMAP.map((m) => (
          <span
            key={m.title}
            title={m.subtitle}
            className="cursor-not-allowed rounded-lg border border-slate-800/70 px-3 py-1.5 text-xs text-slate-600"
          >
            🔒 {m.title}
          </span>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-100">{state.levelTitle}</h2>
        <p className="mt-1 text-xs font-medium text-violet-400">{state.levelSubtitle}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{state.story}</p>
      </div>

      {/* 建议步骤 */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <h3 className="text-xs font-semibold text-slate-400">🧭 建议路径</h3>
        <ol className="mt-2 space-y-1.5">
          {state.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-400">
              <span className="shrink-0 font-mono text-violet-400">{i + 1}.</span>
              <span className="font-mono">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* 学习目标 */}
      <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
        <h3 className="text-xs font-semibold text-emerald-400">
          🎯 学习目标（{doneCount}/{state.goals.length}）
        </h3>
        <ul className="mt-2 space-y-2">
          {state.goals.map((g) => (
            <li key={g.label} className="flex items-start gap-2 text-xs leading-relaxed">
              <span
                className={
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] " +
                  (g.done ? "bg-emerald-500 text-slate-950" : "border border-slate-600 text-transparent")
                }
              >
                ✓
              </span>
              <span className={g.done ? "text-emerald-300" : "text-slate-400"}>{g.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 通关庆祝 */}
      {state.completed && (
        <div className="rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-950/60 to-violet-950/60 p-4 text-center">
          <div className="text-2xl">🎉🎉🎉</div>
          <div className="mt-1 text-sm font-bold text-amber-300">恭喜过关！目标全部达成</div>
          {!isLast && (
            <button
              onClick={() => onEnterLevel(nextLevelId(state.levelId))}
              className="mt-3 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
            >
              进入下一关 →
            </button>
          )}
          {isLast && (
            <div className="mt-2 text-xs text-amber-200/80">
              你已经通关全部新手关卡！去「速查手册」看看进阶场景吧 🏆
            </div>
          )}
        </div>
      )}

      {/* 提示 */}
      <div className="mt-auto space-y-2">
        {hints.slice(0, hintsShown).map((h, i) => (
          <div key={i} className="rounded-lg border border-sky-900/50 bg-sky-950/30 p-3 text-xs leading-relaxed text-sky-200">
            💡 提示 {i + 1}：{h}
          </div>
        ))}
        <div className="flex gap-2">
          {hintsShown < hints.length && (
            <button
              onClick={onHint}
              className="rounded-lg border border-sky-800 bg-sky-950/50 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-900/50"
            >
              看个提示（{hintsShown + 1}/{hints.length}）
            </button>
          )}
          <button
            onClick={onReset}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800"
          >
            ↻ 重置本关
          </button>
        </div>
      </div>
    </div>
  );
}

function nextLevelId(current: string): string {
  const idx = LEVEL_META.findIndex((m) => m.id === current);
  return LEVEL_META[Math.min(idx + 1, LEVEL_META.length - 1)].id;
}
