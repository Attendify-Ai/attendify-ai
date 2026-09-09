const STATUS_STYLES: Record<string, string> = {
  auto_confirmed: "bg-green-500/10 text-green-400 border-green-500/25",
  confirmed: "bg-green-500/10 text-green-400 border-green-500/25",
  needs_review: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  manually_verified: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  unknown: "bg-red-500/10 text-red-400 border-red-500/25",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  teacher: "bg-sky-500/10 text-sky-400 border-sky-500/25",
};

const DOT_STYLES: Record<string, string> = {
  auto_confirmed: "bg-green-400",
  confirmed: "bg-green-400",
  needs_review: "bg-amber-400",
  manually_verified: "bg-blue-400",
  unknown: "bg-red-400",
  admin: "bg-purple-400",
  teacher: "bg-sky-400",
};

export default function Badge({ label, variant, dot = true }: { label: string; variant?: string; dot?: boolean }) {
  const key = variant || label;
  const cls = STATUS_STYLES[key] || "bg-white/5 text-ink-secondary border-white/10";
  const dotCls = DOT_STYLES[key] || "bg-ink-faint";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${cls}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />}
      {label.replace(/_/g, " ")}
    </span>
  );
}
