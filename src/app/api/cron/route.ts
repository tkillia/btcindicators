import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  revalidateTag("btc-data");
  revalidateTag("stablecoin-data");
  revalidateTag("exchange-data");
  revalidateTag("bitfinex-data");
  revalidateTag("deribit-data");
  revalidateTag("mining-data");
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
