import { NextResponse } from "next/server";
import { getSandbox, validSessionId } from "@/lib/sandbox";
import { buildState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId?: string; levelId?: string };
    const sessionId = body.sessionId ?? "";
    if (!validSessionId(sessionId)) {
      return NextResponse.json({ error: "无效的会话" }, { status: 400 });
    }
    const sb = await getSandbox(sessionId, body.levelId);
    const state = await buildState(sb);
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
