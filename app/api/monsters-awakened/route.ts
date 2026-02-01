type MonsterListItem = { id: number; name: string; element: string | null };

type SwarfarmMonster = {
  id: number;
  name: string;
  element: string | null;
  awaken_level: number;
};

type SwarfarmPagedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ApiResponse = { results: MonsterListItem[] };

const REVALIDATE_SECONDS = 86400; // 24h
const SWARFARM_FIRST_PAGE = "https://swarfarm.com/api/v2/monsters/?page=1";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`Swarfarm error ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}

async function fetchAllMonsters(): Promise<SwarfarmMonster[]> {
  const out: SwarfarmMonster[] = [];
  let nextUrl: string | null = SWARFARM_FIRST_PAGE;

  while (nextUrl) {
    // ✅ tipo explícito (resolve o ts(7022) de vez)
    const pageData: SwarfarmPagedResponse<SwarfarmMonster> =
      await fetchJson<SwarfarmPagedResponse<SwarfarmMonster>>(nextUrl);

    out.push(...pageData.results);
    nextUrl = pageData.next;
  }

  return out;
}

function toAwakenedList(monsters: SwarfarmMonster[]): MonsterListItem[] {
  return monsters
    .filter((m) => m.awaken_level > 0)
    .map((m) => ({ id: m.id, name: m.name, element: m.element }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function GET(): Promise<Response> {
  try {
    const all = await fetchAllMonsters();
    const results = toAwakenedList(all);

    const body: ApiResponse = { results };

    return Response.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
