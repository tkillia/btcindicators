"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetch("/api/cron");
      router.refresh();
    } catch {
      // silent fail — page will still show cached data
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-card/80 text-muted hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-wait"
    >
      {loading ? "Refreshing..." : "Refresh data"}
    </button>
  );
}
