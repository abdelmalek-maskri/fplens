export default function Loading() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="animate-spin h-6 w-6 rounded-full border-2 border-white border-t-transparent" />
      <span className="ml-3 text-slate-300">Loading…</span>
    </div>
  );
}
