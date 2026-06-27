"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { getStudents, getHouses, createStudent, updateStudent, deleteStudent, addStudentPhotos } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import api from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  enrolled: { label: "Enrolled", color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
  photos_ready: { label: "Ready to enroll", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
  insufficient_photos: { label: "Need more photos", color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20" },
  no_photos: { label: "No photos", color: "text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800" },
};

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [houseFilter, setHouseFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [enrollStudent, setEnrollStudent] = useState<any>(null);
  const [form, setForm] = useState({ name: "", student_code: "", class_: "", house_id: "" });
  const [saving, setSaving] = useState(false);
  const admin = isAdmin();

  const loadStudents = useCallback(async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (houseFilter) params.house_id = houseFilter;
    const data = await getStudents(params);
    setStudents(data);
  }, [search, houseFilter]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { getHouses().then(setHouses); }, []);

  const openAdd = () => {
    setForm({ name: "", student_code: "", class_: "", house_id: "" });
    setShowAdd(true);
  };

  const openEdit = (s: any) => {
    setForm({ name: s.name, student_code: s.student_code, class_: s.class, house_id: String(s.house_id) });
    setEditStudent(s);
  };

  const triggerEnrollment = async () => {
    try {
      await fetch("http://localhost:8001/enroll", { method: "POST" });
    } catch {
      // recognition server offline — enrollment will happen next time it starts
    }
  };

  const handleFormSubmit = async (e: React.FormEvent, photos: File[]) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("student_code", form.student_code);
      fd.append("class_", form.class_);
      fd.append("house_id", form.house_id);
      photos.forEach((f) => fd.append("photos", f));
      if (editStudent) {
        await updateStudent(editStudent.id, fd);
        setEditStudent(null);
      } else {
        await createStudent(fd);
        setShowAdd(false);
      }
      if (photos.length >= 3) triggerEnrollment();
      loadStudents();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error saving student");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: any) => {
    if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    await deleteStudent(s.id);
    loadStudents();
  };

  const enrolledCount = students.filter((s) => s.enrollment_status === "enrolled").length;
  const pendingCount = students.filter((s) => s.enrollment_status === "photos_ready").length;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {students.length} students · {enrolledCount} face-enrolled · {pendingCount} pending enrollment
          </p>
        </div>
        {admin && (
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg font-medium">
            + Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input type="text" placeholder="Search by name or code…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700" />
        <select value={houseFilter} onChange={(e) => setHouseFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700">
          <option value="">All Houses</option>
          {houses.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">House</th>
                <th className="px-5 py-3 font-medium">Face Enrollment</th>
                {admin && <th className="px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No students found</td></tr>
              )}
              {students.map((s: any) => {
                const status = STATUS_LABELS[s.enrollment_status] || STATUS_LABELS.no_photos;
                return (
                  <tr key={s.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.student_code}</td>
                    <td className="px-5 py-3">{s.class}</td>
                    <td className="px-5 py-3">{s.house_name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {s.enrollment_status === "enrolled" && "✓ "}
                        {status.label}
                        {s.photo_count > 0 && <span className="opacity-60">({s.photo_count} photos)</span>}
                      </span>
                    </td>
                    {admin && (
                      <td className="px-5 py-3">
                        <div className="flex gap-3">
                          <button onClick={() => openEdit(s)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                          <button onClick={() => setEnrollStudent(s)} className="text-blue-600 hover:underline text-xs font-medium">
                            {s.enrollment_status === "enrolled" ? "Manage Photos" : "Enroll Face"}
                          </button>
                          <button onClick={() => handleDelete(s)} className="text-red-500 hover:underline text-xs">Delete</button>
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

      {/* Add / Edit Modal */}
      <Modal open={showAdd || !!editStudent} onClose={() => { setShowAdd(false); setEditStudent(null); }}
        title={editStudent ? "Edit Student" : "Add Student"}>
        <StudentFormModal
          form={form}
          setForm={setForm}
          onSubmit={handleFormSubmit}
          onClose={() => { setShowAdd(false); setEditStudent(null); }}
          isEdit={!!editStudent}
          saving={saving}
        />
      </Modal>

      {/* Face Enrollment Modal */}
      {enrollStudent && (
        <FaceEnrollModal
          student={enrollStudent}
          onClose={() => { setEnrollStudent(null); loadStudents(); }}
        />
      )}
    </AppShell>
  );
}

function StudentFormModal({ form, setForm, onSubmit, onClose, isEdit, saving }: any) {
  const [houses, setHouses] = useState<any[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoMode, setPhotoMode] = useState<"camera" | "upload">("camera");
  const [previews, setPreviews] = useState<string[]>([]);

  // Camera refs/state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getHouses().then(setHouses); }, []);

  // Stop camera when unmounted or switching away
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

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
        err.name === "NotAllowedError" ? "Camera access denied." :
        err.name === "NotFoundError" ? "No camera found." :
        `Camera error: ${err.message}`
      );
    }
  };

  const switchMode = (m: "camera" | "upload") => {
    if (m !== "camera") stopCamera();
    setPhotoMode(m);
  };

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
      setPhotos((prev) => [...prev, file]);
      setPreviews((prev) => [...prev, dataUrl]);
    }, "image/jpeg", 0.92);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setPhotos((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    stopCamera();
    onSubmit(e, photos);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Profile fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1.5">Full Name</label>
          <input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Student Code / ID</label>
          <input value={form.student_code} onChange={(e) => setForm((f: any) => ({ ...f, student_code: e.target.value }))} required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Class</label>
          <input value={form.class_} onChange={(e) => setForm((f: any) => ({ ...f, class_: e.target.value }))} required
            placeholder="e.g. 9A"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1.5">House</label>
          <select value={form.house_id} onChange={(e) => setForm((f: any) => ({ ...f, house_id: e.target.value }))} required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm">
            <option value="">Select house…</option>
            {houses.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
      </div>

      {/* Face Photos section — only on Add, not Edit */}
      {!isEdit && (
        <div className="border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Face Photos</span>
              <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">optional — 3–5 for best accuracy</span>
            </div>
            {/* Mode tabs */}
            <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-xs">
              <button type="button" onClick={() => switchMode("camera")}
                className={`px-3 py-1.5 font-medium transition-colors ${photoMode === "camera" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600"}`}>
                📷 Camera
              </button>
              <button type="button" onClick={() => switchMode("upload")}
                className={`px-3 py-1.5 font-medium border-l border-gray-200 dark:border-slate-600 transition-colors ${photoMode === "upload" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600"}`}>
                📤 Upload
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* CAMERA mode */}
            {photoMode === "camera" && (
              <div className="space-y-2">
                {/* Compact video preview */}
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "4/3", maxHeight: "200px" }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`} />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      {cameraError
                        ? <p className="text-xs text-red-400 px-4 text-center">{cameraError}</p>
                        : <>
                            <span className="text-3xl">📷</span>
                            <p className="text-xs text-gray-400">Camera off</p>
                          </>
                      }
                    </div>
                  )}
                  {/* Face guide oval */}
                  {cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-white/50 rounded-full"
                        style={{ width: "45%", height: "75%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }} />
                    </div>
                  )}
                </div>

                {/* Camera controls */}
                <div className="flex gap-2">
                  {!cameraActive ? (
                    <button type="button" onClick={startCamera}
                      className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium">
                      Start Camera
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={captureFrame}
                        className="flex-1 text-sm bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium">
                        📸 Capture ({photos.length})
                      </button>
                      <button type="button" onClick={stopCamera}
                        className="px-3 py-2 text-sm bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-700 dark:text-slate-200 rounded-lg">
                        Stop
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* UPLOAD mode */}
            {photoMode === "upload" && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-indigo-400 rounded-lg p-5 text-center cursor-pointer transition-colors">
                <div className="text-2xl mb-1">📤</div>
                <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">Click to browse files</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG · select multiple</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)} />
              </div>
            )}

            {/* Shared preview grid */}
            {previews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {photos.length} photo{photos.length !== 1 ? "s" : ""}
                    {photos.length > 0 && photos.length < 3 &&
                      <span className="text-yellow-500 ml-1.5">(add {3 - photos.length} more for best results)</span>}
                    {photos.length >= 3 && <span className="text-green-500 ml-1.5">✓ good to go</span>}
                  </span>
                  <button type="button" onClick={() => { setPhotos([]); setPreviews([]); }}
                    className="text-xs text-red-500 hover:underline">Clear all</button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {previews.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-slate-600" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center leading-none">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photos.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
                No photos added — you can enroll the face later from the Students list.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={() => { stopCamera(); onClose(); }}
          className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
          {saving ? "Saving…" : isEdit ? "Save Changes" : photos.length > 0 ? `Add Student + ${photos.length} Photo${photos.length !== 1 ? "s" : ""}` : "Add Student"}
        </button>
      </div>
    </form>
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-700 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold">Face Enrollment — {current.name}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{current.student_code} · {current.class} · {current.house_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 flex-1 overflow-y-auto space-y-5">
          {/* Status Banner */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${status.color}`}>
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
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
              enrollMsg.includes("successfully") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" :
              enrollMsg.includes("offline") || enrollMsg.includes("longer") ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300" :
              "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
            }`}>
              {enrolling && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />}
              {!enrolling && enrollMsg.includes("successfully") && <span>✅</span>}
              {!enrolling && !enrollMsg.includes("successfully") && <span>⚠️</span>}
              <span>{enrollMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => handleModeSwitch("camera")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mode === "camera"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              📷 Use Camera
            </button>
            <button
              onClick={() => handleModeSwitch("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 dark:border-slate-700 ${
                mode === "upload"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              📤 Upload Files
            </button>
          </div>

          {/* === CAMERA MODE === */}
          {mode === "camera" && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300">
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
                        <p className="text-sm text-gray-400">Camera not started</p>
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
                  <button
                    onClick={startCamera}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg"
                  >
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={captureFrame}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg"
                    >
                      📸 Capture ({capturedFiles.length} / 5)
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2.5 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-700 dark:text-slate-200 text-sm font-medium rounded-lg"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>

              {/* Captured preview grid */}
              {capturedPreviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      {capturedPreviews.length} captured
                      {capturedPreviews.length < 3 && <span className="text-yellow-500 ml-2">(need at least 3)</span>}
                    </span>
                    <button onClick={() => { setCapturedFiles([]); setCapturedPreviews([]); }} className="text-xs text-red-500 hover:underline">Clear all</button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {capturedPreviews.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`Capture ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-slate-600" />
                        <button
                          onClick={() => removeCapture(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => submitPhotos(capturedFiles)}
                    disabled={uploading || capturedFiles.length < 3}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {uploading ? "Uploading…" : `Save ${capturedFiles.length} Photo${capturedFiles.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* === UPLOAD MODE === */}
          {mode === "upload" && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300">
                <strong>Photo Guidelines:</strong> 3–5 photos minimum · Different angles (front, left, right) · Good lighting · No sunglasses or face masks
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUploadFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-300 dark:border-slate-600 hover:border-indigo-400"
                }`}
              >
                <div className="text-3xl mb-2">📤</div>
                <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Drag & drop photos here, or click to browse
                </div>
                <div className="text-xs text-gray-400 mt-1">JPG, PNG · Select multiple files · Min 3 required</div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUploadFiles(e.target.files)} className="hidden" />
              </div>

              {uploadPreviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      {uploadPreviews.length} photo{uploadPreviews.length !== 1 ? "s" : ""} selected
                      {uploadPreviews.length < 3 && <span className="text-yellow-600 ml-2">(need at least 3)</span>}
                    </span>
                    <button onClick={() => { setUploadFiles([]); setUploadPreviews([]); }} className="text-xs text-red-500 hover:underline">Clear</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {uploadPreviews.map((url, i) => (
                      <img key={i} src={url} alt={`Preview ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-slate-600" />
                    ))}
                  </div>
                  <button
                    onClick={() => submitPhotos(uploadFiles)}
                    disabled={uploading || uploadFiles.length < 3}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {uploading ? "Uploading…" : `Upload ${uploadPreviews.length} Photo${uploadPreviews.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Currently stored photos info */}
          {current.photo_count > 0 && (
            <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-slate-300">
                  {current.photo_count} photo{current.photo_count !== 1 ? "s" : ""} stored on server
                </span>
                <button onClick={handleClear} disabled={clearing} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                  {clearing ? "Clearing…" : "Remove all & re-enroll"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                The camera service reads these to build face recognition data. Remove all and re-upload to re-train.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-sm font-medium rounded-lg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
