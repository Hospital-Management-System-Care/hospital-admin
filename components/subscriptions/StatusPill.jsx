const styles = {
  pending: "bg-amber-100 text-amber-800",
  in_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  accepted: "bg-emerald-100 text-emerald-800",
  refunded: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-100 text-slate-700",
};

// `status` is lowercase, e.g. "pending" or "in_review".
export default function StatusPill({ status }) {
  return (
    <span
      className={`inline-block w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[status] || "bg-slate-100 text-slate-700"}`}
    >
      {String(status || "").replaceAll("_", " ")}
    </span>
  );
}
