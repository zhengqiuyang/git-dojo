/**
 * 本地 mock 的 OpenAI 兼容流式接口，用于端到端验证 AI 助教链路。
 * 启动：node scripts/mock-ai-server.mjs   （端口 8787）
 */
import http from "http";

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url.includes("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    let sysInfo = "（未读到系统上下文）";
    try {
      const j = JSON.parse(body);
      const sys = j.messages?.find((m) => m.role === "system")?.content ?? "";
      // 验证服务端确实注入了学员仓库状态
      sysInfo = sys.includes("学员当前状态")
        ? `我看到了你的仓库状态（含${sys.includes("当前关卡") ? "关卡" : ""}${sys.includes("最近敲过的命令") ? "、命令历史" : ""}）`
        : "系统上下文缺失！";
    } catch {
      /* ignore */
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const reply = `收到！这是一个来自 mock 服务器的流式回复。${sysInfo}。\n你现在的目标是先观察 git status 的输出，再决定下一步。`;
    const chunks = reply.match(/[\s\S]{1,12}/g) ?? [];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        res.write("data: [DONE]\n\n");
        res.end();
        clearInterval(timer);
        return;
      }
      const payload = { choices: [{ delta: { content: chunks[i++] } }] };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 40);
  });
});

server.listen(8787, () => console.log("mock AI server on http://localhost:8787"));
