export const REFUND_TIERS = {
  FULL: { label: "Full", style: "bg-blue-100 text-blue-800" },
  HALF: { label: "Half", style: "bg-amber-100 text-amber-800" },
  NONE: { label: "None", style: "bg-slate-100 text-slate-700" },
};

export default function TierPill({ tier }) {
  const { label, style } = REFUND_TIERS[String(tier || "").toUpperCase()] || { label: tier || "—", style: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-block w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
