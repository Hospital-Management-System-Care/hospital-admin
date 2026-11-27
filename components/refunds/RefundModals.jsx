/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { markRefundRequestRefunded, rejectRefundRequest, uploadRefundProof } from "@/lib/adminApi";
import { pkr } from "@/lib/format";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

// A fetch that never reached the API has no HTTP status.
const messageOf = (error, fallback) => {
  if (!error?.status) return "Couldn't reach the server. Check your connection and try again.";
  if (error.status === 413) return "The server rejected this screenshot as too large. Try a smaller image.";
  return error.message || fallback;
};

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("The screenshot could not be read."));
  reader.readAsDataURL(file);
});

function Modal({ titleId, onClose, busy, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()} className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}

// Upload the transfer screenshot, then mark the request refunded. A 409 (already processed)
// goes to `onConflict`; any other failure stays in the modal so support can retry.
export function MarkRefundedModal({ request, account, onClose, onDone, onConflict }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [dragging, setDragging] = useState(false);
  const attempt = useRef(0);
  const previewRef = useRef("");

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const upload = async (selected) => {
    const current = ++attempt.current;
    setUploading(true); setUploadError(""); setProofUrl("");
    try {
      const url = await uploadRefundProof(await readAsDataUrl(selected));
      if (current === attempt.current) setProofUrl(url);
    } catch (error) {
      if (current === attempt.current) setUploadError(messageOf(error, "The screenshot could not be uploaded."));
    } finally {
      if (current === attempt.current) setUploading(false);
    }
  };

  const choose = (selected) => {
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) { setUploadError("Choose a JPG, PNG or WebP image."); return; }
    if (selected.size > MAX_BYTES) { setUploadError("The screenshot must be 5 MB or smaller."); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(selected);
    setPreview(previewRef.current);
    setFile(selected);
    setSubmitError("");
    void upload(selected);
  };

  const submit = async () => {
    setSaving(true); setSubmitError("");
    try {
      await markRefundRequestRefunded(request.id, { refundProofUrl: proofUrl, note: note.trim() });
      onDone("Marked as refunded. The hospital's subscription has ended.");
    } catch (error) {
      if (error.status === 409) onConflict(error);
      else setSubmitError(messageOf(error, "Unable to mark this request as refunded."));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;
  const recipient = [account?.account_title, account?.label].filter(Boolean).join(", ");

  return (
    <Modal titleId="refund-title" onClose={onClose} busy={saving}>
      <h2 id="refund-title" className="text-lg font-bold">Mark REF-{request.id} as refunded</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload the screenshot of the {pkr(request.refund_amount)} transfer{recipient ? ` to ${recipient}` : ""}.
      </p>

      <label
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-teal-700/40 ${
          dragging ? "border-teal-700 bg-teal-50" : "border-slate-300 bg-slate-50 hover:border-teal-700"
        }`}
      >
        <input type="file" accept={ALLOWED_TYPES.join(",")} className="sr-only" disabled={saving} onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ""; }} />
        {preview
          ? <img src={preview} alt="Transfer screenshot preview" className="max-h-60 rounded border border-slate-200" />
          : <span className="py-6 font-semibold text-slate-700">Drop the transfer screenshot here, or click to choose</span>}
        <span className="mt-2 text-xs text-slate-500">
          {file ? `${file.name} · ${uploading ? "Uploading…" : proofUrl ? "Uploaded" : "Not uploaded"} · click to replace` : "JPG, PNG or WebP, up to 5 MB"}
        </span>
      </label>
      {uploadError && (
        <p className="mt-2 flex items-center gap-2 text-sm text-rose-700">
          {uploadError}
          {file && !uploading && ALLOWED_TYPES.includes(file.type) && <button onClick={() => void upload(file)} className="font-semibold underline">Retry upload</button>}
        </p>
      )}

      <label className="mt-4 block text-sm font-semibold">Note <span className="font-normal text-slate-500">(optional)</span>
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Transfer ID 4829173" className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal-700" />
      </label>

      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        This ends the hospital&apos;s subscription now and makes its portals read-only.
      </p>
      {submitError && <p role="alert" className="mt-3 text-sm text-rose-700">{submitError}</p>}

      <div className="mt-5 flex justify-end gap-2.5">
        <button disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</button>
        <button disabled={!proofUrl || busy} onClick={submit} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Saving…" : submitError ? "Try again" : "Mark as refunded"}
        </button>
      </div>
    </Modal>
  );
}

export function RejectRefundModal({ request, onClose, onDone, onConflict }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = async () => {
    if (!reason.trim()) { setError("Enter a reason. The hospital sees it."); return; }
    setSaving(true); setError("");
    try {
      await rejectRefundRequest(request.id, reason.trim());
      onDone("Refund request rejected.");
    } catch (rejectError) {
      if (rejectError.status === 409) onConflict(rejectError);
      else setError(messageOf(rejectError, "Unable to reject this request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal titleId="reject-refund-title" onClose={onClose} busy={saving}>
      <h2 id="reject-refund-title" className="text-lg font-bold">Reject refund request REF-{request.id}?</h2>
      <p className="mt-1 text-sm text-slate-600">The hospital sees this reason. Its subscription stays as it is, and it can send a new request.</p>
      <label className="mt-4 block text-sm font-semibold">Reason for rejection
        <textarea ref={ref} rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder="e.g. The account title does not match the hospital owner" className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal-700" />
      </label>
      {error && <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2.5">
        <button disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</button>
        <button disabled={saving} onClick={submit} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Rejecting…" : "Reject request"}</button>
      </div>
    </Modal>
  );
}
