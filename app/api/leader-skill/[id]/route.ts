import { NextResponse } from "next/server";

type SwarfarmLeaderSkillListResponse = {
  next: string | null;
  results: Array<{
    id: number;
    attribute: string;
    amount: number;
    area: string;
    element: string | null;
  }>;
};

export async function GET() {
  try {
    let url: string | null = "https://swarfarm.com/api/v2/leader-skills/";
    const all: Array<{
      id: number;
      attribute: string;
      amount: number;
      area: string;
      element: string | null;
    }> = [];

    while (url) {
      const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // 24h
      if (!res.ok) {
        return NextResponse.json(
          { error: `SWARFARM leader-skills fetch failed: ${res.status}` },
          { status: 502 }
        );
      }

      const data = (await res.json()) as SwarfarmLeaderSkillListResponse;

      for (const ls of data.results) {
        all.push({
          id: Number(ls.id),
          attribute: String(ls.attribute),
          amount: Number(ls.amount),
          area: String(ls.area),
          element: ls.element === null ? null : String(ls.element),
        });
      }

      url = data.next;
    }

    return NextResponse.json({ results: all });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
