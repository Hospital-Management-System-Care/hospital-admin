const styles = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export default function StatusPill({ status }) {
  return (
    <span
      className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[status] || "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
