"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { getAdminToken, getInReviewRefundCount, onRefundsChanged } from "@/lib/adminApi";

const NAV = [
  { label: "Subscriptions", href: "/subscriptions" },
  { label: "Refund Requests", href: "/refunds", badge: "refunds" },
];

const BADGE_REFRESH_MS = 60_000;

// Count of IN_REVIEW refund requests. Refreshes every minute, when the window regains focus,
// and after a refund/reject or sign-in/out.
function RefundBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!getAdminToken()) { setCount(0); return; }
      getInReviewRefundCount()
        .then((total) => { if (active) setCount(total); })
        .catch(() => { if (active) setCount(0); });
    };
    refresh();
    const timer = window.setInterval(refresh, BADGE_REFRESH_MS);
    window.addEventListener("focus", refresh);
    const stopListening = onRefundsChanged(refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      stopListening();
    };
  }, []);

  if (!count) return null;
  return (
    <span aria-label={`${count} in review`} className="ml-auto min-w-6 rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold text-amber-950">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const linkClass = (active) =>
  `mb-1 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm ${
    active ? "bg-teal-800 font-semibold text-white" : "text-teal-100 hover:bg-teal-900"
  }`;

function Navigation() {
  const pathname = usePathname();
  return NAV.map((item) => (
    <Link key={item.href} href={item.href} className={linkClass(pathname.startsWith(item.href))}>
      {item.label}
      {item.badge === "refunds" && <RefundBadge />}
    </Link>
  ));
}

export default function AdminShell({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-56 flex-none bg-teal-950 px-4 py-6">
        <div className="px-3.5 pb-7 text-lg font-bold text-white">HMS Admin</div>
        <nav>
          <Suspense
            fallback={NAV.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(false)}>{item.label}</Link>
            ))}
          >
            <Navigation />
          </Suspense>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
      <Toaster position="top-right" />
    </div>
  );
}
