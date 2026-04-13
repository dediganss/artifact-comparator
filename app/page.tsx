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

type RelicAttr = "" | "HP%" | "ATK%" | "DEF%";
type RelicState = { attr: RelicAttr; value: number };

type Buffs = { atk: boolean; def: boolean; spd: boolean };

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

const RELIC_ATTRS: RelicAttr[] = ["", "HP%", "ATK%", "DEF%"];
const RELIC_ATTR_LABELS: Record<RelicAttr, string> = {
  "":     "Selecionar…",
  "HP%":  "HP %",
  "ATK%": "ATK %",
  "DEF%": "DEF %",
};
// Relic value range: 3–20
const RELIC_VALUES = Array.from({ length: 18 }, (_, i) => i + 3); // [3,4,...,20]

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

function relicToBonus(relic: RelicState, base: { hp: number; atk: number; def: number }): Stats {
  if (!relic.attr || relic.value <= 0) return { hp: 0, atk: 0, def: 0, spd: 0 };
  const v = relic.value / 100;
  switch (relic.attr) {
    case "HP%":  return { hp: base.hp  * v, atk: 0, def: 0, spd: 0 };
    case "ATK%": return { hp: 0, atk: base.atk * v, def: 0, spd: 0 };
    case "DEF%": return { hp: 0, atk: 0, def: base.def * v, spd: 0 };
    default:     return { hp: 0, atk: 0, def: 0, spd: 0 };
  }
}
function calcTotals(
  monster: MonsterDetail,
  leader: LeaderChoice,
  bonus: Stats,
  isSiege: boolean,
  artifactFlat: Stats,
  buffFlat: Stats,
  relicFlat: Stats
) {
  const lp = leaderPct(leader);
  const siege = isSiege ? SIEGE_BONUS : { hp: 0, atk: 0, def: 0, spd: 0 };

  const total: Stats = {
    hp: monster.max_lvl_hp * (1 + TOWERS.hp + lp.hp + siege.hp) + bonus.hp + artifactFlat.hp + buffFlat.hp + relicFlat.hp,
    atk:
      monster.max_lvl_attack * (1 + TOWERS.atk + lp.atk + siege.atk) + bonus.atk + artifactFlat.atk + buffFlat.atk + relicFlat.atk,
    def:
      monster.max_lvl_defense * (1 + TOWERS.def + lp.def + siege.def) + bonus.def + artifactFlat.def + buffFlat.def + relicFlat.def,
    spd: monster.speed * (1 + TOWERS.spd + lp.spd + siege.spd) + bonus.spd + artifactFlat.spd + buffFlat.spd + relicFlat.spd,
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

  const [buffs, setBuffs] = useState<Buffs>({ atk: false, def: false, spd: false });

  const [pctA, setPctA] = useState<PercentStatsStr>({ hp: "", atk: "", def: "", spd: "" });
  const [pctB, setPctB] = useState<PercentStatsStr>({ hp: "", atk: "", def: "", spd: "" });

  const [artifactAFlats, setArtifactAFlats] = useState<[ArtifactFlatOption, ArtifactFlatOption]>(["", ""]);
  const [artifactBFlats, setArtifactBFlats] = useState<[ArtifactFlatOption, ArtifactFlatOption]>(["", ""]);

  const EMPTY_RELIC: RelicState = { attr: "", value: 0 };
  const [relicA, setRelicA] = useState<RelicState>(EMPTY_RELIC);
  const [relicB, setRelicB] = useState<RelicState>(EMPTY_RELIC);
  const [relicC, setRelicC] = useState<RelicState>(EMPTY_RELIC);
  const [relicD, setRelicD] = useState<RelicState>(EMPTY_RELIC);

  const [showC, setShowC] = useState(false);
  const [showD, setShowD] = useState(false);
  const [pctC, setPctC] = useState<PercentStatsStr>({ hp: "", atk: "", def: "", spd: "" });
  const [pctD, setPctD] = useState<PercentStatsStr>({ hp: "", atk: "", def: "", spd: "" });
  const [artifactCFlats, setArtifactCFlats] = useState<[ArtifactFlatOption, ArtifactFlatOption]>(["", ""]);
  const [artifactDFlats, setArtifactDFlats] = useState<[ArtifactFlatOption, ArtifactFlatOption]>(["", ""]);

  const frameRef = useRef<HTMLDivElement | null>(null);

  const handleClear = () => {
    setMonsterPick(null);
    setMonster(null);
    setIsSiege(false);
    setLeader({ attr: "None", amount: 0 });
    setBonus({ hp: 0, atk: 0, def: 0, spd: 0 });
    setBuffs({ atk: false, def: false, spd: false });
    setPctA({ hp: "", atk: "", def: "", spd: "" });
    setPctB({ hp: "", atk: "", def: "", spd: "" });
    setArtifactAFlats(["", ""]);
    setArtifactBFlats(["", ""]);
    setShowC(false);
    setShowD(false);
    setPctC({ hp: "", atk: "", def: "", spd: "" });
    setPctD({ hp: "", atk: "", def: "", spd: "" });
    setArtifactCFlats(["", ""]);
    setArtifactDFlats(["", ""]);
    setRelicA(EMPTY_RELIC);
    setRelicB(EMPTY_RELIC);
    setRelicC(EMPTY_RELIC);
    setRelicD(EMPTY_RELIC);
  };
  // Scale the whole page to fit viewport width
  const contentRef = useRef<HTMLDivElement | null>(null);
  const DESIGN_W = 1024;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let rafId = 0;
    const apply = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // Reset to measure natural size
        el.style.transform = "";
        el.style.width = `${DESIGN_W}px`;
        el.style.marginLeft = "";

        const naturalH = el.scrollHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / DESIGN_W, vh / naturalH, 1);

        el.style.transformOrigin = "top left";
        el.style.transform = `scale(${scale.toFixed(4)})`;
        // Center horizontally
        el.style.marginLeft = `${Math.max(0, (vw - DESIGN_W * scale) / 2)}px`;
        // Collapse parent height so no scroll — no overflow:hidden so dropdown escapes
        if (el.parentElement) {
          el.parentElement.style.height = `${Math.ceil(naturalH * scale)}px`;
        }
      });
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [monster, showC, showD, monsterPick]);

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
    const flatC = sumArtifactFlats(artifactCFlats);
    const flatD = sumArtifactFlats(artifactDFlats);

    const towered = {
      atk: monster.max_lvl_attack * (1 + TOWERS.atk),
      def: monster.max_lvl_defense * (1 + TOWERS.def),
      spd: monster.speed * (1 + TOWERS.spd),
    };

    const buffFlat: Stats = {
      hp: 0,
      atk: buffs.atk ? Math.floor(towered.atk * 0.5) : 0,
      def: buffs.def ? Math.floor(towered.def * 0.7) : 0,
      spd: buffs.spd ? Math.floor(towered.spd * 0.3) : 0,
    };

    const baseForRelic = { hp: monster.max_lvl_hp, atk: monster.max_lvl_attack, def: monster.max_lvl_defense };
    const rfA = relicToBonus(relicA, baseForRelic);
    const rfB = relicToBonus(relicB, baseForRelic);
    const rfC = relicToBonus(relicC, baseForRelic);
    const rfD = relicToBonus(relicD, baseForRelic);

    const { total: totalA } = calcTotals(monster, leader, bonus, isSiege, flatA, buffFlat, rfA);
    const { total: totalB } = calcTotals(monster, leader, bonus, isSiege, flatB, buffFlat, rfB);
    const { total: totalC } = calcTotals(monster, leader, bonus, isSiege, flatC, buffFlat, rfC);
    const { total: totalD } = calcTotals(monster, leader, bonus, isSiege, flatD, buffFlat, rfD);

    const A = calcDamageFromPct(totalA, percentStringsToNumbers(pctA));
    const B = calcDamageFromPct(totalB, percentStringsToNumbers(pctB));
    const C = calcDamageFromPct(totalC, percentStringsToNumbers(pctC));
    const D = calcDamageFromPct(totalD, percentStringsToNumbers(pctD));

    const entries: { key: string; total: number }[] = [
      { key: "A", total: A.total },
      { key: "B", total: B.total },
      ...(showC ? [{ key: "C", total: C.total }] : []),
      ...(showD ? [{ key: "D", total: D.total }] : []),
    ];
    const maxTotal = Math.max(...entries.map((e) => e.total));
    const winners = entries.filter((e) => e.total === maxTotal).map((e) => e.key);
    const winnerLabel = winners.length > 1 ? "Empate" : `Conjunto ${winners[0]} vence`;

    return { totalA, totalB, totalC, totalD, A, B, C, D, winnerLabel, winners, maxTotal };
  }, [monster, leader, bonus, buffs, isSiege, pctA, pctB, pctC, pctD, artifactAFlats, artifactBFlats, artifactCFlats, artifactDFlats, showC, showD, relicA, relicB, relicC, relicD]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Rajdhani:wght@400;500;600&display=swap');

        .sw-root {
          font-family: 'Rajdhani', sans-serif;
          background: #07090f;
          background-image:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120,80,20,0.18) 0%, transparent 70%),
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.018) 39px, rgba(255,255,255,0.018) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.018) 39px, rgba(255,255,255,0.018) 40px);
          min-height: 100dvh;
        }

        .sw-title {
          font-family: 'Cinzel', serif;
          letter-spacing: 0.04em;
          background: linear-gradient(135deg, #f5c842 0%, #e8a020 50%, #c97a10 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .sw-card {
          background: rgb(18,22,34);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .sw-card-accent {
          background: rgb(22,20,14);
          border: 1px solid rgba(245,200,66,0.15);
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,200,66,0.08);
        }

        .sw-section-label {
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(245,200,66,0.85);
        }

        .sw-input {
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          color: #e8dfc0;
          padding: 9px 13px;
          width: 100%;
          outline: none;
          font-family: 'Rajdhani', sans-serif;
          font-size: 18px;
          font-weight: 500;
          transition: border-color 0.15s;
        }
        .sw-input:focus { border-color: rgba(245,200,66,0.4); }
        .sw-input::placeholder { color: rgba(255,255,255,0.2); }

        .sw-select {
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          color: #e8dfc0;
          padding: 9px 13px;
          width: 100%;
          outline: none;
          font-family: 'Rajdhani', sans-serif;
          font-size: 18px;
          font-weight: 500;
          transition: border-color 0.15s;
          cursor: pointer;
          appearance: auto;
        }
        .sw-select:focus { border-color: rgba(245,200,66,0.4); }
        .sw-select option { background: #12151e; color: #e8dfc0; }
        .sw-select:disabled { opacity: 0.4; cursor: default; }

        .sw-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(245,200,66,0.2), transparent);
          margin: 0;
        }

        .sw-result-good {
          background: rgba(16,185,129,0.07);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 12px;
          box-shadow: 0 0 20px rgba(16,185,129,0.08);
        }
        .sw-result-bad {
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px;
        }
        .sw-result-neutral {
          background: rgb(18,22,34);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
        }

        .sw-winner-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 14px;
          border-radius: 9999px;
          background: rgba(245,200,66,0.1);
          border: 1px solid rgba(245,200,66,0.3);
          font-size: 18px;
          font-weight: 600;
          color: #f5c842;
          letter-spacing: 0.05em;
        }

        .sw-artifact-label {
          font-family: 'Cinzel', serif;
          font-size: 18px;
          color: rgba(245,200,66,0.8);
          letter-spacing: 0.06em;
        }

        .sw-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 18px;
        }
        .sw-stat-row:last-child { border-bottom: none; }

        .sw-siege-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        /* ── Responsive layout ── */
        .sw-main-grid {
          display: grid;
          gap: 12px;
          margin-bottom: 12px;
        }
        .sw-cols-3 { grid-template-columns: 1fr 1fr 1fr; }

        .sw-add-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 2px dashed rgba(245,200,66,0.2);
          border-radius: 12px;
          background: rgba(245,200,66,0.03);
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          min-height: 80px;
          padding: 16px;
          color: rgba(245,200,66,0.4);
          font-family: 'Rajdhani', sans-serif;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: 0.1em;
        }
        .sw-add-btn:hover {
          border-color: rgba(245,200,66,0.5);
          background: rgba(245,200,66,0.07);
          color: rgba(245,200,66,0.8);
        }
        .sw-add-btn svg { transition: transform 0.2s; }
        .sw-add-btn:hover svg { transform: scale(1.15); }

        .sw-remove-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          cursor: pointer;
          color: rgba(255,255,255,0.4);
          font-size: 18px;
          line-height: 1;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .sw-remove-btn:hover {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.15);
          color: #f87171;
        }

        .sw-results-grid {
          display: grid;
          gap: 12px;
          margin-bottom: 14px;
        }
        .sw-totals-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        @media (max-width: 768px) {
          .sw-cols-3 { grid-template-columns: 1fr; }
          .sw-results-grid { grid-template-columns: 1fr 1fr !important; }
          .sw-totals-grid { grid-template-columns: 1fr; }
          .sw-title-text { font-size: 20px !important; }
          .sw-subtitle { display: none; }
          .sw-siege-pill span:last-child { display: none; }
        }
        @media (max-width: 480px) {
          .sw-results-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <main className="sw-root text-slate-200" style={{ height: "100dvh" }}>
        <div ref={frameRef} style={{ width: "100%" }}>
          <div ref={contentRef} style={{ padding: "8px 20px 16px", width: `${DESIGN_W}px`, marginLeft: "auto", marginRight: "auto" }}>

            {/* ── Header ── */}
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <h1 className="sw-title sw-title-text" style={{ fontSize: 33, margin: 0 }}>Comparador de Artefatos</h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Siege toggle */}
                <div
                  className="sw-siege-pill"
                  onClick={() => setIsSiege((v) => !v)}
                  style={{
                    border: isSiege ? "1px solid rgba(245,200,66,0.35)" : "1px solid rgba(255,255,255,0.1)",
                    background: isSiege ? "rgba(245,200,66,0.1)" : "rgb(18,22,34)",
                    color: isSiege ? "#f5c842" : "rgba(255,255,255,0.45)",
                    userSelect: "none",
                  }}
                >
                  <span onClick={(e) => e.stopPropagation()}>
                    <Toggle checked={isSiege} onToggle={() => setIsSiege((v) => !v)} accent="gold" />
                  </span>
                  Siege War
                </div>
              </div>
            </header>

            {/* ── Monster Picker ── overflow:visible so dropdown isn't clipped */}
            <div style={{ background: "rgb(18,22,34)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.4)", padding: "14px 16px", marginBottom: 14, position: "relative", zIndex: 100, overflow: "visible" }}>
              <MonsterPicker value={monsterPick} onChange={setMonsterPick} onClear={handleClear} />
            </div>

            {monster && (
              <>
                {/* ── Main layout: left panel + conjuntos side by side ── */}
                <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "stretch" }}>

                  {/* Left panel: Leader + Rune Bonus + Buffs — fixed width */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 210, flexShrink: 0 }}>
                    {/* Leader */}
                    <div className="sw-card" style={{ padding: "10px 12px" }}>
                      <div className="sw-section-label" style={{ marginBottom: 8 }}>Leader Skill</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <div>
                          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 3, fontWeight: 500 }}>Atributo</div>
                          <select className="sw-select" style={{ color: leader.attr === "None" ? "rgba(255,255,255,0.25)" : "#e8dfc0" }} value={leader.attr}
                            onChange={(e) => setLeader({ attr: e.target.value as LeaderAttrUI, amount: 0 })}>
                            <option value="None">{PLACEHOLDER_SELECT}</option>
                            <option value="HP">HP</option>
                            <option value="ATK">ATK</option>
                            <option value="DEF">DEF</option>
                            <option value="SPD">SPD</option>
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 3, fontWeight: 500 }}>Valor</div>
                          <select className="sw-select" style={{ color: leader.amount === 0 ? "rgba(255,255,255,0.25)" : "#e8dfc0" }} value={leader.amount}
                            disabled={leader.attr === "None"} onChange={(e) => setLeader((s) => ({ ...s, amount: Number(e.target.value) || 0 }))}>
                            <option value={0}>{PLACEHOLDER_SELECT}</option>
                            {leader.attr !== "None" && LEADER_VALUES[leader.attr].map((v) => (
                              <option key={v} value={v}>{v}%</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Rune Bonus */}
                    <div className="sw-card" style={{ padding: "10px 12px", flex: 1 }}>
                      <div className="sw-section-label" style={{ marginBottom: 8 }}>Bônus de Runas</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        <NumberInput label="HP" v={bonus.hp} set={(v) => setBonus((s) => ({ ...s, hp: v }))} />
                        <NumberInput label="ATK" v={bonus.atk} set={(v) => setBonus((s) => ({ ...s, atk: v }))} />
                        <NumberInput label="DEF" v={bonus.def} set={(v) => setBonus((s) => ({ ...s, def: v }))} />
                        <NumberInput label="SPD" v={bonus.spd} set={(v) => setBonus((s) => ({ ...s, spd: v }))} />
                      </div>
                    </div>

                    {/* Buffs */}
                    <div className="sw-card" style={{ padding: "10px 12px" }}>
                      <div className="sw-section-label" style={{ marginBottom: 8 }}>Buffs Ativos</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <BuffToggle label="ATK +50%" checked={buffs.atk} onToggle={() => setBuffs((s) => ({ ...s, atk: !s.atk }))} />
                        <BuffToggle label="DEF +70%" checked={buffs.def} onToggle={() => setBuffs((s) => ({ ...s, def: !s.def }))} />
                        <BuffToggle label="SPD +30%" checked={buffs.spd} onToggle={() => setBuffs((s) => ({ ...s, spd: !s.spd }))} />
                      </div>
                    </div>
                  </div>

                  {/* Conjuntos: A + B always, C and D optional — all side by side, equal width */}
                  <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
                    <ConjuntoCard letter="A" pct={pctA} setPct={setPctA} flats={artifactAFlats} setFlats={setArtifactAFlats} relic={relicA} setRelic={setRelicA} />
                    <ConjuntoCard letter="B" pct={pctB} setPct={setPctB} flats={artifactBFlats} setFlats={setArtifactBFlats} relic={relicB} setRelic={setRelicB} />

                    {showC && (
                      <ConjuntoCard letter="C" pct={pctC} setPct={setPctC} flats={artifactCFlats} setFlats={setArtifactCFlats} relic={relicC} setRelic={setRelicC}
                        onRemove={() => { setShowC(false); setPctC({ hp: "", atk: "", def: "", spd: "" }); setArtifactCFlats(["", ""]); setRelicC(EMPTY_RELIC); }} />
                    )}
                    {showD && (
                      <ConjuntoCard letter="D" pct={pctD} setPct={setPctD} flats={artifactDFlats} setFlats={setArtifactDFlats} relic={relicD} setRelic={setRelicD}
                        onRemove={() => { setShowD(false); setPctD({ hp: "", atk: "", def: "", spd: "" }); setArtifactDFlats(["", ""]); setRelicD(EMPTY_RELIC); }} />
                    )}

                    {/* Add buttons — slim vertical strips */}
                    {!showC && (
                      <button type="button" className="sw-add-btn" style={{ minWidth: 44, flex: "0 0 44px" }}
                        onClick={() => setShowC(true)}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        <span style={{ writingMode: "vertical-rl", fontSize: 11, letterSpacing: "0.15em" }}>CONJUNTO C</span>
                      </button>
                    )}
                    {showC && !showD && (
                      <button type="button" className="sw-add-btn" style={{ minWidth: 44, flex: "0 0 44px" }}
                        onClick={() => setShowD(true)}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        <span style={{ writingMode: "vertical-rl", fontSize: 11, letterSpacing: "0.15em" }}>CONJUNTO D</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Results ── */}
                <div className="sw-card" style={{ padding: "16px 18px" }}>
                  {result ? (
                    <>
                      {(() => {
                        const activeKeys = ["A", "B", ...(showC ? ["C"] : []), ...(showD ? ["D"] : [])];
                        const totals: Record<string, Stats> = { A: result.totalA, B: result.totalB, C: result.totalC, D: result.totalD };
                        const dmg: Record<string, { total: number }> = { A: result.A, B: result.B, C: result.C, D: result.D };
                        const colCount = activeKeys.length;
                        const resultColStyle = `repeat(${colCount}, 1fr)`;
                        return (
                          <>
                            <div className="sw-results-grid" style={{ gridTemplateColumns: resultColStyle }}>
                              {activeKeys.map((k) => {
                                const isWinner = result.winners.includes(k);
                                const isLoser = !isWinner && result.winners.length === 1;
                                return (
                                  <ResultBar key={k} title={`Conjunto ${k}`} total={dmg[k].total}
                                    tone={isWinner ? "good" : isLoser ? "bad" : "neutral"} />
                                );
                              })}
                            </div>

                            <div className="sw-totals-grid">
                              <TotalsPanel rows={[
                                { label: "HP", value: activeKeys.map((k) => fmt(totals[k].hp)).join(" / ") },
                                { label: "ATK", value: activeKeys.map((k) => fmt(totals[k].atk)).join(" / ") },
                              ]} />
                              <TotalsPanel rows={[
                                { label: "DEF", value: activeKeys.map((k) => fmt(totals[k].def)).join(" / ") },
                                { label: "SPD", value: activeKeys.map((k) => fmt(totals[k].spd)).join(" / ") },
                              ]} />
                            </div>

                            <div style={{ textAlign: "center" }}>
                              {result.winners.length > 1 ? (
                                <span className="sw-winner-badge" style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
                                  ⚖ Empate
                                </span>
                              ) : (
                                <span className="sw-winner-badge">✦ {result.winnerLabel}</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "12px 0", fontSize: 18, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>
                      Selecione um monstro para ver os resultados
                    </div>
                  )}
                </div>
              </>
            )}
        </div>
        </div>
      </main>
    </>
  );
}

/* =======================
   UI Components
======================= */

const CONJUNTO_COLORS: Record<string, { bg: string; border: string; color: string; labelColor: string }> = {
  A: { bg: "rgb(22,20,14)", border: "rgba(245,200,66,0.18)", color: "#f5c842", labelColor: "rgba(245,200,66,0.85)" },
  B: { bg: "rgb(14,18,30)", border: "rgba(99,179,237,0.22)", color: "#63b3ed", labelColor: "rgba(99,179,237,0.9)" },
  C: { bg: "rgb(14,22,22)", border: "rgba(52,211,153,0.18)", color: "#34d399", labelColor: "rgba(52,211,153,0.85)" },
  D: { bg: "rgb(22,14,28)", border: "rgba(196,130,241,0.18)", color: "#c084fc", labelColor: "rgba(196,130,241,0.85)" },
};

function ConjuntoCard(props: {
  letter: string;
  accent?: boolean;
  isActive?: boolean;
  pct: PercentStatsStr;
  setPct: React.Dispatch<React.SetStateAction<PercentStatsStr>>;
  flats: [ArtifactFlatOption, ArtifactFlatOption];
  setFlats: React.Dispatch<React.SetStateAction<[ArtifactFlatOption, ArtifactFlatOption]>>;
  relic: RelicState;
  setRelic: React.Dispatch<React.SetStateAction<RelicState>>;
  onRemove?: () => void;
}) {
  const c = CONJUNTO_COLORS[props.letter] ?? CONJUNTO_COLORS["B"];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "14px 16px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: `${c.color}25`, border: `1px solid ${c.color}70`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: c.color,
          fontFamily: "system-ui, sans-serif",
          flexShrink: 0,
        }}>{props.letter}</div>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <span style={{ fontFamily: "Cinzel, serif", fontSize: 14, color: c.labelColor, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            Conjunto {props.letter}
          </span>
        </div>
        {props.onRemove && (
          <button type="button" className="sw-remove-btn" onClick={props.onRemove} title="Remover" style={{ flexShrink: 0 }}>×</button>
        )}
      </div>
      <ArtifactInputs s={props.pct} set={props.setPct} />
      <div className="sw-divider" style={{ margin: "14px 0" }} />
      <ArtifactFlatPickers picks={props.flats} setPicks={props.setFlats} />
      <div className="sw-divider" style={{ margin: "14px 0" }} />
      <RelicPicker relic={props.relic} setRelic={props.setRelic} accentColor={c.color} />
    </div>
  );
}

function Toggle(props: { checked: boolean; onToggle: () => void; accent?: "green" | "gold" }) {
  const accent = props.accent ?? "green";
  const trackOn = accent === "gold" ? "rgba(120,80,10,0.6)" : "rgba(6,78,59,0.5)";
  const borderOn = accent === "gold" ? "#b8860b" : "#059669";
  const thumbOn = accent === "gold" ? "#f5c842" : "#34d399";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={props.onToggle}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 36,
        height: 20,
        borderRadius: 9999,
        border: props.checked ? `1px solid ${borderOn}` : "1px solid rgba(255,255,255,0.15)",
        background: props.checked ? trackOn : "rgba(0,0,0,0.4)",
        transition: "background 0.2s, border-color 0.2s",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: props.checked ? 17 : 3,
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: props.checked ? thumbOn : "rgba(255,255,255,0.3)",
          transition: "left 0.2s, background 0.2s",
          display: "block",
        }}
      />
    </button>
  );
}

function BuffToggle(props: { label: string; sublabel?: string; checked: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={props.onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 8,
        border: props.checked ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.07)",
        background: props.checked ? "rgba(6,78,59,0.25)" : "rgba(255,255,255,0.03)",
        cursor: "pointer",
        userSelect: "none",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <span style={{ fontSize: 17, fontWeight: 600, color: props.checked ? "#a7f3d0" : "rgba(255,255,255,0.75)", fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.04em" }}>
        {props.label}
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <Toggle checked={props.checked} onToggle={props.onToggle} />
      </span>
    </div>
  );
}


function ResultBar(props: { title: string; total: number; tone: "good" | "bad" | "neutral" }) {
  const containerStyle: React.CSSProperties =
    props.tone === "good"
      ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: 10, padding: "14px 16px", boxShadow: "0 0 20px rgba(16,185,129,0.07)" }
      : props.tone === "bad"
      ? { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "14px 16px" }
      : { background: "rgb(18,22,34)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px" };

  const numColor = props.tone === "good" ? "#34d399" : props.tone === "bad" ? "#f87171" : "#e8dfc0";

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: "center", fontSize: 17, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", fontFamily: "Rajdhani, sans-serif", marginBottom: 6 }}>
        {props.title.toUpperCase()}
      </div>
      <div style={{ textAlign: "center", fontSize: 37, fontWeight: 700, color: numColor, fontFamily: "Rajdhani, sans-serif", letterSpacing: "-0.02em" }}>
        {fmt(props.total)}
      </div>
    </div>
  );
}

function TotalsPanel(props: { rows: { label: string; value: string }[] }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
      {props.rows.map((r, idx) => (
        <div
          key={r.label}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 12px",
            borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", fontFamily: "Rajdhani, sans-serif" }}>{r.label}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#e8dfc0", fontFamily: "Rajdhani, sans-serif" }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function NumberInput(props: { label: string; v: number; set: (n: number) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.65)", fontFamily: "Rajdhani, sans-serif" }}>{props.label}</span>
      <input
        className="sw-input"
        inputMode="decimal"
        value={String(props.v).replace(".", ",")}
        onChange={(e) => props.set(parseDecimal(e.target.value))}
      />
    </label>
  );
}

/* ===== Artifact % inputs ===== */

function PercentInputHP(props: { label: string; v: string; set: (s: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.65)", fontFamily: "Rajdhani, sans-serif" }}>{props.label}</span>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          className="sw-input"
          style={{ paddingRight: 24 }}
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
        <span style={{ position: "absolute", right: 10, fontSize: 16, color: "rgba(245,200,66,0.5)", fontWeight: 600 }}>%</span>
      </div>
    </label>
  );
}

function PercentInputInt(props: { label: string; v: string; set: (s: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.65)", fontFamily: "Rajdhani, sans-serif" }}>{props.label}</span>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          className="sw-input"
          style={{ paddingRight: 24 }}
          inputMode="numeric"
          placeholder="0"
          value={props.v}
          onChange={(e) => props.set(e.target.value.replace(/[^\d]/g, ""))}
        />
        <span style={{ position: "absolute", right: 10, fontSize: 16, color: "rgba(245,200,66,0.5)", fontWeight: 600 }}>%</span>
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
    <div className="flex flex-col gap-2">
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.65)", fontFamily: "Rajdhani, sans-serif" }}>
        {props.label.toUpperCase()}
      </div>
      <ArtifactDropdown value={props.value} onChange={props.onChange} />
    </div>
  );
}

/* ===== Relic picker ===== */

function RelicPicker(props: {
  relic: RelicState;
  setRelic: React.Dispatch<React.SetStateAction<RelicState>>;
  accentColor?: string;
}) {
  const accent = props.accentColor ?? "#a78bfa";
  const { relic, setRelic } = props;

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
      }}>
        {/* Diamond gem icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill={accent} style={{ opacity: 0.8, flexShrink: 0 }}>
          <path d="M12 2L2 9l10 13L22 9z" />
        </svg>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.15em",
          color: `${accent}cc`, fontFamily: "Rajdhani, sans-serif",
          textTransform: "uppercase",
        }}>
          Relíquia
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "end" }}>
        {/* Attribute selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)", fontFamily: "Rajdhani, sans-serif" }}>
            ATRIBUTO
          </span>
          <select
            className="sw-select"
            style={{
              fontSize: 15,
              padding: "7px 10px",
              color: relic.attr ? "#e8dfc0" : "rgba(255,255,255,0.22)",
              borderColor: relic.attr ? `${accent}55` : "rgba(255,255,255,0.09)",
            }}
            value={relic.attr}
            onChange={(e) => setRelic((s) => ({ ...s, attr: e.target.value as RelicAttr, value: s.value || 3 }))}
          >
            {RELIC_ATTRS.map((a) => (
              <option key={a} value={a}>{RELIC_ATTR_LABELS[a]}</option>
            ))}
          </select>
        </div>

        {/* Value selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)", fontFamily: "Rajdhani, sans-serif" }}>
            VALOR
          </span>
          <select
            className="sw-select"
            style={{
              fontSize: 15,
              padding: "7px 10px",
              width: 72,
              color: relic.attr ? "#e8dfc0" : "rgba(255,255,255,0.22)",
              borderColor: relic.attr ? `${accent}55` : "rgba(255,255,255,0.09)",
            }}
            value={relic.value || ""}
            disabled={!relic.attr}
            onChange={(e) => setRelic((s) => ({ ...s, value: Number(e.target.value) }))}
          >
            <option value="">—</option>
            {RELIC_VALUES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active badge */}
      {relic.attr && relic.value > 0 && (
        <div style={{
          marginTop: 7,
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 9999,
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
          fontSize: 12, fontFamily: "Rajdhani, sans-serif", fontWeight: 600,
          color: accent,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill={accent}><path d="M12 2L2 9l10 13L22 9z" /></svg>
          {RELIC_ATTR_LABELS[relic.attr]} +{relic.value}%
        </div>
      )}
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
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0,0,0,0.35)",
          border: open ? "1px solid rgba(245,200,66,0.4)" : "1px solid rgba(255,255,255,0.09)",
          borderRadius: 8,
          padding: "7px 10px",
          cursor: "pointer",
          outline: "none",
          transition: "border-color 0.15s",
        }}
      >
        <span style={{ fontSize: 18, fontFamily: "Rajdhani, sans-serif", fontWeight: 500 }}>
          {!meta ? (
            <span style={{ color: "rgba(255,255,255,0.2)" }}>{PLACEHOLDER_SELECT}</span>
          ) : (
            <>
              <span style={{ color: "#e8dfc0" }}>{meta.main} </span>
              <span style={{ color: "#f5c842", fontSize: 11 }}>{meta.bonus}</span>
            </>
          )}
        </span>
        <ChevronDown />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            width: "100%",
            overflow: "hidden",
            borderRadius: 8,
            border: "1px solid rgba(245,200,66,0.2)",
            background: "#0d1117",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            ...(dir === "up" ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
          }}
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
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 18,
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 500,
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,200,66,0.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {!m ? (
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>{PLACEHOLDER_SELECT}</span>
                ) : (
                  <>
                    <span style={{ color: "#e8dfc0" }}>{m.main} </span>
                    <span style={{ color: "#f5c842", fontSize: 13 }}>{m.bonus}</span>
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
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ color: "rgba(245,200,66,0.5)", flexShrink: 0 }}>
      <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
    </svg>
  );
}

/* =======================
   Monster Picker
======================= */

function MonsterPicker(props: { value: MonsterListItem | null; onChange: (v: MonsterListItem | null) => void; onClear: () => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<MonsterListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"down" | "up">("down");
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

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
    return () => { alive = false; };
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
    const row = rowRef.current;
    if (!row) return;
    const r = row.getBoundingClientRect();
    setDir(window.innerHeight - r.bottom < 320 ? "up" : "down");
  };

  const filtered = useMemo(() => {
    const term = (open ? q : displayMonsterName(props.value)).trim().toLowerCase();
    if (!term) return all.slice(0, 150);
    return all.filter((m) => `${m.name} ${m.element ?? ""}`.toLowerCase().includes(term)).slice(0, 200);
  }, [all, q, open, props.value]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(245,200,66,0.85)", fontFamily: "Rajdhani, sans-serif", marginBottom: 8 }}>
        MONSTRO
      </div>

      <div ref={rowRef} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: "rgba(0,0,0,0.35)", border: open ? "1px solid rgba(245,200,66,0.4)" : "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "7px 12px", transition: "border-color 0.15s" }}>
          <input
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e8dfc0", fontFamily: "Rajdhani, sans-serif", fontSize: 14, fontWeight: 500 }}
            placeholder={loading ? "Carregando lista..." : "Digite para buscar..."}
            value={open ? q : props.value ? displayMonsterName(props.value) : ""}
            onFocus={() => {
              setOpen(true);
              setQ(props.value ? displayMonsterName(props.value) : "");
              requestAnimationFrame(() => requestAnimationFrame(() => updateDir()));
            }}
            onChange={(e) => {
              setOpen(true);
              setQ(e.target.value);
              props.onChange(null);
              requestAnimationFrame(() => requestAnimationFrame(() => updateDir()));
            }}
          />
          {props.value && !open && (
            <span style={{ color: "rgba(52,211,153,0.7)", fontSize: 12, marginLeft: 6 }}>✓</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setQ(""); setOpen(false); props.onClear(); }}
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "Rajdhani, sans-serif", letterSpacing: "0.08em", transition: "border-color 0.15s, color 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
        >
          LIMPAR
        </button>
      </div>

      {open && (
        <div style={{
          position: "absolute",
          zIndex: 9999,
          width: "100%",
          borderRadius: 10,
          border: "1px solid rgba(245,200,66,0.18)",
          background: "#0d1117",
          boxShadow: "0 12px 40px rgba(0,0,0,0.8)",
          ...(dir === "up" ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
        }}>
          <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(245,200,66,0.65)", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: "Rajdhani, sans-serif" }}>
            {loading ? "CARREGANDO..." : q.trim() ? `${filtered.length} RESULTADOS` : `${filtered.length} MONSTROS`}
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { props.onChange(m); setOpen(false); }}
                style={{ display: "block", width: "100%", padding: "8px 12px", textAlign: "left", fontSize: 13, fontFamily: "Rajdhani, sans-serif", fontWeight: 500, color: "#e8dfc0", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,200,66,0.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {m.name}{m.element ? <span style={{ color: "rgba(245,200,66,0.5)", marginLeft: 4 }}>({m.element})</span> : ""}
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: "12px", fontSize: 13, color: "rgba(255,255,255,0.25)", fontFamily: "Rajdhani, sans-serif" }}>Nenhum resultado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
