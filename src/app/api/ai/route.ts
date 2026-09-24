import { NextResponse } from "next/server";
import { getSandbox, getHistory, validSessionId } from "@/lib/sandbox";
import { buildState } from "@/lib/state";
import { getLevel } from "@/lib/levels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `你是「Git 练功房」的 AI 助教。这是一个面向零基础新手的 Git 闯关学习平台：学员在真实沙盒里敲 git 命令，系统自动判分，右侧有实时分支图。

教学守则：
1. 引导优先：用提问和最小的提示引导学员自己想出来；只有学员明确要求答案时，才直接给出可执行的命令。
2. 务必结合「学员当前状态」里提供的真实仓库信息回答，不要空谈理论。
3. 全程中文，语气亲切、多鼓励，像一位耐心的学长；命令写进代码块。
4. 简短为主（一般不超过 200 字），一次只讲一个要点，避免信息过载。
5. 如果学员已经完成全部目标，先祝贺，再送一个相关的进阶小知识。`;

/** 把学员沙盒的实时状态拼成 AI 上下文 */
async function buildContext(sb: Awaited<ReturnType<typeof getSandbox>>): Promise<string> {
  const level = getLevel(sb.levelId);
  const st = await buildState(sb);

  const goals = st.goals
    .map((g) => `- [${g.done ? "已完成" : "未完成"}] ${g.label}`)
    .join("\n");
  const graph = st.graph.nodes
    .slice(0, 12)
    .map((n) => {
      const refs = n.refs.length ? ` (${n.refs.join(", ")})` : "";
      return `${n.hash}${refs} ${n.subject}`;
    })
    .join("\n");
  const hist = getHistory(sb.sessionId).slice(-10);
  const files = st.files.map((f) => `${f.path} [${f.status}]`).join("、");

  return [
    `当前关卡：${level?.title ?? sb.levelId}（主题：${level?.subtitle ?? ""}）`,
    `关卡剧情要点：${level?.story ?? ""}`,
    `学习目标：\n${goals || "（无）"}`,
    `全部目标已完成：${st.completed ? "是 🎉" : "否"}`,
    `当前分支：${st.branch ?? "（还没有提交）"}${st.conflict ? "｜⚠️ 正处于合并冲突中" : ""}`,
    `提交图（新→旧，最多 12 条）：\n${graph || "（还没有任何提交）"}`,
    `工作区文件：${files || "（空）"}`,
    `学员的操作轨迹（旧→新，含每步输出）：\n${
      hist.length
        ? hist.map((h) => `$ ${h.cmd}\n${h.output || "（无输出）"}`).join("\n")
        : "（还没敲过命令）"
    }`,
  ].join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId?: string; messages?: ChatMessage[] };
    const sessionId = body.sessionId ?? "";
    if (!validSessionId(sessionId)) {
      return NextResponse.json({ error: "无效的会话" }, { status: 400 });
    }
    const messages = (body.messages ?? [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12);

    const cfg = {
      baseUrl: (req.headers.get("x-ai-base") || process.env.AI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/+$/, ""),
      apiKey: req.headers.get("x-ai-key") || process.env.AI_API_KEY || "",
      model: req.headers.get("x-ai-model") || process.env.AI_MODEL || "glm-4-flash",
    };
    if (!cfg.apiKey) {
      return NextResponse.json(
        {
          error:
            "还没有配置 AI 助教的 API Key。点击面板右上角 ⚙️ 填入 Key 即可（支持智谱 GLM / DeepSeek / Kimi / OpenAI 等任何 OpenAI 兼容接口）；也可以在服务端 .env 里配置 AI_API_KEY。",
        },
        { status: 400 }
      );
    }

    const sb = await getSandbox(sessionId);
    const context = await buildContext(sb);

    const upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        temperature: 0.6,
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n【学员当前状态】\n${context}` },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `AI 服务返回 ${upstream.status}：${detail.slice(0, 300)}` },
        { status: 502 }
      );
    }

    // 上游是 SSE，这里解析出文本增量，以纯文本流式转发给前端
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buf = "";
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const data = t.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const j = JSON.parse(data);
                const delta: unknown = j?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                /* 忽略无法解析的行 */
              }
            }
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `连接 AI 服务失败：${(e as Error).message}` }, { status: 502 });
  }
}
