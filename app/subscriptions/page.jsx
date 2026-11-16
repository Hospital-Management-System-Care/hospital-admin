/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusPill from "@/components/subscriptions/StatusPill";
import AdminLogin from "@/components/subscriptions/AdminLogin";
import { clearAdminToken, getAdminToken, getPaymentRequests } from "@/lib/adminApi";

const TABS = [
  { key: "all", label: "All applied users" },
  { key: "pending", label: "Queue" },
  { key: "approved", label: "Approved" },
];

const cols =
  "grid min-w-[980px] grid-cols-[2fr_1.5fr_1.5fr_.9fr_.9fr_.9fr_1fr_76px] items-center gap-3 px-5 py-3.5 text-sm";

export default function SubscriptionsList() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    if (!getAdminToken()) { setSignedIn(false); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      setRequests(await getPaymentRequests());
      setSignedIn(true);
    } catch (loadError) {
      setError(loadError.message || "Unable to load payment requests.");
      setSignedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return requests.filter((request) => {
      const status = String(request.status || "").toLowerCase();
      const inTab = tab === "all" || status === tab;
      const match =
        !term ||
        [request.requester_name, request.requester_email, request.hospital_name, request.portal_names, request.id]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return inTab && match;
    });
  }, [requests, tab, q]);

  const count = (key) =>
    key === "all"
      ? requests.length
      : requests.filter((request) => String(request.status || "").toLowerCase() === key).length;

  if (!signedIn && !loading) {
    return <div className="p-8"><AdminLogin onSuccess={() => void load()} />{error && <p className="mx-auto mt-3 max-w-md text-center text-sm text-rose-700">{error}</p>}</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review payment proofs and activate the selected portals
          </p>
        </div>
        <input
          aria-label="Search subscriptions"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search requester, hospital or request ID"
          className="w-80 max-w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
        />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Every request shows its server-calculated total, WhatsApp contact, proof, and selected portals.</p>
        <button onClick={() => { clearAdminToken(); setSignedIn(false); }} className="text-sm font-semibold text-teal-700 hover:underline">Sign out</button>
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
          <span>Submitted</span>
          <span>Reviewed</span>
          <span>Request</span>
          <span>Action</span>
        </div>

        {loading && <p className="px-5 py-10 text-center text-sm text-slate-500">Loading payment requests…</p>}
        {!loading && rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No subscriptions found. Try a different search or tab.
          </p>
        )}

        {rows.map((request) => (
          <div key={request.id} className={`${cols} border-t border-slate-200`}>
            <span>
              <span className="block font-semibold">{request.requester_name || "Hospital owner"}</span>
              <span className="text-xs text-slate-600">{request.requester_email || request.hospital_email || "—"}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              {(request.portal_names || "—").split(", ").map((portal) => (
                <span key={portal} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">
                  {portal}
                </span>
              ))}
            </span>
            <span>{request.hospital_name}</span>
            <StatusPill status={String(request.status || "").toLowerCase()} />
            <span>{request.created_at ? new Date(request.created_at).toLocaleDateString() : "—"}</span>
            <span>{request.verified_at ? new Date(request.verified_at).toLocaleDateString() : request.status === "PENDING" ? "Awaiting review" : "—"}</span>
            <span>PAY-{request.id}</span>
            <Link
              href={`/subscriptions/${request.id}`}
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
