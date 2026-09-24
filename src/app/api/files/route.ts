import { NextResponse } from "next/server";
import fsp from "fs/promises";
import path from "path";
import { getSandbox, validSessionId } from "@/lib/sandbox";
import { buildState } from "@/lib/state";
import { resolveInside } from "@/lib/git";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 保存文件（文件编辑器用），返回刷新后的完整状态 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      path?: string;
      content?: string;
    };
    const sessionId = body.sessionId ?? "";
    if (!validSessionId(sessionId)) {
      return NextResponse.json({ error: "无效的会话" }, { status: 400 });
    }
    if (!body.path || typeof body.content !== "string") {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const sb = await getSandbox(sessionId);
    const target = resolveInside(sb.dir, body.path);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, body.content, "utf8");
    const state = await buildState(sb);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
