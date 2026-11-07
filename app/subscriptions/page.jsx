"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { subscriptions } from "@/lib/subscriptionsData";
import StatusPill from "@/components/subscriptions/StatusPill";

const TABS = [
  { key: "all", label: "All applied users" },
  { key: "pending", label: "Queue" },
  { key: "accepted", label: "Accepted" },
];

const cols =
  "grid min-w-[980px] grid-cols-[2fr_1.5fr_1.5fr_.9fr_.9fr_.9fr_1fr_76px] items-center gap-3 px-5 py-3.5 text-sm";

export default function SubscriptionsList() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return subscriptions.filter((s) => {
      const inTab = tab === "all" || s.status === tab;
      const match =
        !term ||
        [s.name, s.username, s.email, s.invoiceNo, s.hospital]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return inTab && match;
    });
  }, [tab, q]);

  const count = (key) =>
    key === "all"
      ? subscriptions.length
      : subscriptions.filter((s) => s.status === key).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review applications and manage active subscriptions
          </p>
        </div>
        <input
          aria-label="Search subscriptions"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search user, email or invoice no"
          className="w-80 max-w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg border border-teal-700 px-3.5 py-2 text-sm font-semibold ${
              tab === t.key ? "bg-teal-700 text-white" : "bg-white text-teal-700"
            }`}
          >
            {t.label} ({count(t.key)})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className={`${cols} bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600`}>
          <span>User</span>
          <span>Portals</span>
          <span>Hospital</span>
          <span>Status</span>
          <span>Start</span>
          <span>Expiry</span>
          <span>Invoice no</span>
          <span>Action</span>
          <span />
        </div>

        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No subscriptions found. Try a different search or tab.
          </p>
        )}

        {rows.map((s) => (
          <div key={s.id} className={`${cols} border-t border-slate-200`}>
            <span>
              <span className="block font-semibold">{s.name}</span>
              <span className="text-xs text-slate-600">{s.email}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              {s.portals.map((p) => (
                <span key={p} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">
                  {p.replace(" Portal", "")}
                </span>
              ))}
            </span>
            <span>{s.hospital}</span>
            <StatusPill status={s.status} />
            <span>{s.startDate}</span>
            <span>{s.expiryDate}</span>
            <span>{s.invoiceNo}</span>
            <Link
              href={`/subscriptions/${s.id}`}
              className="rounded-lg border border-teal-700 px-3 py-2 text-center text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              View
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}