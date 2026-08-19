import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, ThumbsUp, ThumbsDown, Settings, Check, Receipt } from "lucide-react";

const CONFIG_KEY = "budget:config";
const EXPENSES_KEY = "budget:expenses";

const CATS = [
  { id: "needs", label: "Needs", pctKey: "needsPct", ink: "#8B2E2E", paper: "#F3E3E1", ring: "#B33A3A" },
  { id: "wants", label: "Wants", pctKey: "wantsPct", ink: "#6B5B0F", paper: "#F1EAD0", ring: "#A98600" },
  { id: "savings", label: "Savings", pctKey: "savingsPct", ink: "#1F4F41", paper: "#DFEDE7", ring: "#2F6B57" },
];

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StampBadge({ good }) {
  return (
    <div
      className={`inline-flex items-center gap-1 border-2 rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider -rotate-3 ${
        good ? "border-emerald-700 text-emerald-700" : "border-orange-700 text-orange-700"
      }`}
      style={{ fontFamily: "ui-monospace, monospace" }}
    >
      {good ? "Worth it" : "Meh"}
    </div>
  );
}

function Ring({ pct, color, size = 78, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(pct, 1);
  const over = pct > 1;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7E1D3" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={over ? "#B33A3A" : color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c - clamped * c}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

export default function BudgetTracker() {
  const [config, setConfig] = useState({ income: 3650, needsPct: 50, wantsPct: 30, savingsPct: 20 });
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ amount: "", category: null });
  const amountRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await window.storage.get(CONFIG_KEY, false);
        if (c) setConfig(JSON.parse(c.value));
      } catch (e) {}
      try {
        const ex = await window.storage.get(EXPENSES_KEY, false);
        if (ex) setExpenses(JSON.parse(ex.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set(CONFIG_KEY, JSON.stringify(config), false).catch(() => {});
  }, [config, loaded]);

  useEffect(() => {
    if (showAdd) setTimeout(() => amountRef.current?.focus(), 50);
  }, [showAdd]);

  const thisMonth = monthKey(new Date());
  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKey(new Date(e.date)) === thisMonth),
    [expenses, thisMonth]
  );

  const totals = useMemo(() => {
    const t = { needs: 0, wants: 0, savings: 0 };
    monthExpenses.forEach((e) => {
      t[e.category] = (t[e.category] || 0) + e.amount;
    });
    return t;
  }, [monthExpenses]);

  const budgets = {
    needs: (config.income * config.needsPct) / 100,
    wants: (config.income * config.wantsPct) / 100,
    savings: (config.income * config.savingsPct) / 100,
  };

  const rated = monthExpenses.filter((e) => e.worthIt !== null && e.worthIt !== undefined);
  const worthItPct = rated.length ? Math.round((rated.filter((e) => e.worthIt).length / rated.length) * 100) : null;

  async function saveExpenses(next) {
    setExpenses(next);
    try {
      await window.storage.set(EXPENSES_KEY, JSON.stringify(next), false);
    } catch (e) {}
  }

  function finishEntry(worthIt) {
    const amt = parseFloat(draft.amount);
    if (!amt || amt <= 0 || !draft.category) return;
    const entry = {
      id: `${Date.now()}`,
      amount: amt,
      category: draft.category,
      worthIt: worthIt === undefined ? null : worthIt,
      date: new Date().toISOString(),
    };
    const next = [entry, ...expenses];
    saveExpenses(next);
    setShowAdd(false);
    setDraft({ amount: "", category: null });
    const cat = CATS.find((c) => c.id === entry.category);
    setToast(`Logged $${amt.toFixed(2)} to ${cat.label}`);
    setTimeout(() => setToast(null), 1800);
  }

  function removeExpense(id) {
    saveExpenses(expenses.filter((e) => e.id !== id));
  }

  const pctSum = config.needsPct + config.wantsPct + config.savingsPct;

  return (
    <div className="min-h-screen w-full" style={{ background: "#EFEAE0", fontFamily: "ui-sans-serif, system-ui" }}>
      <div className="max-w-md mx-auto pb-28 relative">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#8A8270]">
              {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </div>
            <h1 className="text-2xl font-serif text-[#24303D] mt-0.5">Ledger</h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="mt-1 p-2 rounded-full border border-[#24303D]/15 text-[#24303D]/70 active:scale-95"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Income strip */}
        <div className="mx-5 mb-5 rounded-xl border border-[#24303D]/10 bg-[#F8F5EE] px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-mono text-[#6B7280] uppercase tracking-wide">After-tax income</span>
          <span className="text-sm font-mono font-semibold text-[#24303D]">${config.income.toLocaleString()}</span>
        </div>

        {/* Rings */}
        <div className="mx-5 grid grid-cols-3 gap-3">
          {CATS.map((c) => {
            const spent = totals[c.id] || 0;
            const budget = budgets[c.id] || 1;
            const pct = spent / budget;
            const left = budget - spent;
            return (
              <div key={c.id} className="rounded-xl border border-[#24303D]/10 bg-[#F8F5EE] p-3 flex flex-col items-center">
                <div className="relative">
                  <Ring pct={pct} color={c.ring} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-mono font-bold" style={{ color: pct > 1 ? "#B33A3A" : c.ink }}>
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-serif text-[#24303D]">{c.label}</div>
                <div className="text-[10px] font-mono text-[#8A8270] text-center leading-tight mt-0.5">
                  ${spent.toFixed(0)} / ${budget.toFixed(0)}
                </div>
                <div className={`text-[9px] font-mono mt-0.5 ${left < 0 ? "text-[#B33A3A]" : "text-[#5B7F6B]"}`}>
                  {left < 0 ? `$${Math.abs(left).toFixed(0)} over` : `$${left.toFixed(0)} left`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Worth-it reflection */}
        {worthItPct !== null && (
          <div className="mx-5 mt-5 rounded-xl border border-[#24303D]/10 bg-[#F8F5EE] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wide text-[#6B7280]">Worth it this month</span>
              <span className="text-sm font-mono font-bold text-[#24303D]">{worthItPct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[#E7E1D3] overflow-hidden">
              <div className="h-full rounded-full bg-[#2F6B57]" style={{ width: `${worthItPct}%` }} />
            </div>
            <div className="text-[10px] font-mono text-[#8A8270] mt-1.5">
              {worthItPct >= 75
                ? "Most of your spending felt good. Keep going."
                : worthItPct >= 40
                ? "Mixed month — worth a look at the 'meh' ones below."
                : "A lot felt not-worth-it. Might be worth revisiting Wants."}
            </div>
          </div>
        )}

        {/* History */}
        <div className="mx-5 mt-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8A8270] mb-2 flex items-center gap-1.5">
            <Receipt size={12} /> This month
          </div>
          {monthExpenses.length === 0 ? (
            <div className="text-center py-10 text-[#8A8270] text-sm font-mono border border-dashed border-[#24303D]/15 rounded-xl">
              Nothing logged yet.
              <br />
              Tap + to add your first purchase.
            </div>
          ) : (
            <div className="rounded-xl border border-[#24303D]/10 bg-[#F8F5EE] divide-y divide-[#24303D]/8 overflow-hidden">
              {monthExpenses.map((e) => {
                const cat = CATS.find((c) => c.id === e.category);
                return (
                  <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: cat.paper, color: cat.ink }}
                      >
                        {cat.label}
                      </span>
                      {e.worthIt !== null && <StampBadge good={e.worthIt} />}
                      <span className="text-[10px] font-mono text-[#8A8270] shrink-0">
                        {new Date(e.date).toLocaleDateString("default", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm font-semibold text-[#24303D]">${e.amount.toFixed(2)}</span>
                      <button onClick={() => removeExpense(e.id)} className="text-[#8A8270] active:scale-90">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-6 right-1/2 translate-x-[calc(50%+0px)] sm:translate-x-0 sm:right-[calc(50%-224px+16px)] w-14 h-14 rounded-full bg-[#24303D] text-[#EFEAE0] shadow-lg flex items-center justify-center active:scale-95"
          style={{ right: "max(1.25rem, calc(50% - 224px + 1.25rem))" }}
        >
          <Plus size={26} />
        </button>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#24303D] text-[#EFEAE0] text-xs font-mono px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5">
            <Check size={12} /> {toast}
          </div>
        )}

        {/* Add sheet */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-20" onClick={() => setShowAdd(false)}>
            <div
              className="w-full max-w-md bg-[#F8F5EE] rounded-t-2xl p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-serif text-lg text-[#24303D]">Log a purchase</span>
                <button onClick={() => setShowAdd(false)} className="text-[#8A8270]">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center border border-[#24303D]/15 rounded-xl px-4 py-3 mb-4 bg-white">
                <span className="text-2xl font-mono text-[#8A8270] mr-1">$</span>
                <input
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="text-2xl font-mono flex-1 outline-none bg-transparent text-[#24303D]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {CATS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setDraft((d) => ({ ...d, category: c.id }))}
                    className="rounded-xl py-3 text-sm font-serif border-2 transition"
                    style={{
                      borderColor: draft.category === c.id ? c.ring : "transparent",
                      background: c.paper,
                      color: c.ink,
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {draft.amount && parseFloat(draft.amount) > 0 && draft.category && (
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wide text-[#8A8270] mb-2">
                    Was it worth it?
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => finishEntry(true)}
                      className="rounded-xl py-3 flex items-center justify-center gap-2 bg-emerald-700 text-white font-serif active:scale-95"
                    >
                      <ThumbsUp size={16} /> Worth it
                    </button>
                    <button
                      onClick={() => finishEntry(false)}
                      className="rounded-xl py-3 flex items-center justify-center gap-2 bg-orange-700 text-white font-serif active:scale-95"
                    >
                      <ThumbsDown size={16} /> Meh
                    </button>
                  </div>
                  <button
                    onClick={() => finishEntry(undefined)}
                    className="w-full text-center text-xs font-mono text-[#8A8270] mt-3 underline"
                  >
                    Skip rating
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings sheet */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-20" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-md bg-[#F8F5EE] rounded-t-2xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-serif text-lg text-[#24303D]">Settings</span>
                <button onClick={() => setShowSettings(false)} className="text-[#8A8270]">
                  <X size={18} />
                </button>
              </div>

              <label className="text-[11px] font-mono uppercase tracking-wide text-[#8A8270]">
                After-tax income / month
              </label>
              <div className="flex items-center border border-[#24303D]/15 rounded-xl px-4 py-2.5 mt-1 mb-4 bg-white">
                <span className="text-lg font-mono text-[#8A8270] mr-1">$</span>
                <input
                  type="number"
                  value={config.income}
                  onChange={(e) => setConfig((c) => ({ ...c, income: parseFloat(e.target.value) || 0 }))}
                  className="text-lg font-mono flex-1 outline-none bg-transparent text-[#24303D]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CATS.map((c) => (
                  <div key={c.id}>
                    <label className="text-[10px] font-mono uppercase text-[#8A8270]">{c.label} %</label>
                    <input
                      type="number"
                      value={config[c.pctKey]}
                      onChange={(e) =>
                        setConfig((cfg) => ({ ...cfg, [c.pctKey]: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-full text-center font-mono border border-[#24303D]/15 rounded-lg py-2 mt-1 bg-white text-[#24303D]"
                    />
                  </div>
                ))}
              </div>
              <div className={`text-[10px] font-mono mt-2 ${pctSum === 100 ? "text-[#5B7F6B]" : "text-[#B33A3A]"}`}>
                {pctSum === 100 ? "Adds up to 100%" : `Adds up to ${pctSum}% — adjust so it totals 100%`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
