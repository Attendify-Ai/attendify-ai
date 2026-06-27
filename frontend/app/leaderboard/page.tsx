"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { getHouses, getHouseHistory, adjustPoints } from "@/lib/api";
import { isAdmin } from "@/lib/auth";

const HOUSE_COLORS = [
  { card: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  { card: "bg-red-500",   light: "bg-red-50 dark:bg-red-900/20",     text: "text-red-700 dark:text-red-300",     border: "border-red-300 dark:border-red-700" },
  { card: "bg-blue-500",  light: "bg-blue-50 dark:bg-blue-900/20",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-700" },
  { card: "bg-green-500", light: "bg-green-50 dark:bg-green-900/20", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
];
const RANK_LABELS = ["🥇", "🥈", "🥉", "4th"];
const QUICK_AMOUNTS = [5, 10, 25, 50];

export default function LeaderboardPage() {
  const [houses, setHouses] = useState<any[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);
  const [adjustForm, setAdjustForm] = useState({ points: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const admin = isAdmin();

  const loadHouses = () => getHouses().then((data) => {
    setHouses(data);
    // Keep selected house in sync
    setSelectedHouse((prev: any) => prev ? data.find((h: any) => h.id === prev.id) || prev : null);
  }).catch(console.error);

  useEffect(() => { loadHouses(); }, []);

  const openHistory = async (house: any) => {
    setSelectedHouse(house);
    const data = await getHouseHistory(house.id);
    setHistory(data.history || []);
  };

  const openAdjust = (house: any, sign: 1 | -1) => {
    setSelectedHouse(house);
    setAdjustSign(sign);
    setAdjustForm({ points: "", reason: "" });
    setShowAdjust(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse) return;
    const pts = Math.abs(Number(adjustForm.points)) * adjustSign;
    if (pts === 0) return;
    setSaving(true);
    try {
      await adjustPoints(selectedHouse.id, pts, adjustForm.reason);
      setShowAdjust(false);
      await loadHouses();
      const data = await getHouseHistory(selectedHouse.id);
      setHistory(data.history || []);
    } catch {
      alert("Failed to adjust points");
    } finally {
      setSaving(false);
    }
  };

  const color = (house: any) => HOUSE_COLORS[(houses.indexOf(house)) % HOUSE_COLORS.length];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">House Leaderboard</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Live standings · click a house to see full history</p>
      </div>

      {/* House cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {houses.map((house, idx) => {
          const c = HOUSE_COLORS[idx % HOUSE_COLORS.length];
          return (
            <div key={house.id} className="rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
              {/* Coloured header */}
              <button
                onClick={() => openHistory(house)}
                className={`w-full ${c.card} text-white px-5 pt-5 pb-4 text-left hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-2xl">{RANK_LABELS[house.rank - 1]}</div>
                  <div className="text-right">
                    <div className="text-3xl font-black leading-none">{house.current_points}</div>
                    <div className="text-xs opacity-75 mt-0.5">points</div>
                  </div>
                </div>
                <div className="text-lg font-bold mt-3">{house.name}</div>
                <div className="text-xs opacity-75 mt-0.5">{house.total_late_entries} late entries this year</div>
              </button>

              {/* Quick point buttons — admin only */}
              {admin && (
                <div className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => openAdjust(house, 1)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 text-sm font-semibold transition-colors border border-green-200 dark:border-green-800"
                  >
                    + Add Points
                  </button>
                  <button
                    onClick={() => openAdjust(house, -1)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-semibold transition-colors border border-red-200 dark:border-red-800"
                  >
                    − Deduct
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Point history panel */}
      {selectedHouse && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{selectedHouse.name} — Point History</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">All point changes including late entry deductions</p>
            </div>
            {admin && (
              <button onClick={() => openAdjust(selectedHouse, 1)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-medium">
                Adjust Points
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
            {history.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No history yet</div>
            )}
            {history.map((h: any, i: number) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0 pr-4">
                  <span className="font-medium text-gray-800 dark:text-slate-200">{h.reason}</span>
                  {h.by && <span className="text-gray-400 ml-2 text-xs">by {h.by}</span>}
                  <div className="text-xs text-gray-400 mt-0.5">{h.at ? new Date(h.at).toLocaleString() : ""}</div>
                </div>
                <div className={`font-bold text-base shrink-0 ${h.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {h.points > 0 ? "+" : ""}{h.points}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Adjust points modal */}
      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title={`${adjustSign === 1 ? "Add Points" : "Deduct Points"} — ${selectedHouse?.name}`}
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          {/* Sign toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
            <button type="button" onClick={() => setAdjustSign(1)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${adjustSign === 1 ? "bg-green-600 text-white" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>
              + Add Points
            </button>
            <button type="button" onClick={() => setAdjustSign(-1)}
              className={`flex-1 py-2.5 text-sm font-semibold border-l border-gray-200 dark:border-slate-600 transition-colors ${adjustSign === -1 ? "bg-red-600 text-white" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>
              − Deduct Points
            </button>
          </div>

          {/* Quick amounts */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-2">Quick amounts</label>
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button key={amt} type="button"
                  onClick={() => setAdjustForm((f) => ({ ...f, points: String(amt) }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    adjustForm.points === String(amt)
                      ? adjustSign === 1 ? "bg-green-600 text-white border-green-600" : "bg-red-600 text-white border-red-600"
                      : "border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}>
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Points <span className="text-gray-400 font-normal">(or enter custom)</span>
            </label>
            <input
              type="number"
              min="1"
              value={adjustForm.points}
              onChange={(e) => setAdjustForm((f) => ({ ...f, points: e.target.value }))}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              placeholder="e.g. 20"
            />
          </div>

          {/* Reason / statement */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Statement / Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
              required
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm resize-none"
              placeholder="e.g. Won inter-house cricket tournament · Community service award · Disciplinary deduction"
            />
            <p className="text-xs text-gray-400 mt-1">This will appear in the point history log.</p>
          </div>

          {/* Preview */}
          {adjustForm.points && adjustForm.reason && (
            <div className={`rounded-lg px-4 py-3 text-sm border ${adjustSign === 1 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
              <span className="font-bold">{adjustSign === 1 ? "+" : "−"}{adjustForm.points} pts</span>
              <span className="mx-2 opacity-50">·</span>
              <span>{adjustForm.reason}</span>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowAdjust(false)}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving || !adjustForm.points || !adjustForm.reason}
              className={`px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${adjustSign === 1 ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
              {saving ? "Saving…" : adjustSign === 1 ? `Add ${adjustForm.points || "?"} pts` : `Deduct ${adjustForm.points || "?"} pts`}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
