export const revalidate = 60 * 60 * 24; // 24h
export const dynamic = "force-static";

type MonsterDetail = {
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

const SWARFARM_API_ROOT = "https://swarfarm.com/api/v2";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
): Promise<Response> {
  const id = Number(ctx.params.id);

  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = `${SWARFARM_API_ROOT}/monsters/${id}/`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });

    if (!res.ok) {
      return Response.json(
        { error: `Swarfarm error ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as MonsterDetail;

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
