// 学员最近敲过的命令及输出（内存态，AI 助教上下文与"考古类"关卡判分用）
export interface HistoryEntry {
  cmd: string;
  output: string; // 已截断
}

const histories = new Map<string, HistoryEntry[]>();

const OUTPUT_CAP = 300;

export function getHistory(sessionId: string): HistoryEntry[] {
  return histories.get(sessionId) ?? [];
}

export function recordHistory(sessionId: string, input: string, output: string) {
  const h = histories.get(sessionId) ?? [];
  const trimmed = output.replace(/\s+\n/g, "\n").trim();
  h.push({
    cmd: input.trim(),
    output: trimmed.length > OUTPUT_CAP ? trimmed.slice(0, OUTPUT_CAP) + "…（截断）" : trimmed,
  });
  if (h.length > 40) h.shift();
  histories.set(sessionId, h);
}

export function clearHistory(sessionId: string) {
  histories.delete(sessionId);
}
