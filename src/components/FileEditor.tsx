"use client";

import { useEffect, useState } from "react";
import type { FileEntry } from "@/lib/state";

interface Props {
  files: FileEntry[];
  conflict: boolean;
  onSave: (path: string, content: string) => Promise<void>;
}

const BADGE_STYLE: Record<string, string> = {
  未跟踪: "bg-amber-900/60 text-amber-300",
  "已暂存(新)": "bg-emerald-900/60 text-emerald-300",
  已修改: "bg-sky-900/60 text-sky-300",
  已删除: "bg-rose-900/60 text-rose-300",
  冲突中: "bg-rose-700/80 text-white",
  已提交: "bg-slate-800 text-slate-400",
  已重命名: "bg-sky-900/60 text-sky-300",
};

export default function FileEditor({ files, conflict, onSave }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // 文件列表刷新时，同步未编辑文件的内容
  useEffect(() => {
    if (dirty) return;
    const f = files.find((x) => x.path === selected);
    if (f) setDraft(f.content);
  }, [files, selected, dirty]);

  useEffect(() => {
    if (!selected && files.length > 0) {
      setSelected(files[0].path);
      setDraft(files[0].content);
    }
  }, [files, selected]);

  const current = files.find((f) => f.path === selected);
  const hasMarkers =
    current != null &&
    (current.content.includes("<<<<<<<") || current.content.includes(">>>>>>>"));

  async function save() {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      await onSave(selected, draft);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-slate-950/60 text-sm text-slate-500">
        沙盒里还没有文件（echo 文本 &gt; 文件名 可以创建一个）
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 rounded-xl bg-slate-950/60 p-3">
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => {
              setSelected(f.path);
              setDraft(f.content);
              setDirty(false);
            }}
            className={
              "flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] transition " +
              (f.path === selected
                ? "bg-violet-600/80 text-white"
                : "bg-slate-800/70 text-slate-300 hover:bg-slate-700")
            }
          >
            {f.path}
            <span className={"rounded px-1 text-[10px] " + (BADGE_STYLE[f.status] ?? BADGE_STYLE["已提交"])}>
              {f.status}
            </span>
          </button>
        ))}
      </div>

      {conflict && hasMarkers && (
        <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs leading-relaxed text-rose-200">
          ⚠️ 这个文件里有冲突标记（&lt;&lt;&lt;&lt;&lt;&lt;&lt; / ======= / &gt;&gt;&gt;&gt;&gt;&gt;&gt;）。
          删掉标记、留下你想要的最终内容，然后 <span className="font-mono">git add</span> +{" "}
          <span className="font-mono">git commit</span> 完成合并。
        </div>
      )}

      <textarea
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        className="min-h-0 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none focus:border-violet-600"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={
            "rounded-lg px-4 py-1.5 text-xs font-bold transition " +
            (dirty && !saving
              ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              : "cursor-not-allowed bg-slate-800 text-slate-500")
          }
        >
          {saving ? "保存中…" : dirty ? "保存文件" : "已保存"}
        </button>
        <span className="text-[11px] text-slate-500">保存后还要 git add + git commit 才算提交哦</span>
      </div>
    </div>
  );
}
