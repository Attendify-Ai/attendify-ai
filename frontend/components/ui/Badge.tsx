const statusColors: Record<string, string> = {
  auto_confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  needs_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  manually_verified: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  unknown: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  teacher: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
};

export default function Badge({ label, variant }: { label: string; variant?: string }) {
  const cls = statusColors[variant || label] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}
