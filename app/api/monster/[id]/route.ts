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

type Params = { id: string };
type RouteContext = { params: Params | Promise<Params> };

const REVALIDATE_SECONDS = 86400; // 24h
const SWARFARM_API_ROOT = "https://swarfarm.com/api/v2";

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const idNum = Number(params.id);

  if (!Number.isFinite(idNum) || idNum <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = `${SWARFARM_API_ROOT}/monsters/${idNum}/`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
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
