import 'dotenv/config';
import geoip from 'geoip-lite';
import { and, eq, isNull, sql } from 'drizzle-orm';
import db from '../config/database';
import { iocs } from '../models/schema';

// One-off backfill: populate geo_lat/geo_lng/geo_country for existing IP IOCs.
async function main() {
  const BATCH = 1000;
  let totalUpdated = 0;
  let totalScanned = 0;

  for (;;) {
    const rows = await db
      .select({ id: iocs.id, value: iocs.value })
      .from(iocs)
      .where(and(eq(iocs.type, 'ip'), isNull(iocs.geoLat), isNull(iocs.geoCountry)))
      .limit(BATCH);

    if (rows.length === 0) break;
    totalScanned += rows.length;

    for (const row of rows) {
      let set: Record<string, string | null> = { geoLat: null, geoLng: null, geoCountry: null, geoCity: null };
      try {
        const g = geoip.lookup(row.value);
        if (g && g.ll && g.ll[0] !== 0) {
          set = { geoLat: String(g.ll[0]), geoLng: String(g.ll[1]), geoCountry: g.country || null, geoCity: g.city || null };
          totalUpdated++;
        }
      } catch { /* skip */ }
      // Write a value even if null-resolved so we don't re-scan the same row forever.
      // Use a sentinel: rows that resolve get real geo; unresolved get geoCountry='??'.
      if (!set.geoCountry) { set = { ...set, geoCountry: 'XX' }; }
      await db.update(iocs).set(set as any).where(eq(iocs.id, row.id));
    }
    console.log(`Scanned ${totalScanned}, geo-resolved ${totalUpdated}...`);
  }

  const [{ withGeo }] = await db
    .select({ withGeo: sql<number>`count(*) FILTER (WHERE ${iocs.geoLat} IS NOT NULL)` })
    .from(iocs)
    .where(eq(iocs.type, 'ip'));

  console.log(`DONE. IP IOCs with geo_lat: ${withGeo}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
