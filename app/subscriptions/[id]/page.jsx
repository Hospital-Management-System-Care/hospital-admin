/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import AdminLogin from "@/components/subscriptions/AdminLogin";
import StatusPill from "@/components/subscriptions/StatusPill";
import {
  approvePaymentRequest,
  getAdminToken,
  getPaymentProof,
  getPaymentRequest,
  rejectPaymentRequest,
} from "@/lib/adminApi";

const Card = ({ title, children }) => <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-base font-semibold">{title}</h2>{children}</section>;
const Field = ({ label, children }) => <div><div className="mb-0.5 text-xs text-slate-600">{label}</div><div className="text-sm font-semibold">{children || "—"}</div></div>;
const displayDate = (value) => value ? new Date(value).toLocaleString() : "—";
const displayMethod = (value) => String(value || "—").replaceAll("_", " ");

function RejectModal({ onClose, onConfirm, saving }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = () => {
    if (!reason.trim()) return setError("Enter a reason so the hospital admin can correct the request.");
    onConfirm(reason.trim());
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="reject-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <h2 id="reject-title" className="text-lg font-bold">Reject this payment request?</h2>
      <p className="mt-1 text-sm text-slate-600">The hospital admin sees this reason and can submit a corrected payment proof.</p>
      <label className="mt-4 block text-sm font-semibold">Reason for rejection
        <textarea ref={ref} rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder="e.g. Payment amount does not match the selected portals" className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal-700" />
      </label>
      {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2.5"><button disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving} onClick={submit} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Rejecting…" : "Reject request"}</button></div>
    </div>
  </div>;
}

function SubscriptionDetailsContent() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [proofUrl, setProofUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showReject, setShowReject] = useState(false);
  const load = useCallback(async () => {
    if (!getAdminToken()) { setLoading(false); return; }
    setLoading(true); setError("");
    try { setRequest(await getPaymentRequest(id)); }
    catch (loadError) { setError(loadError.message || "Unable to load this payment request."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true; let objectUrl = "";
    if (request?.proof_url) getPaymentProof(request.proof_url).then((url) => {
      objectUrl = url;
      if (active) setProofUrl(url); else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setProofUrl(""); }); else setProofUrl("");
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [request?.proof_url]);
  const approve = async () => {
    setSaving(true);
    try { await approvePaymentRequest(id); toast.success("Payment approved and the selected portals are active."); await load(); }
    catch (approveError) { toast.error(approveError.message || "Unable to approve payment."); }
    finally { setSaving(false); }
  };
  const reject = async (reason) => {
    setSaving(true);
    try { await rejectPaymentRequest(id, reason); toast.success("Payment request rejected."); setShowReject(false); await load(); }
    catch (rejectError) { toast.error(rejectError.message || "Unable to reject payment."); }
    finally { setSaving(false); }
  };
  if (!getAdminToken() && !loading) return <div className="p-8"><AdminLogin onSuccess={() => void load()} /></div>;
  if (loading) return <div className="p-8 text-sm text-slate-600">Loading payment request…</div>;
  if (error || !request) return <div className="p-8"><p className="text-rose-700">{error || "Payment request not found."}</p><Link href="/subscriptions" className="mt-3 inline-block font-semibold text-teal-700">Back to requests</Link></div>;
  const status = String(request.status || "").toLowerCase();
  const pending = status === "pending";
  const history = [{ label: "Payment request submitted", at: request.created_at }, ...(request.verified_at ? [{ label: status === "approved" ? "Payment approved and portals activated" : "Payment rejected", note: request.rejection_reason, at: request.verified_at }] : [])];
  return <div className="p-8">
    <nav className="text-sm text-slate-600"><Link href="/subscriptions" className="hover:underline">Subscriptions</Link> / PAY-{request.id}</nav>
    <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3.5"><h1 className="text-2xl font-bold">Payment request PAY-{request.id}</h1><StatusPill status={status} /></div>{pending && <div className="flex gap-2.5"><button disabled={saving} onClick={() => setShowReject(true)} className="rounded-lg border border-rose-700 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60">Reject</button><button disabled={saving} onClick={approve} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Approve payment"}</button></div>}</div>
    <div className="flex flex-wrap items-start gap-5"><div className="flex min-w-105 flex-2 flex-col gap-5">
      {status === "rejected" && request.rejection_reason && <div className="rounded-xl border border-rose-200 bg-rose-50 p-5"><h2 className="mb-1 text-base font-semibold text-rose-900">Rejection reason</h2><p className="text-sm text-rose-900">{request.rejection_reason}</p></div>}
      <Card title="Hospital admin & contact"><div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4"><Field label="Name">{request.requester_name || "Hospital owner"}</Field><Field label="Email">{request.requester_email || request.hospital_email}</Field><Field label="Hospital">{request.hospital_name}</Field><Field label="WhatsApp">{request.whatsapp_number}</Field></div></Card>
      <Card title="Selected portals"><div className="space-y-3">{request.portals?.map((portal) => <div key={portal.portal_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-50 px-3 py-2 text-sm"><span className="font-semibold text-teal-950">{portal.portal_name}</span><span>{portal.billing_days} days</span><span>PKR {Number(portal.total || 0).toLocaleString("en-PK")}</span></div>)}</div></Card>
      <Card title="Payment proof">{proofUrl ? <><img src={proofUrl} alt="Uploaded payment proof" className="max-h-120 rounded-lg border border-slate-200" /><a href={proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-700">View full size</a></> : <div className="flex h-56 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">Payment proof unavailable</div>}</Card>
    </div><div className="flex min-w-75 flex-1 flex-col gap-5">
      <Card title="Payment summary"><div className="space-y-3"><Field label="Request">PAY-{request.id}</Field><Field label="Payment method">{displayMethod(request.payment_method)}</Field><Field label="Amount">PKR {Number(request.amount || 0).toLocaleString("en-PK")}</Field><Field label="Reference">{request.transaction_reference}</Field><Field label="Status"><StatusPill status={status} /></Field></div></Card>
      <Card title="History"><ol>{history.map((entry) => <li key={entry.label} className="flex gap-3 pb-4"><span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-teal-700" /><div><div className="text-sm font-semibold">{entry.label}</div>{entry.note && <div className="text-sm text-slate-700">Reason: {entry.note}</div>}<div className="text-xs text-slate-600">{displayDate(entry.at)}</div></div></li>)}</ol></Card>
    </div></div>
    {showReject && <RejectModal saving={saving} onClose={() => setShowReject(false)} onConfirm={reject} />}
  </div>;
}

export default function SubscriptionDetails() {
  return <Suspense fallback={<div className="p-8 text-sm text-slate-600">Loading payment request…</div>}><SubscriptionDetailsContent /></Suspense>;
}
