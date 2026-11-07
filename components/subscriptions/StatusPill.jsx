const styles = {
  pending: "bg-amber-100 text-amber-800 w-fit",
  accepted: "bg-emerald-100 text-emerald-800 w-fit",
  rejected: "bg-rose-100 text-rose-800 w-fit",
};

export default function StatusPill({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}