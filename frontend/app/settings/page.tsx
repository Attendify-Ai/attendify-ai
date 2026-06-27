"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getCalendar, createCalendarEntry, deleteCalendarEntry } from "@/lib/api";
import api from "@/lib/api";
import { isAdmin } from "@/lib/auth";

export default function SettingsPage() {
  const [tab, setTab] = useState<"calendar" | "users">("calendar");
  const [calendar, setCalendar] = useState<any[]>([]);
  const [calendarForm, setCalendarForm] = useState({ date: "", label: "" });
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [savingCal, setSavingCal] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "teacher" });
  const [savingUser, setSavingUser] = useState(false);

  const admin = isAdmin();

  const loadCalendar = () => getCalendar().then(setCalendar);
  const loadUsers = () => api.get("/auth/users").then((r) => setUsers(r.data)).catch(() => {});

  useEffect(() => {
    loadCalendar();
    loadUsers();
  }, []);

  const handleCalendarAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCal(true);
    try {
      await createCalendarEntry({ date: calendarForm.date, label: calendarForm.label });
      setShowCalendarModal(false);
      setCalendarForm({ date: "", label: "" });
      loadCalendar();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error adding entry");
    } finally {
      setSavingCal(false);
    }
  };

  const handleCalendarDelete = async (id: number) => {
    if (!confirm("Remove this non-school day?")) return;
    await deleteCalendarEntry(id);
    loadCalendar();
  };

  const handleUserAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await api.post("/auth/register", userForm);
      setShowUserModal(false);
      setUserForm({ name: "", email: "", password: "", role: "teacher" });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error creating user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleUserDelete = async (id: number, name: string) => {
    if (!confirm(`Remove user ${name}?`)) return;
    await api.delete(`/auth/users/${id}`).catch((e) => alert(e.response?.data?.detail || "Error"));
    loadUsers();
  };

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">School calendar and user management</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(["calendar", "users"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
            }`}>
            {t === "calendar" ? "School Calendar" : "Users"}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Non-School Days</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Camera service skips scanning on these dates.</p>
            </div>
            {admin && (
              <button onClick={() => setShowCalendarModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-medium">
                + Add Holiday
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {calendar.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No holidays or non-school days added</div>
            )}
            {calendar.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className="font-medium text-sm">{e.date}</span>
                  <span className="ml-3 text-gray-500 text-sm">{e.label}</span>
                </div>
                {admin && (
                  <button onClick={() => handleCalendarDelete(e.id)} className="text-red-500 text-xs hover:underline">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "users" && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">System Users</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Admins and teachers who can access this system.</p>
            </div>
            {admin && (
              <button onClick={() => setShowUserModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-medium">
                + Add User
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  {admin && <th className="px-5 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 font-medium">{u.name}</td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3"><Badge label={u.role} /></td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{u.created_at?.slice(0, 10)}</td>
                    {admin && (
                      <td className="px-5 py-3">
                        <button onClick={() => handleUserDelete(u.id, u.name)} className="text-red-500 text-xs hover:underline">
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showCalendarModal} onClose={() => setShowCalendarModal(false)} title="Add Non-School Day">
        <form onSubmit={handleCalendarAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input type="date" value={calendarForm.date} onChange={(e) => setCalendarForm((f) => ({ ...f, date: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Label</label>
            <input value={calendarForm.label} onChange={(e) => setCalendarForm((f) => ({ ...f, label: e.target.value }))} required
              placeholder="e.g. Diwali Holiday"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCalendarModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={savingCal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {savingCal ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showUserModal} onClose={() => setShowUserModal(false)} title="Add User">
        <form onSubmit={handleUserAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input type="password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={savingUser} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {savingUser ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
