"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* =======================
   Types
======================= */

type Stats = { hp: number; atk: number; def: number; spd: number };

type PercentStatsStr = { hp: string; atk: string; def: string; spd: string };

type MonsterListItem = { id: number; name: string; element: string | null };

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

type SwarfarmMonsterSearchResponse = { results: MonsterListItem[] };

type LeaderAttrUI = "None" | "HP" | "ATK" | "DEF" | "SPD";
type LeaderChoice = { attr: LeaderAttrUI; amount: number };

type ArtifactFlatOption = "" | "DEF" | "ATK" | "HP";

/* =======================
   Constants
======================= */

const TOWERS: Stats = { hp: 0.2, atk: 0.41, def: 0.2, spd: 0.15 };
const SIEGE_BONUS: Stats = { hp: 0.2, atk: 0.2, def: 0.2, spd: 0 };

const LEADER_VALUES: Record<Exclude<LeaderAttrUI, "None">, number[]> = {
  HP: [15, 17, 18, 21, 22, 24, 25, 28, 30, 33, 38, 40, 44, 45, 50],
  ATK: [15, 18, 20, 21, 22, 23, 25, 28, 30, 31, 33, 35, 38, 40, 44, 45],
  DEF: [20, 21, 22, 25, 27, 28, 30, 33, 38, 40, 44, 50],
  SPD: [10, 13, 15, 16, 17, 19, 20, 21, 23, 24, 28, 30, 33],
};

const ARTIFACT_FLAT_MAP: Record<ArtifactFlatOption, Stats> = {
  "": { hp: 0, atk: 0, def: 0, spd: 0 },
  DEF: { hp: 0, atk: 0, def: 100, spd: 0 },
  ATK: { hp: 0, atk: 100, def: 0, spd: 0 },
  HP: { hp: 1500, atk: 0, def: 0, spd: 0 },
};

const ARTIFACT_OPTIONS: ArtifactFlatOption[] = ["", "DEF", "ATK", "HP"];
const PLACEHOLDER_SELECT = "Selecionar…";

/* =======================
   Helpers
======================= */

function fmt(n: number) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function displayMonsterName(m: MonsterListItem | MonsterDetail | null) {
  if (!m) return "";
  const el = m.element ?? "";
  return el ? `${m.name} (${el})` : m.name;
}

function parseDecimal(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed.replace(/[^\d,.\-+]/g, "");
  const normalized = cleaned.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function percentStringsToNumbers(p: PercentStatsStr): Stats {
  return {
    hp: parseDecimal(p.hp),
    atk: parseDecimal(p.atk),
    def: parseDecimal(p.def),
    spd: parseDecimal(p.spd),
  };
}

function leaderPct(choice: LeaderChoice): Stats {
  if (choice.attr === "None" || !Number.isFinite(choice.amount) || choice.amount <= 0) {
    return { hp: 0, atk: 0, def: 0, spd: 0 };
  }
  const p = choice.amount / 100;
  switch (choice.attr) {
    case "HP":
      return { hp: p, atk: 0, def: 0, spd: 0 };
    case "ATK":
      return { hp: 0, atk: p, def: 0, spd: 0 };
    case "DEF":
      return { hp: 0, atk: 0, def: p, spd: 0 };
    case "SPD":
      return { hp: 0, atk: 0, def: 0, spd: p };
    default:
      return { hp: 0, atk: 0, def: 0, spd: 0 };
  }
}

function sumArtifactFlats(picks: ArtifactFlatOption[]): Stats {
  return picks.reduce(
    (acc, pick) => {
      const add = ARTIFACT_FLAT_MAP[pick];
      return {
        hp: acc.hp + add.hp,
        atk: acc.atk + add.atk,
        def: acc.def + add.def,
        spd: acc.spd + add.spd,
      };
    },
    { hp: 0, atk: 0, def: 0, spd: 0 }
  );
}

function calcTotals(
  monster: MonsterDetail,
  leader: LeaderChoice,
  bonus: Stats,
  isSiege: boolean,
  artifactFlat: Stats
) {
  const lp = leaderPct(leader);
  const siege = isSiege ? SIEGE_BONUS : { hp: 0, atk: 0, def: 0, spd: 0 };

  const total: Stats = {
    hp: monster.max_lvl_hp * (1 + TOWERS.hp + lp.hp + siege.hp) + bonus.hp + artifactFlat.hp,
    atk: monster.max_lvl_attack * (1 + TOWERS.atk + lp.atk + siege.atk) + bonus.atk + artifactFlat.atk,
    def: monster.max_lvl_defense * (1 + TOWERS.def + lp.def + siege.def) + bonus.def + artifactFlat.def,
    spd: monster.speed * (1 + TOWERS.spd + lp.spd + siege.spd) + bonus.spd + artifactFlat.spd,
  };

  return { total };
}

function calcDamageFromPct(total: Stats, pct: Stats) {
  const hp = total.hp * (pct.hp / 100);
  const atk = total.atk * (pct.atk / 100);
  const def = total.def * (pct.def / 100);
  const spd = total.spd * (pct.spd / 100);
  return { hp, atk, def, spd, total: hp + atk + def + spd };
}

function flatLabel(v: ArtifactFlatOption) {
  if (v === "") return null;
  if (v === "DEF") return { main: "DEF", bonus: "(+100)" };
  if (v === "ATK") return { main: "ATK", bonus: "(+100)" };
  return { main: "HP", bonus: "(+1500)" };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* =======================
   Page
======================= */

export default function Page() {
  const [monsterPick, setMonsterPick] = useState<MonsterListItem | null>(null);
  const [monster, setMonster] = useState<MonsterDetail | null>(null);

  const [isSiege, setIsSiege] = useState(false);
  const [leader, setLeader] = useState<LeaderChoice>({ attr: "None", amount: 0 });

  const [bonus, setBonus] = useState<Stats>({ hp: 0, atk: 0, def: 0, spd: 0 });

  const [pctA, setPctA] = useState<PercentStatsStr>({ hp: "", atk: "", def: "", spd: "" });
  const [pctB, setPctB] = useState<PercentStatsStr>({ hp: "", atk: "", def: "", spd: "" });

  const [artifactAFlats, setArtifactAFlats] = useState<[ArtifactFlatOption, ArtifactFlatOption]>(["", ""]);
  const [artifactBFlats, setArtifactBFlats] = useState<[ArtifactFlatOption, ArtifactFlatOption]>(["", ""]);

  // ===== Auto-fit (sem setState dentro do effect) =====
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastScaleRef = useRef<number>(1);

  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    let raf = 0;

    const applyScale = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const frameW = frame.clientWidth || 1;
        const frameH = frame.clientHeight || 1;

        const contentW = content.scrollWidth || 1;
        const contentH = content.scrollHeight || 1;

        const safety = 0.98;
        const sW = (frameW / contentW) * safety;
        const sH = (frameH / contentH) * safety;

        const next = clamp(Math.min(1, sW, sH), 0.78, 1);
        const rounded = Number(next.toFixed(3));

        if (Math.abs(rounded - lastScaleRef.current) > 0.001) {
          lastScaleRef.current = rounded;
          content.style.transformOrigin = "top center";
          content.style.transform = `scale(${rounded})`;
        }
      });
    };

    applyScale();

    const onResize = () => applyScale();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    let roFrame: ResizeObserver | null = null;
    let roContent: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      roFrame = new ResizeObserver(() => applyScale());
      roContent = new ResizeObserver(() => applyScale());
      roFrame.observe(frame);
      roContent.observe(content);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      roFrame?.disconnect();
      roContent?.disconnect();
    };
  }, [monster]);

  // ===== Fetch monster detail =====
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!monsterPick) {
        setMonster(null);
        return;
      }
      const res = await fetch(`/api/monster/${monsterPick.id}`);
      const data = (await res.json()) as MonsterDetail;
      if (!alive) return;
      setMonster(data);
    })();

    return () => {
      alive = false;
    };
  }, [monsterPick]);

  const result = useMemo(() => {
    if (!monster) return null;

    const flatA = sumArtifactFlats(artifactAFlats);
    const flatB = sumArtifactFlats(artifactBFlats);

    const { total: totalA } = calcTotals(monster, leader, bonus, isSiege, flatA);
    const { total: totalB } = calcTotals(monster, leader, bonus, isSiege, flatB);

    const A = calcDamageFromPct(totalA, percentStringsToNumbers(pctA));
    const B = calcDamageFromPct(totalB, percentStringsToNumbers(pctB));

    const winner = A.total > B.total ? "A" : A.total < B.total ? "B" : "TIE";
    return { totalA, totalB, A, B, winner };
  }, [monster, leader, bonus, isSiege, pctA, pctB, artifactAFlats, artifactBFlats]);

  return (
    <main className="h-[100dvh] overflow-hidden overscroll-none bg-slate-950 text-slate-200">
      <div ref={frameRef} className="mx-auto h-full max-w-5xl p-4 md:p-8">
        <div ref={contentRef} className="w-full">
          {/* Header */}
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Comparador de Artefatos</h1>
            </div>

            {/* Siege toggle */}
            <div className="mt-1 flex items-center gap-3">
              <span className="text-sm text-slate-300">Siege War?</span>
              <button
                type="button"
                role="switch"
                aria-checked={isSiege}
                onClick={() => setIsSiege((v) => !v)}
                className={`relative h-7 w-12 rounded-full border transition-colors ${
                  isSiege ? "border-emerald-700 bg-emerald-900/40" : "border-slate-700 bg-slate-900"
                }`}
              >
                <span
                  className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-200 transition-all ${
                    isSiege ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </header>

          {/* Monster picker */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
            <MonsterPicker value={monsterPick} onChange={setMonsterPick} />
          </div>

          {monster && (
            <>
              {/* Leader */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-slate-100">Leader</h2>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* Attr */}
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-slate-400">Atributo</span>
                    <select
                      className={`rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 outline-none ${
                        leader.attr === "None" ? "text-slate-500" : "text-slate-100"
                      }`}
                      value={leader.attr}
                      onChange={(e) => {
                        const v = e.target.value as LeaderAttrUI;
                        setLeader({ attr: v, amount: 0 });
                      }}
                    >
                      <option value="None">{PLACEHOLDER_SELECT}</option>
                      <option value="HP">HP</option>
                      <option value="ATK">ATK</option>
                      <option value="DEF">DEF</option>
                      <option value="SPD">SPD</option>
                    </select>
                  </label>

                  {/* Value */}
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-slate-400">Valor</span>
                    <div
                      className={`flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 ${
                        leader.attr === "None" ? "bg-slate-950/40 opacity-60" : "bg-slate-900"
                      }`}
                    >
                      <select
                        className={`w-full rounded-md bg-slate-900 outline-none disabled:text-slate-500 ${
                          leader.attr === "None" || leader.amount === 0 ? "text-slate-500" : "text-slate-100"
                        }`}
                        value={leader.amount}
                        disabled={leader.attr === "None"}
                        onChange={(e) => setLeader((s) => ({ ...s, amount: Number(e.target.value) || 0 }))}
                      >
                        <option value={0}>{PLACEHOLDER_SELECT}</option>
                        {leader.attr === "None"
                          ? null
                          : LEADER_VALUES[leader.attr].map((v) => (
                              <option key={v} value={v}>
                                {v}%
                              </option>
                            ))}
                      </select>
                    </div>
                  </label>
                </div>
              </div>

              {/* Inputs */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card title="Bônus de runas (Sem artefato)">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="HP bônus" v={bonus.hp} set={(v) => setBonus((s) => ({ ...s, hp: v }))} />
                    <NumberInput label="ATK bônus" v={bonus.atk} set={(v) => setBonus((s) => ({ ...s, atk: v }))} />
                    <NumberInput label="DEF bônus" v={bonus.def} set={(v) => setBonus((s) => ({ ...s, def: v }))} />
                    <NumberInput label="SPD bônus" v={bonus.spd} set={(v) => setBonus((s) => ({ ...s, spd: v }))} />
                  </div>
                </Card>

                <Card title="Artefato A (% dano por atributo)">
                  <ArtifactInputs s={pctA} set={setPctA} />
                  <div className="mt-4">
                    <ArtifactFlatPickers picks={artifactAFlats} setPicks={setArtifactAFlats} />
                  </div>
                </Card>

                <Card title="Artefato B (% dano por atributo)">
                  <ArtifactInputs s={pctB} set={setPctB} />
                  <div className="mt-4">
                    <ArtifactFlatPickers picks={artifactBFlats} setPicks={setArtifactBFlats} />
                  </div>
                </Card>
              </div>

              {/* Results */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                {result ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ResultBar
                        title="Artefato A"
                        total={result.A.total}
                        tone={result.winner === "A" ? "good" : result.winner === "B" ? "bad" : "neutral"}
                      />
                      <ResultBar
                        title="Artefato B"
                        total={result.B.total}
                        tone={result.winner === "B" ? "good" : result.winner === "A" ? "bad" : "neutral"}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <TotalsPanel
                        rows={[
                          { label: "HP total (A / B)", value: `${fmt(result.totalA.hp)} / ${fmt(result.totalB.hp)}` },
                          { label: "ATK total (A / B)", value: `${fmt(result.totalA.atk)} / ${fmt(result.totalB.atk)}` },
                        ]}
                      />
                      <TotalsPanel
                        rows={[
                          { label: "DEF total (A / B)", value: `${fmt(result.totalA.def)} / ${fmt(result.totalB.def)}` },
                          { label: "SPD total (A / B)", value: `${fmt(result.totalA.spd)} / ${fmt(result.totalB.spd)}` },
                        ]}
                      />
                    </div>

                    <div className="mt-3 text-center text-sm text-slate-300">
                      Vencedor:{" "}
                      <span className="font-semibold text-slate-100">
                        {result.winner === "TIE" ? "Empate" : `Artefato ${result.winner}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">Selecione um monstro para ver os resultados.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* =======================
   UI Components
======================= */

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-slate-100">{props.title}</h2>
      {props.children}
    </div>
  );
}

function ResultBar(props: { title: string; total: number; tone: "good" | "bad" | "neutral" }) {
  const cls =
    props.tone === "good"
      ? "border-emerald-900/60 bg-emerald-950/40"
      : props.tone === "bad"
      ? "border-rose-900/60 bg-rose-950/40"
      : "border-slate-800 bg-slate-950/40";

  const numCls =
    props.tone === "good" ? "text-emerald-400" : props.tone === "bad" ? "text-rose-400" : "text-slate-100";

  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-center text-lg font-semibold text-slate-100">{props.title}</div>
      <div className={`mt-2 text-center text-3xl font-bold ${numCls}`}>{fmt(props.total)}</div>
    </div>
  );
}

function TotalsPanel(props: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
      {props.rows.map((r, idx) => (
        <div
          key={r.label}
          className={`flex items-center justify-between gap-3 px-4 py-3 ${idx === 0 ? "" : "border-t border-slate-800"}`}
        >
          <div className="text-sm text-slate-300">{r.label}</div>
          <div className="text-sm font-semibold text-slate-100">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function NumberInput(props: { label: string; v: number; set: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-400">{props.label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        <input
          className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
          inputMode="decimal"
          value={String(props.v).replace(".", ",")}
          onChange={(e) => props.set(parseDecimal(e.target.value))}
        />
      </div>
    </label>
  );
}

/* ===== Artifact % inputs ===== */

function PercentInputHP(props: { label: string; v: string; set: (s: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-400">{props.label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        <input
          className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
          inputMode="decimal"
          placeholder="0,0"
          value={props.v}
          onChange={(e) => {
            let s = e.target.value.replace(/[^\d,]/g, "");
            const comma = s.indexOf(",");
            if (comma !== -1) s = s.slice(0, comma + 1) + s.slice(comma + 1).replace(/,/g, "");
            props.set(s);
          }}
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </label>
  );
}

function PercentInputInt(props: { label: string; v: string; set: (s: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-400">{props.label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        <input
          className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
          inputMode="numeric"
          placeholder="0"
          value={props.v}
          onChange={(e) => props.set(e.target.value.replace(/[^\d]/g, ""))}
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </label>
  );
}

function ArtifactInputs(props: { s: PercentStatsStr; set: React.Dispatch<React.SetStateAction<PercentStatsStr>> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <PercentInputHP label="% por HP" v={props.s.hp} set={(v) => props.set((o) => ({ ...o, hp: v }))} />
      <PercentInputInt label="% por ATK" v={props.s.atk} set={(v) => props.set((o) => ({ ...o, atk: v }))} />
      <PercentInputInt label="% por DEF" v={props.s.def} set={(v) => props.set((o) => ({ ...o, def: v }))} />
      <PercentInputInt label="% por SPD" v={props.s.spd} set={(v) => props.set((o) => ({ ...o, spd: v }))} />
    </div>
  );
}

/* ===== Artifact flat pickers ===== */

function ArtifactFlatPickers(props: {
  picks: [ArtifactFlatOption, ArtifactFlatOption];
  setPicks: React.Dispatch<React.SetStateAction<[ArtifactFlatOption, ArtifactFlatOption]>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <ArtifactFlatRow
        label="Artefato 1"
        value={props.picks[0]}
        onChange={(v) => props.setPicks((prev) => [v, prev[1]])}
      />
      <ArtifactFlatRow
        label="Artefato 2"
        value={props.picks[1]}
        onChange={(v) => props.setPicks((prev) => [prev[0], v])}
      />
    </div>
  );
}

function ArtifactFlatRow(props: { label: string; value: ArtifactFlatOption; onChange: (v: ArtifactFlatOption) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
        {props.label}
      </div>
      <ArtifactDropdown value={props.value} onChange={props.onChange} />
    </div>
  );
}

function ArtifactDropdown(props: { value: ArtifactFlatOption; onChange: (v: ArtifactFlatOption) => void }) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"down" | "up">("down");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const meta = flatLabel(props.value);

  const openWithDir = () => {
    const root = rootRef.current;
    if (root) {
      const r = root.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      setDir(spaceBelow < 260 ? "up" : "down");
    } else {
      setDir("down");
    }
    setOpen(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) openWithDir();
          else setOpen(false);
        }}
        className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left outline-none hover:bg-slate-950/70"
      >
        <span className="text-sm">
          {!meta ? (
            <span className="text-slate-500">{PLACEHOLDER_SELECT}</span>
          ) : (
            <>
              <span className="text-slate-200">{meta.main} </span>
              <span className="text-emerald-400">{meta.bonus}</span>
            </>
          )}
        </span>
        <ChevronDown />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-lg ${
            dir === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {ARTIFACT_OPTIONS.map((opt) => {
            const m = flatLabel(opt);
            return (
              <button
                key={opt || "empty"}
                type="button"
                onClick={() => {
                  props.onChange(opt);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-800"
              >
                {!m ? (
                  <span className="text-slate-500">{PLACEHOLDER_SELECT}</span>
                ) : (
                  <>
                    <span className="text-slate-200">{m.main} </span>
                    <span className="text-emerald-400">{m.bonus}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-slate-300">
      <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
    </svg>
  );
}

/* =======================
   Monster Picker
======================= */

function MonsterPicker(props: { value: MonsterListItem | null; onChange: (v: MonsterListItem | null) => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<MonsterListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"down" | "up">("down");
  const [loading, setLoading] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/monsters-awakened");
        const data = (await res.json()) as SwarfarmMonsterSearchResponse;
        if (!alive) return;
        setAll(Array.isArray(data.results) ? data.results : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const updateDir = () => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    setDir(spaceBelow < 360 ? "up" : "down");
  };

  const filtered = useMemo(() => {
    const term = (open ? q : displayMonsterName(props.value)).trim().toLowerCase();
    if (!term) return all.slice(0, 150);
    return all
      .filter((m) => `${m.name} ${m.element ?? ""}`.toLowerCase().includes(term))
      .slice(0, 200);
  }, [all, q, open, props.value]);

  return (
    <div ref={rootRef} className="relative">
      <label className="text-sm text-slate-400">Monster</label>

      <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        <input
          className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
          placeholder={loading ? "Carregando lista..." : "Digite para buscar..."}
          value={open ? q : props.value ? displayMonsterName(props.value) : ""}
          onFocus={() => {
            setOpen(true);
            setQ(props.value ? displayMonsterName(props.value) : "");
            requestAnimationFrame(() => updateDir());
          }}
          onChange={(e) => {
            setOpen(true);
            setQ(e.target.value);
            props.onChange(null);
            requestAnimationFrame(() => updateDir());
          }}
        />

        <button
          type="button"
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          onClick={() => {
            props.onChange(null);
            setQ("");
            setOpen(false);
          }}
        >
          Limpar
        </button>
      </div>

      {open && (
        <div
          className={`absolute z-50 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg ${
            dir === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
            {loading
              ? "Carregando..."
              : q.trim()
              ? `${filtered.length} resultados`
              : `Mostrando ${filtered.length} (digite para filtrar)`}
          </div>

          <div className="max-h-72 overflow-auto">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  props.onChange(m);
                  setOpen(false);
                }}
              >
                {m.name} {m.element ? `(${m.element})` : ""}
              </button>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-400">Nenhum resultado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
