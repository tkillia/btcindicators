import { fetchKoreanData } from "@/lib/korean/fetch-korean-data";
import { KoreanScreener } from "@/components/korean/KoreanScreener";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function KoreanPage() {
  const data = await fetchKoreanData();

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-7xl mx-auto">
      <KoreanScreener data={data} />
    </main>
  );
}
