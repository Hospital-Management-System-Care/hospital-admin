export const Card = ({ title, children, action }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export const Field = ({ label, children }) => (
  <div>
    <div className="mb-0.5 text-xs text-slate-600">{label}</div>
    <div className="text-sm font-semibold">{children || "—"}</div>
  </div>
);
