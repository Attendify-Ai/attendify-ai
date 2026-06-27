"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { getLateEntries, getReviewQueue, updateLateEntry, createLateEntry, getStudents, getHouses } from "@/lib/api";

export default function LateEntriesPage() {
  const [tab, setTab] = useState<"all" | "review">("all");
  const [entries, setEntries] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ date_from: "", date_to: "", house_id: "", status: "" });
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [students, setStudents] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ student_id: "", date: "", arrival_time: "" });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const params: Record<string, string> = { page: String(page), page_size: "25" };
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.house_id) params.house_id = filters.house_id;
    if (filters.status) params.status = filters.status;
    const d = await getLateEntries(params);
    setEntries(d.items || []);
    setTotal(d.total || 0);
  }, [page, filters]);

  const loadReview = async () => {
    const data = await getReviewQueue();
    setReviewQueue(data);
  };

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadReview(); }, []);
  useEffect(() => {
    getStudents().then(setStudents);
    getHouses().then(setHouses);
  }, []);

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setEditForm({
      student_id: entry.student_id || "",
      status: entry.status,
      arrival_time: entry.arrival_time?.slice(0, 5) || "",
    });
  };

  const handleEditSave = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      await updateLateEntry(editEntry.id, {
        student_id: editForm.student_id ? Number(editForm.student_id) : undefined,
        status: editForm.status,
        arrival_time: editForm.arrival_time || undefined,
      });
      setEditEntry(null);
      loadAll();
      loadReview();
    } catch {
      alert("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createLateEntry({
        student_id: Number(addForm.student_id),
        date: addForm.date,
        arrival_time: addForm.arrival_time,
      });
      setShowAdd(false);
      setAddForm({ student_id: "", date: "", arrival_time: "" });
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create entry");
    } finally {
      setSaving(false);
    }
  };

  const displayList = tab === "all" ? entries : reviewQueue;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Late Entries</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{total} total records</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg font-medium"
        >
          + Add Manual Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(["all", "review"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
            }`}
          >
            {t === "all" ? "All Entries" : `Review Queue${reviewQueue.length ? ` (${reviewQueue.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* Filters (only for All tab) */}
      {tab === "all" && (
        <Card className="mb-5 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 block mb-1">From</label>
              <input type="date" value={filters.date_from} onChange={(e) => { setFilters((f) => ({ ...f, date_from: e.target.value })); setPage(1); }}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 block mb-1">To</label>
              <input type="date" value={filters.date_to} onChange={(e) => { setFilters((f) => ({ ...f, date_to: e.target.value })); setPage(1); }}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 block mb-1">House</label>
              <select value={filters.house_id} onChange={(e) => { setFilters((f) => ({ ...f, house_id: e.target.value })); setPage(1); }}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700">
                <option value="">All Houses</option>
                {houses.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 block mb-1">Status</label>
              <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700">
                <option value="">All</option>
                <option value="auto_confirmed">Auto Confirmed</option>
                <option value="needs_review">Needs Review</option>
                <option value="manually_verified">Manually Verified</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">House</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Late</th>
                <th className="px-5 py-3 font-medium">Points</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">No entries found</td></tr>
              )}
              {displayList.map((e: any) => (
                <tr key={e.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="px-5 py-3 font-medium">{e.date}</td>
                  <td className="px-5 py-3">{e.student_name || <span className="text-yellow-600 font-medium">Unidentified</span>}</td>
                  <td className="px-5 py-3 text-gray-500">{e.student_class || "–"}</td>
                  <td className="px-5 py-3">{e.house_name || "–"}</td>
                  <td className="px-5 py-3">{e.arrival_time?.slice(0, 5)}</td>
                  <td className="px-5 py-3">{e.minutes_late} min</td>
                  <td className="px-5 py-3 font-semibold text-red-500 dark:text-red-400">
                    {e.status === "unknown" ? "0" : `-${e.points_deducted}`}
                  </td>
                  <td className="px-5 py-3"><Badge label={e.status} /></td>
                  <td className="px-5 py-3">
                    <button onClick={() => openEdit(e)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tab === "all" && total > 25 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-3 text-sm">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-40">Prev</button>
            <span className="text-gray-500">Page {page} of {Math.ceil(total / 25)}</span>
            <button disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-gray-300 dark:border-slate-600 disabled:opacity-40">Next</button>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal open={!!editEntry} onClose={() => setEditEntry(null)} title="Edit Late Entry">
        {editEntry && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm">
              <div><span className="font-medium">Original: </span>{editEntry.date} — {editEntry.arrival_time?.slice(0, 5)}</div>
              <div><span className="font-medium">Student: </span>{editEntry.student_name || "Unidentified"}</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Assign Student</label>
              <select value={editForm.student_id} onChange={(e) => setEditForm((f: any) => ({ ...f, student_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                <option value="">— Unidentified —</option>
                {students.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.student_code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Arrival Time</label>
              <input type="time" value={editForm.arrival_time} onChange={(e) => setEditForm((f: any) => ({ ...f, arrival_time: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
                <option value="auto_confirmed">Auto Confirmed</option>
                <option value="needs_review">Needs Review</option>
                <option value="manually_verified">Manually Verified</option>
                <option value="unknown">Unknown (no points deducted)</option>
              </select>
            </div>
            {editEntry.captured_image && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Captured Image</label>
                <img src={`http://localhost:8000/uploads/captures/${editEntry.captured_image.split("/").pop()}`}
                  alt="Capture" className="w-40 h-40 object-cover rounded-lg border border-gray-200 dark:border-slate-600" />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditEntry(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Manual Entry Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Manual Late Entry">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Student</label>
            <select value={addForm.student_id} onChange={(e) => setAddForm((f) => ({ ...f, student_id: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
              <option value="">Select student…</option>
              {students.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.student_code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input type="date" value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Arrival Time</label>
            <input type="time" value={addForm.arrival_time} onChange={(e) => setAddForm((f) => ({ ...f, arrival_time: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {saving ? "Adding…" : "Add Entry"}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
