"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "BTC", href: "/" },
  { label: "Altcoins", href: "/altcoins" },
];

export function TabNavigation() {
  const pathname = usePathname();
  return (
    <nav className="max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-6">
      <div className="flex gap-1 bg-card rounded-lg p-1 w-fit border border-border">
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-blue text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
