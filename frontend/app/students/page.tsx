"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { getStudentsByClass, getHouses, createStudent, updateStudent, deleteStudent, addStudentPhotos } from "@/lib/api";
import { getStoredUser, isAdmin } from "@/lib/auth";
import api from "@/lib/api";
import { houseColour, hexToRgb } from "@/lib/houseTheme";
import { STANDARDS, sectionsForStandard, parseClassString } from "@/lib/classStructure";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  enrolled: { label: "Enrolled", color: "text-green-400 bg-green-500/10 border-green-500/25" },
  photos_ready: { label: "Ready to enroll", color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
  insufficient_photos: { label: "Need more photos", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" },
  no_photos: { label: "No photos", color: "text-ink-secondary bg-white/5 border-white/10" },
};

type ClassTree = Record<string, Record<string, any[]>>;

function emptyTree(): ClassTree {
  const tree: ClassTree = {};
  for (const std of STANDARDS) {
    tree[String(std)] = {};
    for (const sec of sectionsForStandard(std)) tree[String(std)][sec] = [];
  }
  return tree;
}

function HouseBadge({ name }: { name?: string }) {
  if (!name) return <span className="text-ink-faint text-xs">—</span>;
  const colour = houseColour({ name });
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{
        background: `rgba(${hexToRgb(colour)}, 0.14)`,
        borderColor: `rgba(${hexToRgb(colour)}, 0.35)`,
        color: colour,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
      {name}
    </span>
  );
}

export default function StudentsPage() {
  const user = getStoredUser();
  const admin = isAdmin();
  const isTeacher = user?.role === "teacher";

  const [tree, setTree] = useState<ClassTree>(emptyTree());
  const [houses, setHouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedStd, setSelectedStd] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [enrollStudent, setEnrollStudent] = useState<any>(null);
  const [form, setForm] = useState({ name: "", student_code: "", standard: "", section: "", house_id: "" });
  const [saving, setSaving] = useState(false);

  const loadTree = useCallback(async () => {
    const data = await getStudentsByClass();
    setTree(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => { getHouses().then(setHouses); }, []);

  // Class teachers are hard-scoped to their own class — no sidebar, no navigation.
  const teacherClass = isTeacher ? parseClassString(user?.assigned_class) : null;
  useEffect(() => {
    if (teacherClass) {
      setSelectedStd(teacherClass.standard);
      setSelectedSection(teacherClass.section);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.assigned_class]);

  const toggleClass = (std: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(std) ? next.delete(std) : next.add(std);
      return next;
    });
  };

  const selectSection = (std: number, section: string) => {
    setSelectedStd(std);
    setSelectedSection(section);
    setExpanded((prev) => new Set(prev).add(std));
  };

  const currentList: any[] = useMemo(() => {
    if (selectedStd == null || !selectedSection) return [];
    return tree[String(selectedStd)]?.[selectedSection] ?? [];
  }, [tree, selectedStd, selectedSection]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return currentList;
    return currentList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q)
    );
  }, [currentList, search]);

  const classTotal = (std: number) =>
    Object.values(tree[String(std)] || {}).reduce((sum: number, list: any) => sum + list.length, 0);

  const openAdd = () => {
    setForm({
      name: "",
      student_code: "",
      standard: selectedStd ? String(selectedStd) : "",
      section: selectedSection || "",
      house_id: "",
    });
    setShowAdd(true);
  };

  const openEdit = (s: any) => {
    const fallback = parseClassString(s.class);
    setForm({
      name: s.name,
      student_code: s.student_code,
      standard: String(s.standard ?? fallback?.standard ?? ""),
      section: s.section ?? fallback?.section ?? "",
      house_id: String(s.house_id ?? ""),
    });
    setEditStudent(s);
  };

  const closeModal = () => {
    setShowAdd(false);
    setEditStudent(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("student_code", form.student_code);
      fd.append("standard", form.standard);
      fd.append("section", form.section);
      fd.append("house_id", form.house_id);
      if (editStudent) {
        await updateStudent(editStudent.id, fd);
      } else {
        await createStudent(fd);
      }
      closeModal();
      loadTree();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error saving student");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: any) => {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    await deleteStudent(s.id);
    loadTree();
  };

  const formValid = form.name && form.student_code && form.standard && form.section && form.house_id;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {isTeacher
              ? teacherClass
                ? `Class ${teacherClass.standard} · Section ${teacherClass.section}`
                : "No class assigned"
              : "Browse by class and section"}
          </p>
        </div>
        {admin && (selectedStd != null || !isTeacher) && (
          <Button onClick={openAdd} disabled={selectedStd == null}>+ Add Student</Button>
        )}
      </div>

      <div className={`grid gap-6 ${isTeacher ? "" : "grid-cols-1 lg:grid-cols-[280px_1fr]"}`}>
        {!isTeacher && (
          <Card className="h-fit lg:sticky lg:top-24">
            <div className="px-4 py-3 border-b border-white/8">
              <h2 className="text-sm font-semibold text-white">Classes</h2>
            </div>
            <div className="max-h-[70vh] overflow-y-auto py-2">
              {STANDARDS.map((std) => {
                const isOpen = expanded.has(std);
                const total = classTotal(std);
                return (
                  <div key={std}>
                    <button
                      onClick={() => toggleClass(std)}
                      className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                        selectedStd === std ? "text-white" : "text-ink-secondary hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`transition-transform duration-200 text-xs ${isOpen ? "rotate-90" : ""}`}>▸</span>
                        Class {std}
                      </span>
                      <span className="text-xs text-ink-faint">{total}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          {sectionsForStandard(std).map((sec) => {
                            const count = tree[String(std)]?.[sec]?.length ?? 0;
                            const active = selectedStd === std && selectedSection === sec;
                            return (
                              <button
                                key={sec}
                                onClick={() => selectSection(std, sec)}
                                className={`w-full flex items-center justify-between pl-9 pr-4 py-1.5 text-xs transition-colors ${
                                  active
                                    ? "bg-white/10 text-white font-medium border-l-2 border-cyan-400"
                                    : "text-ink-secondary hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                                }`}
                              >
                                <span>Section {sec}</span>
                                <span className="text-ink-faint">{count}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div>
          {selectedStd == null || !selectedSection ? (
            <Card className="py-16 text-center">
              <p className="text-ink-secondary text-sm">
                {isTeacher ? "Contact your administrator to get a class assigned." : "Select a class and section from the left to view students."}
              </p>
            </Card>
          ) : (
            <Card>
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Class {selectedStd} · Section {selectedSection}
                  </h2>
                  <p className="text-xs text-ink-faint mt-0.5">{currentList.length} student{currentList.length !== 1 ? "s" : ""}</p>
                </div>
                <input
                  type="text"
                  placeholder="Search by name or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3.5 py-2 text-sm rounded-lg bg-white/[0.03] border border-white/10 focus:border-white/30 outline-none text-white placeholder-ink-faint w-full sm:w-64"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-secondary border-b border-white/8">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Student ID</th>
                      <th className="px-5 py-3 font-medium">House</th>
                      <th className="px-5 py-3 font-medium">Face Enrollment</th>
                      {admin && <th className="px-5 py-3 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-faint">Loading…</td></tr>
                    )}
                    {!loading && filteredList.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-faint">No students found</td></tr>
                    )}
                    {filteredList.map((s: any) => {
                      const status = STATUS_LABELS[s.enrollment_status] || STATUS_LABELS.no_photos;
                      return (
                        <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-5 py-3 font-medium text-white">{s.name}</td>
                          <td className="px-5 py-3 text-ink-secondary font-mono text-xs">{s.student_code}</td>
                          <td className="px-5 py-3"><HouseBadge name={s.house_name} /></td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                              {s.enrollment_status === "enrolled" && "✓ "}
                              {status.label}
                            </span>
                          </td>
                          {admin && (
                            <td className="px-5 py-3">
                              <div className="flex gap-3">
                                <button onClick={() => openEdit(s)} className="text-cyan-400 hover:underline text-xs">Edit</button>
                                <button onClick={() => setEnrollStudent(s)} className="text-blue-400 hover:underline text-xs font-medium">
                                  {s.enrollment_status === "enrolled" ? "Manage Photos" : "Enroll Face"}
                                </button>
                                <button onClick={() => handleDelete(s)} className="text-red-400 hover:underline text-xs">Delete</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={showAdd || !!editStudent} onClose={closeModal} title={editStudent ? "Edit Student" : "Add Student"}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">Full Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 text-sm text-white outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">Student ID</label>
            <input
              value={form.student_code}
              onChange={(e) => setForm((f) => ({ ...f, student_code: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 text-sm text-white outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">Standard</label>
              <select
                value={form.standard}
                onChange={(e) => {
                  const std = e.target.value;
                  const valid = sectionsForStandard(Number(std));
                  setForm((f) => ({ ...f, standard: std, section: valid.includes(f.section) ? f.section : valid[0] }));
                }}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 text-sm text-white outline-none transition-colors"
              >
                <option value="" className="bg-surface">Select…</option>
                {STANDARDS.map((std) => (
                  <option key={std} value={std} className="bg-surface">Class {std}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1.5">Section</label>
              <select
                value={form.section}
                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                required
                disabled={!form.standard}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 focus:border-white/40 text-sm text-white outline-none transition-colors disabled:opacity-40"
              >
                <option value="" className="bg-surface">Select…</option>
                {(form.standard ? sectionsForStandard(Number(form.standard)) : []).map((sec) => (
                  <option key={sec} value={sec} className="bg-surface">Section {sec}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">House</label>
            <div className="flex flex-wrap gap-2">
              {houses.map((h: any) => {
                const colour = houseColour(h);
                const active = String(form.house_id) === String(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, house_id: String(h.id) }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={
                      active
                        ? { background: `rgba(${hexToRgb(colour)}, 0.18)`, borderColor: colour, color: colour }
                        : { background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "var(--foreground)" }
                    }
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: colour }} />
                    {h.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-ink-secondary hover:text-white hover:bg-white/5 rounded-lg">
              Cancel
            </button>
            <Button type="submit" disabled={saving || !formValid}>
              {saving ? "Saving…" : editStudent ? "Save Changes" : "Add Student"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Face Enrollment Modal */}
      {enrollStudent && (
        <FaceEnrollModal
          student={enrollStudent}
          onClose={() => { setEnrollStudent(null); loadTree(); }}
        />
      )}
    </AppShell>
  );
}

type CaptureMode = "upload" | "camera";

function FaceEnrollModal({ student, onClose }: { student: any; onClose: () => void }) {
  const [mode, setMode] = useState<CaptureMode>("upload");

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [capturedPreviews, setCapturedPreviews] = useState<string[]>([]);

  const [current, setCurrent] = useState<any>(student);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState("");

  const refresh = async () => {
    const data = await api.get(`/students/${student.id}`).then((r) => r.data);
    setCurrent(data);
    return data;
  };

  const triggerEnrollmentAndPoll = async () => {
    setEnrolling(true);
    setEnrollMsg("Sending to recognition server…");
    try {
      await fetch("http://localhost:8001/enroll", { method: "POST" });
      setEnrollMsg("Processing face data…");
      // Poll until enrolled or timeout (30s)
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const data = await refresh();
        if (data.enrollment_status === "enrolled") {
          setEnrollMsg("Enrolled successfully!");
          setTimeout(() => setEnrollMsg(""), 3000);
          return;
        }
        setEnrollMsg(`Processing… (${(i + 1) * 2}s)`);
      }
      setEnrollMsg("Taking longer than expected — check recognition server logs.");
    } catch {
      setEnrollMsg("Recognition server offline — start it to process face data.");
    } finally {
      setEnrolling(false);
    }
  };

  // Stop camera when switching away or closing
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permission in your browser."
          : err.name === "NotFoundError"
          ? "No camera found. Please connect a camera and try again."
          : `Camera error: ${err.message}`
      );
    }
  };

  // Switch modes — stop camera when leaving camera tab
  const handleModeSwitch = (m: CaptureMode) => {
    if (m !== "camera") stopCamera();
    setMode(m);
  };

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      setCapturedFiles((prev) => [...prev, file]);
      setCapturedPreviews((prev) => [...prev, dataUrl]);
    }, "image/jpeg", 0.92);
  };

  const removeCapture = (i: number) => {
    setCapturedFiles((prev) => prev.filter((_, idx) => idx !== i));
    setCapturedPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleUploadFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setUploadFiles(arr);
    setUploadPreviews(arr.map((f) => URL.createObjectURL(f)));
  };

  const submitPhotos = async (files: File[]) => {
    if (files.length < 3) {
      alert("Please capture or select at least 3 photos for reliable face recognition.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("photos", f));
      await addStudentPhotos(student.id, fd);
      setUploadFiles([]);
      setUploadPreviews([]);
      setCapturedFiles([]);
      setCapturedPreviews([]);
      stopCamera();
      await refresh();
      // Immediately trigger face embedding computation
      triggerEnrollmentAndPoll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Remove all photos and face embeddings for this student?")) return;
    setClearing(true);
    try {
      await api.delete(`/students/${student.id}/photos`);
      await refresh();
    } catch {
      alert("Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  const status = STATUS_LABELS[current.enrollment_status] || STATUS_LABELS.no_photos;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-hi rounded-2xl shadow-glass w-full max-w-2xl border border-white/10 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Face Enrollment — {current.name}</h2>
            <p className="text-xs text-ink-secondary mt-0.5">{current.student_code} · Class {current.standard}{current.section} · {current.house_name}</p>
          </div>
          <button onClick={onClose} className="text-ink-secondary hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5">✕</button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-5">
          {/* Status Banner */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${status.color}`}>
            <div className="text-lg">
              {current.enrollment_status === "enrolled" && "✅"}
              {current.enrollment_status === "photos_ready" && "📸"}
              {current.enrollment_status === "insufficient_photos" && "⚠️"}
              {current.enrollment_status === "no_photos" && "📷"}
            </div>
            <div>
              <div>{status.label}</div>
              <div className="text-xs opacity-75 font-normal mt-0.5">
                {current.enrollment_status === "enrolled" &&
                  `Face recognition active · ${current.photo_count} photos stored · Camera service will auto-detect this student.`}
                {current.enrollment_status === "photos_ready" &&
                  `${current.photo_count} photos uploaded · Camera service will compute face embeddings on next start.`}
                {current.enrollment_status === "insufficient_photos" &&
                  `${current.photo_count} photo(s) stored — need at least 3 for reliable recognition. Add more below.`}
                {current.enrollment_status === "no_photos" &&
                  "No photos yet. Take 3–5 clear face photos using the camera or upload from files."}
              </div>
            </div>
          </div>

          {/* Enrollment progress banner */}
          {(enrolling || enrollMsg) && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border ${
              enrollMsg.includes("successfully") ? "bg-green-500/10 border-green-500/25 text-green-400" :
              enrollMsg.includes("offline") || enrollMsg.includes("longer") ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-400" :
              "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
            }`}>
              {enrolling && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />}
              {!enrolling && enrollMsg.includes("successfully") && <span>✅</span>}
              {!enrolling && !enrollMsg.includes("successfully") && <span>⚠️</span>}
              <span>{enrollMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => handleModeSwitch("camera")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mode === "camera" ? "bg-white text-black" : "text-ink-secondary hover:bg-white/5"
              }`}
            >
              📷 Use Camera
            </button>
            <button
              onClick={() => handleModeSwitch("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-white/10 ${
                mode === "upload" ? "bg-white text-black" : "text-ink-secondary hover:bg-white/5"
              }`}
            >
              📤 Upload Files
            </button>
          </div>

          {/* === CAMERA MODE === */}
          {mode === "camera" && (
            <div className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-3 text-xs text-cyan-300">
                <strong>Tips:</strong> Capture 3–5 photos · Vary angles (front, slight left/right) · Use good lighting · No glasses or masks
              </div>

              {/* Video preview */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    {cameraError ? (
                      <div className="text-center px-6">
                        <div className="text-3xl mb-2">⚠️</div>
                        <p className="text-sm text-red-400">{cameraError}</p>
                      </div>
                    ) : (
                      <>
                        <div className="text-4xl">📷</div>
                        <p className="text-sm text-ink-faint">Camera not started</p>
                      </>
                    )}
                  </div>
                )}

                {/* Face guide overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-44 h-56 border-2 border-white/60 rounded-full" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
                  </div>
                )}
              </div>

              {/* Camera controls */}
              <div className="flex gap-3">
                {!cameraActive ? (
                  <Button onClick={startCamera} className="flex-1">Start Camera</Button>
                ) : (
                  <>
                    <Button onClick={captureFrame} variant="success" className="flex-1">
                      📸 Capture ({capturedFiles.length} / 5)
                    </Button>
                    <Button onClick={stopCamera} variant="secondary">Stop</Button>
                  </>
                )}
              </div>

              {/* Captured preview grid */}
              {capturedPreviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      {capturedPreviews.length} captured
                      {capturedPreviews.length < 3 && <span className="text-yellow-400 ml-2">(need at least 3)</span>}
                    </span>
                    <button onClick={() => { setCapturedFiles([]); setCapturedPreviews([]); }} className="text-xs text-red-400 hover:underline">Clear all</button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {capturedPreviews.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`Capture ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-white/10" />
                        <button
                          onClick={() => removeCapture(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => submitPhotos(capturedFiles)}
                    disabled={uploading || capturedFiles.length < 3}
                    className="w-full mt-3"
                  >
                    {uploading ? "Uploading…" : `Save ${capturedFiles.length} Photo${capturedFiles.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* === UPLOAD MODE === */}
          {mode === "upload" && (
            <div className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-3 text-xs text-cyan-300">
                <strong>Photo Guidelines:</strong> 3–5 photos minimum · Different angles (front, left, right) · Good lighting · No sunglasses or face masks
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUploadFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-white/40 bg-white/5" : "border-white/15 hover:border-white/30"
                }`}
              >
                <div className="text-3xl mb-2">📤</div>
                <div className="text-sm font-medium text-white">
                  Drag & drop photos here, or click to browse
                </div>
                <div className="text-xs text-ink-faint mt-1">JPG, PNG · Select multiple files · Min 3 required</div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUploadFiles(e.target.files)} className="hidden" />
              </div>

              {uploadPreviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      {uploadPreviews.length} photo{uploadPreviews.length !== 1 ? "s" : ""} selected
                      {uploadPreviews.length < 3 && <span className="text-yellow-400 ml-2">(need at least 3)</span>}
                    </span>
                    <button onClick={() => { setUploadFiles([]); setUploadPreviews([]); }} className="text-xs text-red-400 hover:underline">Clear</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {uploadPreviews.map((url, i) => (
                      <img key={i} src={url} alt={`Preview ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-white/10" />
                    ))}
                  </div>
                  <Button
                    onClick={() => submitPhotos(uploadFiles)}
                    disabled={uploading || uploadFiles.length < 3}
                    className="w-full mt-3"
                  >
                    {uploading ? "Uploading…" : `Upload ${uploadPreviews.length} Photo${uploadPreviews.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Currently stored photos info */}
          {current.photo_count > 0 && (
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-secondary">
                  {current.photo_count} photo{current.photo_count !== 1 ? "s" : ""} stored on server
                </span>
                <button onClick={handleClear} disabled={clearing} className="text-xs text-red-400 hover:underline disabled:opacity-50">
                  {clearing ? "Clearing…" : "Remove all & re-enroll"}
                </button>
              </div>
              <p className="text-xs text-ink-faint mt-1">
                The camera service reads these to build face recognition data. Remove all and re-upload to re-train.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
