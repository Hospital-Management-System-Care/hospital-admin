/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { getProtectedFile } from "@/lib/adminApi";

// Auth-protected images can't use a plain <img src> (it can't send the token), so the file
// is fetched as a blob and shown through an object URL, revoked on cleanup.
export default function ProtectedImage({ url, alt, className = "max-h-120", emptyText = "Screenshot unavailable", compact = false }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setSrc("");
    setFailed(false);
    if (url) {
      getProtectedFile(url)
        .then((created) => {
          objectUrl = created;
          if (active) setSrc(created); else URL.revokeObjectURL(created);
        })
        .catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  if (!src) {
    const text = !url || failed ? emptyText : "Loading…";
    return compact
      ? <span className="text-xs text-slate-500">{text}</span>
      : <div className="flex h-56 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">{text}</div>;
  }

  if (compact) {
    return (
      <a href={src} target="_blank" rel="noreferrer" title="View full size">
        <img src={src} alt={alt} className="h-12 w-16 rounded border border-slate-200 object-cover" />
      </a>
    );
  }

  return <>
    <img src={src} alt={alt} className={`${className} rounded-lg border border-slate-200`} />
    <a href={src} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-700">View full size</a>
  </>;
}
