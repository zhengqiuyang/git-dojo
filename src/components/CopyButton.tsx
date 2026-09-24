"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* 剪贴板不可用 */
        }
      }}
      className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-200"
    >
      {copied ? "✓ 已复制" : "复制"}
    </button>
  );
}
