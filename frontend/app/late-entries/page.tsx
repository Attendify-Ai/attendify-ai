"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import { Select, TextField } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { getLateEntries, getReviewQueue, updateLateEntry, createLateEntry, getStudents, getHouses } from "@/lib/api";

export default function LateEntriesPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date_from: "", date_to: "", house_id: "", status: "" });
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [students, setStudents] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ student_id: "", date: "", arrival_time: "" });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), page_size: "25" };
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.house_id) params.house_id = filters.house_id;
    if (filters.status) params.status = filters.status;
    const d = await getLateEntries(params);
    setEntries(d.items || []);
    setTotal(d.total || 0);
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { getReviewQueue().then((d) => setReviewCount(d.length)); }, []);
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

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Late Entries</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {total} total records{reviewCount > 0 && <span className="text-amber-400"> · {reviewCount} awaiting review</span>}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Manual Entry</Button>
      </div>

      {/* Filters */}
      <GlassCard hover={false} className="mb-5 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TextField label="From" type="date" value={filters.date_from}
            onChange={(e) => { setFilters((f) => ({ ...f, date_from: e.target.value })); setPage(1); }} />
          <TextField label="To" type="date" value={filters.date_to}
            onChange={(e) => { setFilters((f) => ({ ...f, date_to: e.target.value })); setPage(1); }} />
          <Select label="House" value={filters.house_id}
            onChange={(e) => { setFilters((f) => ({ ...f, house_id: e.target.value })); setPage(1); }}>
            <option value="">All Houses</option>
            {houses.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </Select>
          <Select label="Status" value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">All</option>
            <option value="auto_confirmed">Auto Confirmed</option>
            <option value="needs_review">Needs Review</option>
            <option value="manually_verified">Manually Verified</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>
      </GlassCard>

      <GlassCard hover={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-secondary border-b border-white/8">
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
              {loading && entries.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5"><td colSpan={9} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))}
              {!loading && entries.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-ink-faint">No entries found</td></tr>
              )}
              {entries.map((e: any, i: number) => (
                <motion.tr
                  key={e.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`}
                >
                  <td className="px-5 py-3 font-medium text-white">{e.date}</td>
                  <td className="px-5 py-3 text-white">{e.student_name || <span className="text-amber-400 font-medium">Unidentified</span>}</td>
                  <td className="px-5 py-3 text-ink-secondary">{e.student_class || "–"}</td>
                  <td className="px-5 py-3 text-ink-secondary">{e.house_name || "–"}</td>
                  <td className="px-5 py-3 text-ink-secondary">{e.arrival_time?.slice(0, 5)}</td>
                  <td className="px-5 py-3 text-ink-secondary">{e.minutes_late} min</td>
                  <td className="px-5 py-3 font-semibold text-red-400">
                    {e.status === "unknown" ? "0" : `-${e.points_deducted}`}
                  </td>
                  <td className="px-5 py-3"><Badge label={e.status} /></td>
                  <td className="px-5 py-3">
                    <button onClick={() => openEdit(e)} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">Edit</button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 25 && (
          <div className="px-5 py-3 border-t border-white/8 flex items-center gap-3 text-sm">
            <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="text-ink-secondary">Page {page} of {Math.ceil(total / 25)}</span>
            <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </GlassCard>

      {/* Edit slide-out panel */}
      <SlideOver open={!!editEntry} onClose={() => setEditEntry(null)} title="Edit Late Entry" subtitle={editEntry ? `${editEntry.date} · ${editEntry.arrival_time?.slice(0, 5)}` : undefined}>
        {editEntry && (
          <div className="space-y-5">
            <div className="glass rounded-xl p-4 text-sm">
              <div className="text-ink-secondary text-xs uppercase tracking-wide mb-1">Original</div>
              <div className="text-white font-medium">{editEntry.student_name || "Unidentified"}</div>
              <div className="text-ink-secondary text-xs mt-0.5">{editEntry.house_name} · {editEntry.date} at {editEntry.arrival_time?.slice(0, 5)}</div>
            </div>

            <Select label="Assign Student" value={editForm.student_id} onChange={(e) => setEditForm((f: any) => ({ ...f, student_id: e.target.value }))}>
              <option value="">— Unidentified —</option>
              {students.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.student_code})</option>)}
            </Select>

            <TextField label="Arrival Time" type="time" value={editForm.arrival_time}
              onChange={(e) => setEditForm((f: any) => ({ ...f, arrival_time: e.target.value }))} />

            <Select label="Status" value={editForm.status} onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}>
              <option value="auto_confirmed">Auto Confirmed</option>
              <option value="needs_review">Needs Review</option>
              <option value="manually_verified">Manually Verified</option>
              <option value="unknown">Unknown (no points deducted)</option>
            </Select>

            {editEntry.captured_image && (
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">Captured Image</label>
                <img src={`http://localhost:8000/uploads/captures/${editEntry.captured_image.split("/").pop()}`}
                  alt="Capture" className="w-40 h-40 object-cover rounded-xl border border-white/10" />
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setEditEntry(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Add Manual Entry Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Manual Late Entry">
        <form onSubmit={handleAdd} className="space-y-4">
          <Select label="Student" value={addForm.student_id} onChange={(e) => setAddForm((f) => ({ ...f, student_id: e.target.value }))} required>
            <option value="">Select student…</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.student_code})</option>)}
          </Select>
          <TextField label="Date" type="date" value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} required />
          <TextField label="Arrival Time" type="time" value={addForm.arrival_time} onChange={(e) => setAddForm((f) => ({ ...f, arrival_time: e.target.value }))} required />
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add Entry"}</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
