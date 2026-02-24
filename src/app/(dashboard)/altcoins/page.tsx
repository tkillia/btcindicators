import { fetchAllAltcoinData } from "@/lib/altcoins/fetch-altcoin-data";
import { AltcoinScreener } from "@/components/altcoins/AltcoinScreener";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AltcoinsPage() {
  const data = await fetchAllAltcoinData();

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-7xl mx-auto">
      <AltcoinScreener data={data} />
    </main>
  );
}
