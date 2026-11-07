"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";

const NAV = [
 
  { label: "Subscriptions", href: "/subscriptions" },
  
];

  function SubscriptionNavigation() {
  const pathname = usePathname();

    return NAV.map((item) => {
      const active = pathname.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`mb-1 block rounded-lg px-3.5 py-2.5 text-sm ${
            active
              ? "bg-teal-800 font-semibold text-white"
              : "text-teal-100 hover:bg-teal-900"
          }`}
        >
          {item.label}
        </Link>
      );
    });
  }

  export default function AdminShell({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-56 flex-none bg-teal-950 px-4 py-6">
        <div className="px-3.5 pb-7 text-lg font-bold text-white">HMS Admin</div>
        <nav>
            <Suspense
              fallback={
                <Link
                  href="/subscriptions"
                  className="mb-1 block rounded-lg px-3.5 py-2.5 text-sm text-teal-100"
                >
                  Subscriptions
                </Link>
              }
            >
              <SubscriptionNavigation />
            </Suspense>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
      <Toaster position="top-right" />
    </div>
  );
}