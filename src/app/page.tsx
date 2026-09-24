"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Terminal, { type TerminalOutput } from "@/components/Terminal";
import GraphView from "@/components/GraphView";
import TaskPanel from "@/components/TaskPanel";
import FileEditor from "@/components/FileEditor";
import ChatPanel from "@/components/ChatPanel";
import { LEVEL_META } from "@/lib/levelMeta";
import type { DojoState } from "@/lib/state";

const SESSION_KEY = "git-dojo-session";

export default function Home() {
  const [state, setState] = useState<DojoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [tab, setTab] = useState<"graph" | "files" | "ai">("graph");
  const sessionRef = useRef<string | null>(null);
  const levelRef = useRef<string | null>(null);

  const post = useCallback(async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "请求失败");
    return data;
  }, []);

  // 首次加载：恢复/创建会话
  useEffect(() => {
    (async () => {
      try {
        let sid = localStorage.getItem(SESSION_KEY);
        if (!sid) {
          sid = crypto.randomUUID();
          localStorage.setItem(SESSION_KEY, sid);
        }
        sessionRef.current = sid;
        const savedLevel = localStorage.getItem(SESSION_KEY + "-level") ?? undefined;
        const data = (await post("/api/state", { sessionId: sid, levelId: savedLevel })) as DojoState;
        setState(data);
        levelRef.current = data.levelId;
        setResetSignal((n) => n + 1);
      } catch (e) {
        setError(String((e as Error).message));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommand = useCallback(
    async (cmd: string): Promise<TerminalOutput> => {
      if (!sessionRef.current) return { output: "会话尚未就绪，请稍候…\n" };
      const data = await post("/api/exec", { sessionId: sessionRef.current, command: cmd });
      if (data.state) {
        setState(data.state as DojoState);
        levelRef.current = (data.state as DojoState).levelId;
        localStorage.setItem(SESSION_KEY + "-level", (data.state as DojoState).levelId);
      }
      if (data.error) return { output: `❌ ${data.error}\n` };
      return { output: data.output ?? "", clear: data.clear, branch: data.state?.branch };
    },
    [post]
  );

  const enterLevel = useCallback(
    async (levelId: string) => {
      if (!sessionRef.current) return;
      try {
        const data = (await post("/api/level", { sessionId: sessionRef.current, levelId })) as DojoState;
        setState(data);
        levelRef.current = levelId;
        localStorage.setItem(SESSION_KEY + "-level", levelId);
        setHintsShown(0);
        setTab("graph");
        setResetSignal((n) => n + 1);
      } catch (e) {
        setError(String((e as Error).message));
      }
    },
    [post]
  );

  const saveFile = useCallback(
    async (path: string, content: string) => {
      if (!sessionRef.current) return;
      const data = await post("/api/files", { sessionId: sessionRef.current, path, content });
      if (data.state) setState(data.state as DojoState);
    },
    [post]
  );

  const doneCount = state ? LEVEL_META.filter((_, i) => i < LEVEL_META.indexOf(LEVEL_META.find((m) => m.id === state.levelId)!) + (state.completed ? 1 : 0)).length : 0;

  const welcomeLines = state
    ? [
        "👋 欢迎来到 Git 练功房 —— 一个专门给新手的 Git 闯关乐园",
        `📍 当前关卡：${state.levelTitle}`,
        "⌨️  在下面输入 git 命令开始闯关（不确定做什么时，先敲 git status 试试）",
        "❓ 输入 help 查看练习环境支持的所有命令；右侧「分支图」会实时显示仓库状态",
        "",
      ]
    : ["正在连接练功房…"];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥋</span>
            <div>
              <h1 className="text-base font-bold text-slate-100">Git 练功房</h1>
              <p className="text-[11px] text-slate-500">专为新手打造的 Git 闯关学习平台</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
                  style={{ width: `${(doneCount / LEVEL_META.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">
                {doneCount}/{LEVEL_META.length} 关
              </span>
            </div>
            <Link
              href="/cheatsheet"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
            >
              📖 场景速查手册
            </Link>
          </div>
        </div>
      </header>

      {/* 主体 */}
      <main className="mx-auto w-full max-w-[1700px] flex-1 p-4">
        {error && (
          <div className="rounded-lg border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-200">
            出错了：{error}（试试刷新页面，或重启服务）
          </div>
        )}
        {!state && !error && (
          <div className="flex h-96 items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="animate-pulse text-4xl">🥋</div>
              <p className="mt-3 text-sm">正在为你准备练习沙盒…</p>
            </div>
          </div>
        )}
        {state && (
          <div className="grid grid-cols-1 gap-4 xl:h-[calc(100vh-136px)] xl:grid-cols-12">
            {/* 左：任务面板 */}
            <section className="min-h-[520px] xl:col-span-4 xl:h-full">
              <TaskPanel
                state={state}
                hintsShown={hintsShown}
                onHint={() => setHintsShown((n) => n + 1)}
                onEnterLevel={enterLevel}
                onReset={() => enterLevel(state.levelId)}
              />
            </section>

            {/* 中：终端 */}
            <section className="min-h-[520px] xl:col-span-5 xl:h-full">
              <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-[#0b1020] p-2">
                <div className="flex items-center gap-2 px-2 pb-2 pt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs text-slate-500">沙盒终端（真实的 Git 在这里运行）</span>
                  {state.conflict && (
                    <span className="ml-auto rounded bg-rose-700/80 px-2 py-0.5 text-[11px] font-bold text-white">
                      ⚠️ 合并冲突中
                    </span>
                  )}
                </div>
                <div className="min-h-0 flex-1">
                  <Terminal
                    onCommand={handleCommand}
                    branch={state.branch}
                    welcomeLines={welcomeLines}
                    resetSignal={resetSignal}
                  />
                </div>
              </div>
            </section>

            {/* 右：分支图 / 文件 */}
            <section className="min-h-[520px] xl:col-span-3 xl:h-full">
              <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                <div className="mb-2 flex gap-1 px-1">
                  <button
                    onClick={() => setTab("graph")}
                    className={
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                      (tab === "graph" ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800")
                    }
                  >
                    分支图
                  </button>
                  <button
                    onClick={() => setTab("files")}
                    className={
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                      (tab === "files" ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800")
                    }
                  >
                    文件 {state.files.length > 0 && `(${state.files.length})`}
                  </button>
                  <button
                    onClick={() => setTab("ai")}
                    className={
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                      (tab === "ai" ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800")
                    }
                  >
                    🤖 AI 助教
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  {tab === "graph" ? (
                    <GraphView graph={state.graph} />
                  ) : tab === "files" ? (
                    <FileEditor files={state.files} conflict={state.conflict} onSave={saveFile} />
                  ) : (
                    <ChatPanel sessionId={sessionRef.current ?? ""} levelId={state.levelId} />
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 px-5 py-3 text-center text-[11px] text-slate-600">
        所有练习都在独立的沙盒仓库中进行，放心折腾，坏了就点「重置本关」。
      </footer>
    </div>
  );
}
