// app/api/swarfarm/route.ts
import { NextRequest, NextResponse } from "next/server";

const BASE = "https://swarfarm.com/api/v2/";
const ALLOW = new Set([
  "bestiary",         // se vocês usam bestiary HTML
  "monsters",         // exemplo de endpoint REST
  "bestiary/monsters" // se existir no formato que vocês usam
]);

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path")?.replace(/^\/+/, "") ?? "";
  const [top] = path.split("/");

  if (!ALLOW.has(top) && !ALLOW.has(`${top}/${path.split("/")[1] ?? ""}`)) {
    return NextResponse.json({ error: "Endpoint não permitido" }, { status: 400 });
  }

  const url = new URL(path, BASE);

  const res = await fetch(url.toString(), {
    // cache no edge/server (ajuste conforme necessidade)
    next: { revalidate: 60 * 60 }, // 1h
    headers: { "User-Agent": "artifact-comparator" }
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": contentType }
  });
}
