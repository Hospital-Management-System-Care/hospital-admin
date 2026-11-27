/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLogin from "@/components/subscriptions/AdminLogin";
import StatusPill from "@/components/subscriptions/StatusPill";
import TierPill, { REFUND_TIERS } from "@/components/refunds/TierPill";
import { clearAdminToken, getAdminToken, getRefundRequests } from "@/lib/adminApi";
import { daysSince, pkr, startDay, toMs } from "@/lib/format";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];

const TIER_FILTERS = [
  { key: "all", label: "All" },
  ...Object.entries(REFUND_TIERS).map(([key, { label }]) => ({ key, label })),
];

// Oldest IN_REVIEW first (the longest-waiting refund on top), then everything else newest first.
const sortRequests = (items) => [...items].sort((a, b) => {
  const aOpen = a.status === "IN_REVIEW";
  const bOpen = b.status === "IN_REVIEW";
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  const diff = toMs(a.created_at) - toMs(b.created_at);
  return (aOpen ? diff : -diff) || 0;
});

const cols =
  "grid min-w-[1180px] grid-cols-[.8fr_1.5fr_1.6fr_.7fr_.9fr_1fr_.8fr_.9fr_.9fr_76px] items-center gap-3 px-5 py-3.5 text-sm";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20";

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-slate-300">
        {options.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            aria-pressed={value === option.key}
            className={`border-l border-slate-300 px-3 py-2 text-sm font-semibold first:border-l-0 ${
              value === option.key ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RefundRequestsList() {
  const [status, setStatus] = useState("IN_REVIEW");
  const [tier, setTier] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  // Debounce the search box; a new term starts again from page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    if (!getAdminToken()) { setSignedIn(false); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      setResult(await getRefundRequests({ status, tier, from, to, search, page, limit: PAGE_SIZE }));
      setSignedIn(true);
    } catch (loadError) {
      if (loadError.status === 401 || loadError.status === 403) {
        clearAdminToken();
        setSignedIn(false);
      } else {
        setSignedIn(true);
      }
      setError(loadError.message || "Unable to load refund requests.");
    } finally {
      setLoading(false);
    }
  }, [status, tier, from, to, search, page]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => sortRequests(result.items), [result.items]);
  const filtered = status !== "IN_REVIEW" || tier !== "all" || from || to || search;
  const firstRow = result.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(result.total, (page - 1) * PAGE_SIZE + rows.length);
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const changeFilter = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => {
    setStatus("IN_REVIEW"); setTier("all"); setFrom(""); setTo(""); setQ(""); setSearch(""); setPage(1);
  };

  if (!signedIn && !loading) {
    return <div className="p-8"><AdminLogin onSuccess={() => void load()} />{error && <p className="mx-auto mt-3 max-w-md text-center text-sm text-rose-700">{error}</p>}</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Refund Requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            Send the refund to the hospital&apos;s account, then upload the transfer screenshot
          </p>
        </div>
        <input
          aria-label="Search refund requests"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search hospital, owner email or request ID"
          className={`w-80 max-w-full ${inputClass} py-2.5`}
        />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Policy: full refund within 3 days of the paid period starting, 50% within 7 days, none after.
          The API calculates every amount.
        </p>
        <button onClick={() => { clearAdminToken(); setSignedIn(false); }} className="text-sm font-semibold text-teal-700 hover:underline">Sign out</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Status" options={STATUS_FILTERS} value={status} onChange={changeFilter(setStatus)} />
        <Segmented label="Tier" options={TIER_FILTERS} value={tier} onChange={changeFilter(setTier)} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">Requested</span>
          <input type="date" aria-label="Requested from" value={from} max={to || undefined} onChange={(e) => changeFilter(setFrom)(e.target.value)} className={inputClass} />
          <span className="text-sm text-slate-500">to</span>
          <input type="date" aria-label="Requested to" value={to} min={from || undefined} onChange={(e) => changeFilter(setTo)(e.target.value)} className={inputClass} />
        </div>
        {filtered && <button onClick={clearFilters} className="text-sm font-semibold text-teal-700 hover:underline">Reset filters</button>}
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
          <button onClick={() => void load()} className="font-semibold underline">Retry</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className={`${cols} bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600`}>
          <span>Request</span>
          <span>Hospital</span>
          <span>Owner</span>
          <span>Tier</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Refund</span>
          <span>Since start</span>
          <span>Requested</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {loading && <p className="px-5 py-10 text-center text-sm text-slate-500">Loading refund requests…</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No refund requests{filtered ? ". Try a different search or filter." : ""}
          </p>
        )}

        {!loading && rows.map((row) => (
          <div key={row.id} className={`${cols} border-t border-slate-200`}>
            <span className="font-semibold">REF-{row.id}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{row.hospital_name || "—"}</span>
              {row.hospital_slug && <span className="text-xs text-slate-600">{row.hospital_slug}</span>}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{row.owner_name || "Hospital owner"}</span>
              <span className="block truncate text-xs text-slate-600">{row.owner_email || "—"}</span>
            </span>
            <TierPill tier={row.refund_tier} />
            <span className="text-right">{pkr(row.paid_amount)}</span>
            <span className="text-right font-semibold">{pkr(row.refund_amount)}</span>
            <span title={`Period started ${startDay(row.period_start)}`}>{daysSince(row.period_start)}</span>
            <span>{startDay(row.created_at)}</span>
            <StatusPill status={String(row.status || "").toLowerCase()} />
            <Link
              href={`/refunds/${row.id}`}
              className="rounded-lg border border-teal-700 px-3 py-2 text-center text-sm font-semibold text-teal-700 hover:bg-teal-50"
            >
              View
            </Link>
          </div>
        ))}
      </div>

      {!loading && result.total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Showing {firstRow}–{lastRow} of {result.total}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:opacity-50">Previous</button>
            <span className="self-center">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
