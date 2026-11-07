"use client";

import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { subscriptions } from "@/lib/subscriptionsData";
import StatusPill from "@/components/subscriptions/StatusPill";

const Card = ({ title, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="mb-4 text-base font-semibold">{title}</h2>
    {children}
  </section>
);

const Field = ({ label, children }) => (
  <div>
    <div className="mb-0.5 text-xs text-slate-600">{label}</div>
    <div className="text-sm font-semibold">{children}</div>
  </div>
);

function RejectModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!reason.trim()) {
      setError("Enter a reason so the user knows why it was rejected.");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="reject-title" className="text-lg font-bold">
          Reject this subscription?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The user will see this reason. This can&apos;t be undone.
        </p>

        <label htmlFor="reason" className="mt-4 block text-sm font-semibold">
          Reason for rejection
        </label>
        <textarea
          id="reason"
          ref={ref}
          rows={4}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError("");
          }}
          placeholder="e.g. Payment screenshot is unclear"
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
        />
        {error && <p className="mt-1 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800"
          >
            Reject subscription
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionDetailsContent() {
  const { id } = useParams();
  const sub = subscriptions.find((s) => s.id === id);
  const [status, setStatus] = useState(sub?.status);
  const [history, setHistory] = useState(sub?.history ?? []);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const past = sub?.pastSubscriptions ?? [];

  if (!sub) {
    return (
      <div className="p-8">
        <p className="mb-3">Subscription not found.</p>
        <Link href="/subscriptions" className="font-semibold text-teal-700">
          Back to subscriptions
        </Link>
      </div>
    );
  }

  const addHistory = (label, note) =>
    setHistory((h) => [...h, { label, note, at: new Date().toLocaleString() }]);

  const approve = () => {
    // API: await api.patch(`/subscriptions/${id}`, { status: "accepted" })
    setStatus("accepted");
    addHistory("Approved by admin");
    toast.success("Subscription approved");
  };

  const reject = (reason) => {
    // API: await api.patch(`/subscriptions/${id}`, { status: "rejected", reason })
    setStatus("rejected");
    setRejectReason(reason);
    addHistory("Rejected by admin", reason);
    setShowReject(false);
    toast.success("Subscription rejected");
  };

  return (
    <div className="p-8">
      <nav className="text-sm text-slate-600">
        <Link href="/subscriptions" className="hover:underline">Subscriptions</Link> / {sub.name}
      </nav>

      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <h1 className="text-2xl font-bold">{sub.name}</h1>
          <StatusPill status={status} />
        </div>
        {status === "pending" && (
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowReject(true)}
              className="rounded-lg border border-rose-700 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              Reject
            </button>
            <button
              onClick={approve}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Approve
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[420px] flex-[2] flex-col gap-5">
          {status === "rejected" && rejectReason && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="mb-1 text-base font-semibold text-rose-900">Rejection reason</h2>
              <p className="text-sm text-rose-900">{rejectReason}</p>
            </div>
          )}

          <Card title="User & hospital">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
              <Field label="Username">{sub.username}</Field>
              <Field label="Email">{sub.email}</Field>
              <Field label="Hospital name">{sub.hospital}</Field>
            </div>
          </Card>

          <Card title="Portals purchased">
            <div className="flex flex-wrap gap-2">
              {sub.portals.map((p) => (
                <span key={p} className="rounded-md bg-teal-50 px-2.5 py-1 text-sm font-medium text-teal-900">{p}</span>
              ))}
            </div>
          </Card>

          <Card title="Subscription period">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
              <Field label="Start date">{sub.startDate}</Field>
              <Field label="Expiry date">{sub.expiryDate}</Field>
              <Field label="Invoice no">{sub.invoiceNo}</Field>
              <Field label="Status"><StatusPill status={status} /></Field>
            </div>
          </Card>

          <Card title="Payment screenshot">
            {sub.screenshotUrl ? (
              <>
                <img src={sub.screenshotUrl} alt="Payment screenshot" className="max-h-96 rounded-lg border border-slate-200" />
                <a href={sub.screenshotUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-700">
                  View full size
                </a>
              </>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
                No screenshot uploaded
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-[300px] flex-1 flex-col gap-5">
          <Card title="Invoice receipt">
            <div className="mb-3.5 rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-600">Receipt</div>
              <div className="text-sm font-semibold">{sub.invoiceNo}</div>
              <div className="mt-2 text-xs text-slate-600">Hospital</div>
              <div className="text-sm font-semibold">{sub.hospital}</div>
            </div>
            <a
              href={sub.receiptUrl || "#"}
              download
              className="inline-block rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Download receipt
            </a>
          </Card>

          <Card title="History">
            <ol>
              {history.map((h, i) => (
                <li key={i} className="flex gap-3 pb-4">
                  <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-teal-700" />
                  <div>
                    <div className="text-sm font-semibold">{h.label}</div>
                    {h.note && <div className="text-sm text-slate-700">Reason: {h.note}</div>}
                    <div className="text-xs text-slate-600">{h.at}</div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-2 border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold">Previous subscriptions</h3>
              {past.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No previous subscriptions. This is the user&apos;s first application.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {past.map((p) => (
                    <li key={p.invoiceNo} className="rounded-lg border border-slate-200 p-3">
                      <div className="text-sm font-semibold">{p.invoiceNo}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.portals.map((name) => (
                          <span key={name} className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">
                            {name}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-slate-600">Start date</div>
                          <div className="text-sm font-medium">{p.startDate}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600">Expiry date</div>
                          <div className="text-sm font-medium">{p.expiryDate}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showReject && <RejectModal onClose={() => setShowReject(false)} onConfirm={reject} />}
    </div>
  );
}

export default function SubscriptionDetails() {
  return (
    <Suspense fallback={<div className="p-8">Loading subscription...</div>}>
      <SubscriptionDetailsContent />
    </Suspense>
  );
}