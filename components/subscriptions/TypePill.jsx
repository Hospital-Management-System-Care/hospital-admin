export const PAYMENT_TYPES = {
  RENEWAL: { label: "Renewal", style: "bg-sky-100 text-sky-800" },
  ADD_PORTALS: { label: "Add portals", style: "bg-violet-100 text-violet-800" },
};

// Requests created before payment types existed have no `payment_type`; they were renewals.
export const paymentTypeOf = (request) => {
  const type = String(request?.payment_type || "").toUpperCase();
  return PAYMENT_TYPES[type] ? type : "RENEWAL";
};

export default function TypePill({ type }) {
  const { label, style } = PAYMENT_TYPES[type] || PAYMENT_TYPES.RENEWAL;
  return (
    <span className={`inline-block w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
