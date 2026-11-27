/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import AdminLogin from "@/components/subscriptions/AdminLogin";
import StatusPill from "@/components/subscriptions/StatusPill";
import TypePill, { paymentTypeOf } from "@/components/subscriptions/TypePill";
import TierPill from "@/components/refunds/TierPill";
import ProtectedImage from "@/components/ProtectedImage";
import { MarkRefundedModal, RejectRefundModal } from "@/components/refunds/RefundModals";
import { Card, Field } from "@/components/ui";
import { clearAdminToken, getAdminToken, getRefundRequest, notifyRefundsChanged } from "@/lib/adminApi";
import { daysSince, displayDate, displayMethod, endDay, isPast, pkr } from "@/lib/format";

const ACCOUNT_TYPES = { bank: "Bank", jazzcash: "JazzCash", easypaisa: "EasyPaisa" };

// The API may nest the account (like the hospital endpoint) or return the table's columns.
const accountOf = (request) => {
  const account = request.refund_account || {
    account_type: request.refund_account_type,
    account_title: request.account_title,
    bank_name: request.bank_name,
    account_number: request.account_number,
  };
  const type = String(account.account_type || "").toLowerCase();
  return account.account_number || account.account_title ? { ...account, label: ACCOUNT_TYPES[type] || account.account_type } : null;
};

// processed_by may be a name, an id, or a user object, depending on the join.
const personName = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value.name || value.full_name || value.email || fallback;
  return typeof value === "string" && Number.isNaN(Number(value)) ? value : fallback;
};

const portalNames = (request) => {
  if (Array.isArray(request.portals) && request.portals.length) {
    return request.portals.map((portal) => (typeof portal === "string" ? portal : portal.portal_name || portal.name)).filter(Boolean);
  }
  return String(request.portal_names || "").split(",").map((name) => name.trim()).filter(Boolean);
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Account number copied");
    } catch {
      toast.error("Couldn't copy. Select the number and copy it manually.");
    }
  };
  return (
    <button onClick={copy} className="rounded-lg border border-teal-700 px-3 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal-50">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SendTo({ account }) {
  if (!account) return <p className="text-sm text-slate-600">The hospital didn&apos;t send a refund account.</p>;
  const number = String(account.account_number || "");
  const masked = number.includes("•");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        <Field label="Account type">{account.label}</Field>
        <Field label="Account title">{account.account_title}</Field>
        {account.bank_name && <Field label="Bank">{account.bank_name}</Field>}
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-600">Account number</div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="select-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-lg font-semibold tracking-wide">{number || "—"}</span>
          {number && !masked && <CopyButton value={number} />}
        </div>
        {masked && <p className="mt-2 text-sm text-amber-800">The API returned a masked number. Ask engineering to return the full number on the admin detail endpoint.</p>}
      </div>
    </div>
  );
}

function PaymentsCovered({ payments }) {
  if (!payments.length) return <p className="text-sm text-slate-600">No payments recorded for this request.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-120 text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <th className="py-2 pr-3">Payment</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Method</th>
            <th className="py-2 pr-3">Approved</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2">Proof</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-slate-100 align-middle">
              <td className="py-2.5 pr-3"><Link href={`/subscriptions/${payment.id}`} className="font-semibold text-teal-700 hover:underline">PAY-{payment.id}</Link></td>
              <td className="py-2.5 pr-3"><TypePill type={paymentTypeOf(payment)} /></td>
              <td className="py-2.5 pr-3">{displayMethod(payment.payment_method)}</td>
              <td className="py-2.5 pr-3">{displayDate(payment.approved_at ?? payment.verified_at)}</td>
              <td className="py-2.5 pr-3 text-right font-semibold">{pkr(payment.amount)}</td>
              <td className="py-2.5"><ProtectedImage compact url={payment.proof_url} alt={`Payment proof for PAY-${payment.id}`} emptyText="No proof" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefundDetailsContent() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    if (!getAdminToken()) { setSignedOut(true); setLoading(false); return; }
    setLoading(true); setError(""); setSignedOut(false);
    try { setRequest(await getRefundRequest(id)); }
    catch (loadError) {
      if (loadError.status === 401 || loadError.status === 403) { clearAdminToken(); setSignedOut(true); }
      setError(loadError.message || "Unable to load this refund request.");
    }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const closeModal = useCallback(() => setModal(null), []);
  const done = async (message) => { toast.success(message); setModal(null); await load(); };
  // Someone else processed it first: say so and show the current state.
  const conflict = async (conflictError) => {
    toast.error(conflictError.message || "This request was already processed.");
    setModal(null);
    notifyRefundsChanged();
    await load();
  };

  if (signedOut && !loading) return <div className="p-8"><AdminLogin onSuccess={() => void load()} /></div>;
  if (loading && !request) return <div className="p-8 text-sm text-slate-600">Loading refund request…</div>;
  if (!request) return <div className="p-8"><p className="text-rose-700">{error || "Refund request not found."}</p><Link href="/refunds" className="mt-3 inline-block font-semibold text-teal-700">Back to refund requests</Link></div>;

  const status = String(request.status || "").toUpperCase();
  const inReview = status === "IN_REVIEW";
  const account = accountOf(request);
  const payments = request.payments || [];
  const portals = portalNames(request);
  const processedBy = personName(request.processed_by_name ?? request.processed_by, "HMS support");
  const requestedBy = personName(request.requested_by_name ?? request.requested_by, request.owner_name || "Hospital owner");
  const processedAt = request.refunded_at ?? request.processed_at ?? request.updated_at;
  const history = [
    { label: `Refund requested by ${requestedBy}`, at: request.created_at },
    ...(status === "REFUNDED" ? [{ label: `Refunded by ${processedBy}`, note: request.note ?? request.refund_note, at: request.refunded_at }] : []),
    ...(status === "REJECTED" ? [{ label: `Rejected by ${processedBy}`, note: request.rejection_reason, noteLabel: "Reason", at: processedAt }] : []),
    ...(status === "CANCELLED" ? [{ label: `Cancelled without refund, ${isPast(request.effective_at) ? "ended" : "ends"} on ${endDay(request.effective_at)}` }] : []),
  ];

  return <div className="p-8">
    <nav className="text-sm text-slate-600"><Link href="/refunds" className="hover:underline">Refund Requests</Link> / REF-{request.id}</nav>
    <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3.5"><h1 className="text-2xl font-bold">Refund request REF-{request.id}</h1><TierPill tier={request.refund_tier} /><StatusPill status={status.toLowerCase()} /></div>
      {inReview && <div className="flex gap-2.5">
        <button disabled={loading} onClick={() => setModal("reject")} className="rounded-lg border border-rose-700 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60">Reject</button>
        <button disabled={loading} onClick={() => setModal("refund")} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Mark as Refunded</button>
      </div>}
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p>}

    <div className="flex flex-wrap items-start gap-5"><div className="flex min-w-105 flex-2 flex-col gap-5">
      {status === "CANCELLED" && <div className="rounded-xl border border-slate-200 bg-slate-100 p-5"><h2 className="mb-1 text-base font-semibold">{isPast(request.effective_at) ? "Ended" : "Ends"} on {endDay(request.effective_at)}, no refund due</h2><p className="text-sm text-slate-700">Cancelled more than 7 days into the paid period. The subscription runs to its end date and does not renew. No action needed.</p></div>}
      {status === "REJECTED" && <div className="rounded-xl border border-rose-200 bg-rose-50 p-5"><h2 className="mb-1 text-base font-semibold text-rose-900">Rejection reason</h2><p className="text-sm text-rose-900">{request.rejection_reason || "—"}</p></div>}

      <Card title="Refund">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-0.5 text-xs text-slate-600">Refund amount</div><div className="text-3xl font-bold text-teal-950">{pkr(request.refund_amount)}</div></div>
          <div className="grid grid-cols-3 gap-5"><Field label="Tier"><TierPill tier={request.refund_tier} /></Field><Field label="Percent">{request.refund_percent != null ? `${request.refund_percent}%` : "—"}</Field><Field label="Paid">{pkr(request.paid_amount)}</Field></div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4"><Field label="Reason the hospital gave">{request.reason || <span className="font-normal text-slate-500">No reason given</span>}</Field></div>
      </Card>

      {status !== "CANCELLED" && <Card title="Send to"><SendTo account={account} /></Card>}

      <Card title="Payments covered"><PaymentsCovered payments={payments} /></Card>

      {status === "REFUNDED" && <Card title="Transfer screenshot"><ProtectedImage url={request.refund_proof_url} alt="Refund transfer screenshot" /><p className="mt-3 text-sm text-slate-600">Uploaded by {processedBy} on {displayDate(request.refunded_at)}</p></Card>}
    </div><div className="flex min-w-75 flex-1 flex-col gap-5">
      <Card title="Hospital"><div className="space-y-3">
        <Field label="Hospital">{request.hospital_name}</Field>
        <Field label="Slug">{request.hospital_slug}</Field>
        <Field label="Owner">{request.owner_name}</Field>
        <Field label="Email">{request.owner_email && <a href={`mailto:${request.owner_email}`} className="text-teal-700 hover:underline">{request.owner_email}</a>}</Field>
        <Field label="Phone">{request.owner_phone && <a href={`tel:${String(request.owner_phone).replace(/[^\d+]/g, "")}`} className="text-teal-700 hover:underline">{request.owner_phone}</a>}</Field>
      </div></Card>
      <Card title="Subscription"><div className="space-y-3">
        <Field label="Subscription">{request.subscription_id != null ? `#${request.subscription_id}` : null}</Field>
        <Field label="Portals">{portals.length > 0 && <span className="flex flex-wrap gap-1">{portals.map((name) => <span key={name} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">{name}</span>)}</span>}</Field>
        <Field label="Period start">{request.period_start ? <>{displayDate(request.period_start)} <span className="font-normal text-slate-500">({daysSince(request.period_start)} ago)</span></> : null}</Field>
        <Field label="End date">{request.subscription_end_date ? endDay(request.subscription_end_date) : null}</Field>
        <Field label="Current status">{request.subscription_status && <StatusPill status={String(request.subscription_status).toLowerCase()} />}</Field>
      </div></Card>
      <Card title="History"><ol>{history.map((entry) => <li key={entry.label} className="flex gap-3 pb-4"><span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-teal-700" /><div><div className="text-sm font-semibold">{entry.label}</div>{entry.note && <div className="text-sm text-slate-700">{entry.noteLabel || "Note"}: {entry.note}</div>}{entry.at && <div className="text-xs text-slate-600">{displayDate(entry.at)}</div>}</div></li>)}</ol></Card>
    </div></div>

    {modal === "refund" && <MarkRefundedModal request={request} account={account} onClose={closeModal} onDone={done} onConflict={conflict} />}
    {modal === "reject" && <RejectRefundModal request={request} onClose={closeModal} onDone={done} onConflict={conflict} />}
  </div>;
}

export default function RefundDetails() {
  return <Suspense fallback={<div className="p-8 text-sm text-slate-600">Loading refund request…</div>}><RefundDetailsContent /></Suspense>;
}
