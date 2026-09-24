"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface AiCfg {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const CFG_KEY = "git-dojo-ai-cfg";

const DEFAULT_CFG: AiCfg = {
  baseUrl: "",
  apiKey: "",
  model: "",
};

const QUICK_ACTIONS = [
  { label: "🧭 我卡住了", text: "我卡住了，结合我现在的仓库状态告诉我下一步该往哪个方向想（先别给完整命令）。" },
  { label: "🔍 解释上一条", text: "解释一下我最近敲的那条命令：它做了什么、仓库里发生了什么变化？" },
  { label: "💡 给个小提示", text: "给当前关卡一个最小的提示，不要直接给完整命令。" },
  { label: "🧵 复盘我的轨迹", text: "复盘我最近的操作轨迹（命令和输出你都看得到）：我从哪一步开始走偏？现在该怎么纠正？先讲结论，再一步步说。" },
];

const GREETING =
  "👋 我是 AI 助教，看得见你的仓库：关卡进度、提交图、工作区、最近敲的命令我都知道。\n卡住就点下面的快捷按钮，或者直接问我。放心，我不会直接剧透答案，除非你求我 😉";

function loadCfg(): AiCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {
    /* 忽略损坏的本地数据 */
  }
  return DEFAULT_CFG;
}

export default function ChatPanel({ sessionId, levelId }: { sessionId: string; levelId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<AiCfg>(DEFAULT_CFG);
  const [draft, setDraft] = useState<AiCfg>(DEFAULT_CFG);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCfg(loadCfg());
  }, []);

  // 切换关卡时重置对话
  useEffect(() => {
    setMessages([{ role: "assistant", content: GREETING }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || !sessionId) return;
    const next: Msg[] = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cfg.baseUrl) headers["x-ai-base"] = cfg.baseUrl;
      if (cfg.apiKey) headers["x-ai-key"] = cfg.apiKey;
      if (cfg.model) headers["x-ai-model"] = cfg.model;

      const history = messages.filter((m) => m.content !== GREETING);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId, messages: [...history, { role: "user", content }] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${data?.error ?? `请求失败（${res.status}）`}` };
        setMessages([...next]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        next[next.length - 1] = { role: "assistant", content: acc };
        setMessages([...next]);
      }
      if (!acc) {
        next[next.length - 1] = { role: "assistant", content: "（AI 没有返回内容，请检查模型名称是否正确）" };
        setMessages([...next]);
      }
    } catch (e) {
      next[next.length - 1] = { role: "assistant", content: `⚠️ 网络异常：${(e as Error).message}` };
      setMessages([...next]);
    } finally {
      setBusy(false);
    }
  }

  function saveCfg() {
    setCfg(draft);
    localStorage.setItem(CFG_KEY, JSON.stringify(draft));
    setShowSettings(false);
  }

  return (
    <div className="relative flex h-full flex-col rounded-xl bg-slate-950/60">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-xs font-semibold text-slate-300">🤖 AI 助教 · 看得见你的仓库</span>
        <button
          onClick={() => {
            setDraft(cfg);
            setShowSettings(true);
          }}
          className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
        >
          ⚙️ 设置
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed " +
                (m.role === "user"
                  ? "bg-violet-600/90 text-white"
                  : "border border-slate-800 bg-slate-900/80 text-slate-300")
              }
            >
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      {/* 快捷操作 */}
      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q.label}
            disabled={busy}
            onClick={() => send(q.text)}
            className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* 输入区 */}
      <div className="flex gap-2 border-t border-slate-800 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) send(input);
          }}
          placeholder="问点什么…"
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-600"
        />
        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
          className={
            "rounded-lg px-3 py-1.5 text-xs font-bold transition " +
            (busy || !input.trim()
              ? "cursor-not-allowed bg-slate-800 text-slate-500"
              : "bg-violet-600 text-white hover:bg-violet-500")
          }
        >
          发送
        </button>
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSettings(false)}>
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-200">AI 助教设置</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              支持任何 OpenAI 兼容接口（智谱 GLM / DeepSeek / Kimi / OpenAI / 本地 Ollama）。
              Key 只存在你的浏览器本地，不会上传到任何地方。
            </p>
            {(
              [
                ["baseUrl", "接口地址（Base URL）", "https://open.bigmodel.cn/api/paas/v4"],
                ["apiKey", "API Key（必填）", "sk-…"],
                ["model", "模型名", "glm-4-flash / deepseek-chat / …"],
              ] as const
            ).map(([key, label, ph]) => (
              <label key={key} className="mt-3 block">
                <span className="text-[11px] text-slate-400">{label}</span>
                <input
                  value={draft[key]}
                  type={key === "apiKey" ? "password" : "text"}
                  placeholder={ph}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-violet-600"
                />
              </label>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
              >
                取消
              </button>
              <button
                onClick={saveCfg}
                disabled={!draft.apiKey.trim()}
                className={
                  "rounded-lg px-4 py-1.5 text-xs font-bold " +
                  (draft.apiKey.trim()
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "cursor-not-allowed bg-slate-800 text-slate-500")
                }
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
