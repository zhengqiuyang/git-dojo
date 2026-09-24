"use client";

import { useEffect, useRef } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface TerminalOutput {
  output: string;
  clear?: boolean;
  error?: string;
  /** 命令执行后的最新分支名，用于立即刷新提示符 */
  branch?: string | null;
}

interface Props {
  onCommand: (cmd: string) => Promise<TerminalOutput>;
  branch: string | null;
  welcomeLines: string[];
  /** 变化时清屏并重新打印欢迎语（切换关卡时） */
  resetSignal: number;
}

function promptFor(branch: string | null): string {
  const b = branch ?? "no-repo";
  return `\r\n\x1b[1;32m练功房\x1b[0m \x1b[1;36m~/sandbox\x1b[0m \x1b[1;35m(${b})\x1b[0m \x1b[1;33m$\x1b[0m `;
}

/** 提示符的第一行（不带前导换行），用于欢迎语之后 */
function promptInline(branch: string | null): string {
  return promptFor(branch).replace(/^\r\n/, "");
}

export default function Terminal({ onCommand, branch, welcomeLines, resetSignal }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineRef = useRef("");
  const busyRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const branchRef = useRef(branch);
  const onCommandRef = useRef(onCommand);
  const welcomeRef = useRef(welcomeLines);
  const resetSignalRef = useRef(resetSignal);
  const lastWelcomeKeyRef = useRef<number | null>(null);

  branchRef.current = branch;
  onCommandRef.current = onCommand;
  welcomeRef.current = welcomeLines;
  resetSignalRef.current = resetSignal;

  const writeText = (t: string) => {
    termRef.current?.write(t.replace(/\r?\n/g, "\r\n"));
  };

  const showPrompt = (withNewline = true, branchOverride?: string | null) => {
    const term = termRef.current;
    if (!term) return;
    const b = branchOverride !== undefined ? branchOverride : branchRef.current;
    term.write(withNewline ? promptFor(b) : promptInline(b));
  };

  const renderWelcome = () => {
    const term = termRef.current;
    if (!term) return;
    const key = resetSignalRef.current;
    if (lastWelcomeKeyRef.current === key) return; // 该信号已渲染过，避免双重渲染
    lastWelcomeKeyRef.current = key;
    term.reset();
    writeText(welcomeRef.current.join("\n"));
    lineRef.current = "";
    showPrompt(false);
  };

  // 创建终端（仅一次）
  useEffect(() => {
    let disposed = false;
    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon: F } = await import("@xterm/addon-fit");
      if (disposed || !hostRef.current) return;

      const term = new Terminal({
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
        scrollback: 3000,
        convertEol: false,
        theme: {
          background: "#0b1020",
          foreground: "#d6e2f0",
          cursor: "#7dd3fc",
          selectionBackground: "#334155",
        },
      });
      const fit = new F();
      term.loadAddon(fit);
      term.open(hostRef.current);
      termRef.current = term;
      fitRef.current = fit;

      const doFit = () => {
        try {
          fit.fit();
        } catch {
          /* 容器尚未布局 */
        }
      };
      doFit();
      const ro = new ResizeObserver(doFit);
      ro.observe(hostRef.current);

      term.onData((data) => {
        if (busyRef.current) return;
        const line = lineRef.current;
        if (data === "\r") {
          // 回车提交
          term.write("\r\n");
          const cmd = line.trim();
          lineRef.current = "";
          if (!cmd) {
            showPrompt();
            return;
          }
          historyRef.current.unshift(cmd);
          if (historyRef.current.length > 100) historyRef.current.pop();
          historyIdxRef.current = -1;
          void submit(cmd);
          return;
        }
        if (data === "\x7f") {
          // 退格
          if (line.length > 0) {
            lineRef.current = line.slice(0, -1);
            term.write("\b \b");
          }
          return;
        }
        if (data === "\x03") {
          // Ctrl+C
          term.write("^C");
          lineRef.current = "";
          showPrompt();
          return;
        }
        if (data === "\x0c") {
          // Ctrl+L 清屏
          term.clear();
          showPrompt(false);
          return;
        }
        if (data === "\x1b[A" || data === "\x1b[B") {
          // 上下方向键翻历史
          const hist = historyRef.current;
          if (!hist.length) return;
          if (data === "\x1b[A") {
            historyIdxRef.current = Math.min(historyIdxRef.current + 1, hist.length - 1);
          } else {
            historyIdxRef.current = Math.max(historyIdxRef.current - 1, -1);
          }
          // 擦掉当前行
          term.write("\b \b".repeat(line.length));
          const next = historyIdxRef.current === -1 ? "" : hist[historyIdxRef.current];
          lineRef.current = next;
          term.write(next);
          return;
        }
        if (data.startsWith("\x1b")) return; // 忽略其他控制序列
        if (data.charCodeAt(0) >= 32) {
          lineRef.current = line + data;
          term.write(data);
        }
      });

      term.focus();
      // 终端就绪后立即渲染欢迎语，避免与外部 resetSignal 的时序竞态
      lastWelcomeKeyRef.current = null;
      renderWelcome();
    })();

    return () => {
      disposed = true;
      termRef.current?.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(cmd: string) {
    busyRef.current = true;
    let result: TerminalOutput;
    try {
      result = await onCommandRef.current(cmd);
    } catch {
      result = { output: "\x1b[31m网络或服务异常，请稍后重试\x1b[0m\n" };
    }
    busyRef.current = false;
    if (result.clear) {
      termRef.current?.clear();
      lastWelcomeKeyRef.current = null;
      renderWelcome();
    } else if (result.output) {
      writeText(result.output);
    }
    showPrompt(true, result.branch);
    termRef.current?.focus();
  }

  // 欢迎语 / 关卡切换时清屏
  useEffect(() => {
    renderWelcome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  return (
    <div
      className="h-full w-full overflow-hidden rounded-xl"
      onClick={() => termRef.current?.focus()}
      data-testid="terminal-host"
      ref={hostRef}
    />
  );
}
