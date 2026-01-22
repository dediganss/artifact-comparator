import { NextResponse } from "next/server";

type SwarfarmMonster = {
  id: number;
  name: string;
  awaken_level: number;
  element: string | null;
  speed: number;
  max_lvl_hp: number;
  max_lvl_attack: number;
  max_lvl_defense: number;
  leader_skill: number | null;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;

  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: `Invalid id: ${idStr}` }, { status: 400 });
  }

  const res = await fetch(`https://swarfarm.com/api/v2/monsters/${id}/`, {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `SWARFARM monster fetch failed: ${res.status}` }, { status: 502 });
  }

  const m = (await res.json()) as SwarfarmMonster;

  return NextResponse.json({
    id: Number(m.id),
    name: String(m.name),
    awaken_level: Number(m.awaken_level),
    element: m.element === null ? null : String(m.element),
    speed: Number(m.speed),
    max_lvl_hp: Number(m.max_lvl_hp),
    max_lvl_attack: Number(m.max_lvl_attack),
    max_lvl_defense: Number(m.max_lvl_defense),
    leader_skill: m.leader_skill === null ? null : Number(m.leader_skill),
  });
}
