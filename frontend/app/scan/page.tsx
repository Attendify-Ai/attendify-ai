"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import api from "@/lib/api";

const RECOGNITION_URL = "http://localhost:8001";
const SCAN_INTERVAL_MS = 2000;

interface Detection {
  student_id: number | null;
  house_id: number | null;
  confidence: number;
  name: string | null;
  house_name: string | null;
  student_code: string | null;
  above_threshold: boolean;
}

interface ScanResponse {
  face_count: number;
  detections: Detection[];
}

interface LogEntry {
  id: number;
  student_name: string;
  house_name: string;
  arrival_time: string;
  confidence: number;
  status: string;
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggedTodayRef = useRef<Set<number>>(new Set());

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [autoLog, setAutoLog] = useState(true);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);

  const [lastScan, setLastScan] = useState<ScanResponse | null>(null);
  const [lastScanned, setLastScanned] = useState("");
  const [todayEntries, setTodayEntries] = useState<LogEntry[]>([]);
  const [loggingIds, setLoggingIds] = useState<Set<number>>(new Set());
  const [flashMsg, setFlashMsg] = useState<{ text: string; type: "ok" | "warn" | "err" } | null>(null);

  const flash = (text: string, type: "ok" | "warn" | "err" = "ok") => {
    setFlashMsg({ text, type });
    setTimeout(() => setFlashMsg(null), 3500);
  };

  const checkServer = useCallback(async () => {
    try {
      const r = await fetch(`${RECOGNITION_URL}/health`);
      const data = await r.json();
      setServerOnline(true);
      setEnrolledCount(data.enrolled_students || 0);
    } catch {
      setServerOnline(false);
    }
  }, []);

  const loadTodayEntries = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const r = await api.get("/late-entries/", { params: { date_from: today, date_to: today, limit: 100 } });
      const items: LogEntry[] = (r.data.items || []).map((e: any) => ({
        id: e.id,
        student_name: e.student_name || "Unknown",
        house_name: e.house_name || "—",
        arrival_time: e.arrival_time,
        confidence: e.confidence_score,
        status: e.status,
      }));
      setTodayEntries(items);
    } catch { /* silently ignore */ }
  }, []);

  useEffect(() => {
    checkServer();
    loadTodayEntries();
  }, [checkServer, loadTodayEntries]);

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError" ? "Camera access denied. Allow camera in browser settings." :
        err.name === "NotFoundError" ? "No camera detected." :
        `Camera error: ${err.message}`
      );
    }
  };

  const stopCamera = () => {
    stopScanning();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setLastScan(null);
  };

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  };

  const logDetection = useCallback(async (det: Detection) => {
    if (!det.student_id || !det.above_threshold) return;
    if (loggedTodayRef.current.has(det.student_id)) return;

    setLoggingIds((prev) => { const s = new Set(Array.from(prev)); s.add(det.student_id!); return s; });
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      await api.post("/late-entries/from-recognition", {
        student_id: det.student_id,
        house_id: det.house_id,
        arrival_time: timeStr,
        date: now.toISOString().split("T")[0],
        confidence_score: det.confidence,
      });
      loggedTodayRef.current.add(det.student_id!);
      flash(`Logged: ${det.name} at ${timeStr}`, "ok");
      loadTodayEntries();
    } catch (err: any) {
      const detail = err.response?.data?.detail || "";
      if (detail.includes("already") || detail.includes("duplicate")) {
        loggedTodayRef.current.add(det.student_id!);
        flash(`${det.name} already logged today`, "warn");
      } else {
        flash(`Log failed: ${detail || "error"}`, "err");
      }
    } finally {
      setLoggingIds((prev) => { const s = new Set(Array.from(prev)); s.delete(det.student_id!); return s; });
    }
  }, [loadTodayEntries]);

  const scanOnce = useCallback(async () => {
    if (!serverOnline) return;
    const b64 = captureFrame();
    if (!b64) return;

    try {
      const r = await fetch(`${RECOGNITION_URL}/recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_b64: b64 }),
      });
      const result: ScanResponse = await r.json();
      setLastScan(result);
      setLastScanned(new Date().toLocaleTimeString());

      if (autoLog) {
        for (const det of result.detections) {
          if (det.above_threshold) await logDetection(det);
        }
      }
    } catch { /* recognition server busy, skip frame */ }
  }, [serverOnline, autoLog, logDetection]);

  const startScanning = () => {
    if (intervalRef.current) return;
    setScanning(true);
    intervalRef.current = setInterval(scanOnce, SCAN_INTERVAL_MS);
  };

  const stopScanning = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setScanning(false);
  };

  // Reset logged set at midnight
  useEffect(() => {
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const t = setTimeout(() => { loggedTodayRef.current = new Set(); }, msUntilMidnight);
    return () => clearTimeout(t);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopCamera(); }, []);

  const confirmed = lastScan?.detections.filter((d) => d.above_threshold) ?? [];
  const unknown   = lastScan?.detections.filter((d) => !d.above_threshold) ?? [];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Scan</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{today} · {todayEntries.length} entries logged today</p>
        </div>
        <button onClick={checkServer}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700">
          <span className={`w-2 h-2 rounded-full ${serverOnline === null ? "bg-gray-400" : serverOnline ? "bg-green-500" : "bg-red-500"}`} />
          {serverOnline === null ? "Checking…" : serverOnline ? `Recognition server · ${enrolledCount} enrolled` : "Server offline"}
        </button>
      </div>

      {/* Server offline notice */}
      {serverOnline === false && (
        <div className="mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          <div className="font-semibold mb-2">Recognition server is not running</div>
          <div className="font-mono text-xs bg-red-100 dark:bg-red-900/30 rounded-lg p-3 space-y-1">
            <div>cd /Users/akshay/Desktop/attendify/camera-service</div>
            <div>./venv/bin/python recognition_server.py</div>
          </div>
        </div>
      )}

      {/* Flash message */}
      {flashMsg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
          flashMsg.type === "ok" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" :
          flashMsg.type === "warn" ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300" :
          "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
        }`}>{flashMsg.text}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Camera Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            {/* Video */}
            <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <video ref={videoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`} />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {cameraError
                    ? <div className="text-center px-8"><div className="text-4xl mb-3">⚠️</div><p className="text-sm text-red-400">{cameraError}</p></div>
                    : <><div className="text-5xl">📷</div><p className="text-gray-400 text-sm">Camera not started</p><p className="text-gray-500 text-xs">Click Start Camera below</p></>
                  }
                </div>
              )}

              {/* Scanning badge */}
              {scanning && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Scanning · {lastScan ? `${lastScan.face_count} face${lastScan.face_count !== 1 ? "s" : ""}` : "waiting…"}
                </div>
              )}
              {lastScanned && (
                <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                  Last: {lastScanned}
                </div>
              )}
            </div>

            {/* Multi-face detection results */}
            {lastScan && lastScan.face_count === 0 && (
              <div className="mt-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 text-sm text-gray-400 dark:text-slate-500 text-center">
                No faces detected in frame
              </div>
            )}

            {lastScan && lastScan.face_count > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {lastScan.face_count} face{lastScan.face_count !== 1 ? "s" : ""} detected
                  </span>
                  <span className="text-xs text-gray-400">
                    {confirmed.length} matched · {unknown.length} unknown
                  </span>
                </div>

                {/* One card per detected face */}
                {lastScan.detections.map((det, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
                    det.above_threshold
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                  }`}>
                    <div className="text-xl shrink-0">
                      {det.above_threshold ? "✅" : "❓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      {det.above_threshold ? (
                        <>
                          <div className="font-semibold text-green-800 dark:text-green-200">{det.name}</div>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                            {det.house_name} · {(det.confidence * 100).toFixed(0)}% confidence
                            {loggedTodayRef.current.has(det.student_id!) && (
                              <span className="ml-2 text-green-500">✓ logged today</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-yellow-800 dark:text-yellow-200">Unknown face</div>
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                            {det.name
                              ? `Closest: ${det.name} (${(det.confidence * 100).toFixed(0)}% — below threshold)`
                              : "Not in database · will go to review queue"}
                          </div>
                        </>
                      )}
                    </div>
                    {/* Manual log button when auto-log is off */}
                    {!autoLog && det.above_threshold && !loggedTodayRef.current.has(det.student_id!) && (
                      <button
                        onClick={() => logDetection(det)}
                        disabled={loggingIds.has(det.student_id!)}
                        className="shrink-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                      >
                        {loggingIds.has(det.student_id!) ? "…" : "Log"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="mt-4 flex items-center gap-3">
              {!cameraActive ? (
                <button onClick={startCamera} disabled={serverOnline === false}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg">
                  Start Camera
                </button>
              ) : (
                <>
                  {!scanning ? (
                    <button onClick={startScanning} disabled={!serverOnline}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg">
                      Start Scanning
                    </button>
                  ) : (
                    <button onClick={stopScanning}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold py-2.5 rounded-lg">
                      Pause Scanning
                    </button>
                  )}
                  <button onClick={scanOnce} disabled={scanning || !serverOnline}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg">
                    Scan Once
                  </button>
                  <button onClick={stopCamera}
                    className="px-4 py-2.5 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-700 dark:text-slate-200 text-sm font-medium rounded-lg">
                    Stop
                  </button>
                </>
              )}
            </div>

            {/* Auto-log toggle */}
            {cameraActive && (
              <div className="mt-3 flex items-center gap-2.5 px-1">
                <button onClick={() => setAutoLog((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${autoLog ? "bg-indigo-600" : "bg-gray-300 dark:bg-slate-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoLog ? "translate-x-5" : ""}`} />
                </button>
                <span className="text-sm text-gray-600 dark:text-slate-300">
                  Auto-log on match{" "}
                  {autoLog
                    ? <span className="text-indigo-600 dark:text-indigo-400 font-medium">(on)</span>
                    : <span className="text-gray-400">(off — use Log button per face)</span>}
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Today&apos;s Entries</h2>
              <button onClick={loadTodayEntries} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Refresh</button>
            </div>
            {todayEntries.length === 0
              ? <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">No entries logged today</p>
              : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {todayEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-700/40">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{entry.student_name}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">{entry.house_name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-gray-600 dark:text-slate-300">{entry.arrival_time?.slice(0, 5)}</div>
                        <div className={`text-xs mt-0.5 ${entry.status === "auto_confirmed" ? "text-green-500" : entry.status === "needs_review" ? "text-yellow-500" : "text-gray-400"}`}>
                          {entry.status === "auto_confirmed" ? "auto" : entry.status === "needs_review" ? "review" : entry.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
              <a href="/late-entries" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View all late entries →</a>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">How it works</h3>
            <ol className="text-xs text-gray-500 dark:text-slate-400 space-y-2 list-decimal list-inside">
              <li>Start the recognition server (see above if offline)</li>
              <li>Click <strong>Start Camera</strong> then <strong>Start Scanning</strong></li>
              <li>Scans every 2 seconds — detects <strong>all faces</strong> in frame simultaneously</li>
              <li>Matched students (≥60%) are logged automatically when auto-log is on</li>
              <li>Unknown faces go to the <a href="/late-entries" className="text-indigo-500 hover:underline">review queue</a></li>
            </ol>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
