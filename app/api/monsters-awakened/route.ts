import { NextResponse } from "next/server";

type SwarfarmMonsterListResponse = {
  next: string | null;
  results: Array<{
    id: number;
    name: string;
    element: string | null;
  }>;
};

export async function GET() {
  try {
    let url: string | null = "https://swarfarm.com/api/v2/monsters/?awaken_level=1";
    const all: Array<{ id: number; name: string; element: string | null }> = [];

    while (url) {
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // 24h cache
      if (!res.ok) {
        return NextResponse.json(
          { error: `SWARFARM monsters fetch failed: ${res.status}` },
          { status: 502 }
        );
      }

      const data = (await res.json()) as SwarfarmMonsterListResponse;

      for (const m of data.results) {
        all.push({
          id: Number(m.id),
          name: String(m.name),
          element: m.element === null ? null : String(m.element),
        });
      }

      url = data.next;
    }

    // Ordena por nome, e depois por elemento (pra ficar mais previsível)
    all.sort((a, b) => {
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      return (a.element ?? "").localeCompare(b.element ?? "");
    });

    return NextResponse.json({ results: all });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
