# CyForesight Smart Detection — Technical Reference

## 1. Threat Score Formula

Each IOC receives a composite threat score in the range **0–100**, computed entirely from structured fields already stored on the IOC record. No external call is required.

### Formula

```
ThreatScore(IOC) = min(100, round(
  (severity_weight + mitre_bonus)
    × confidence_factor
    × recency_factor
    × source_multiplier
    × 100
))
```

### Component Definitions

| Component | Symbol | Formula | Range |
|---|---|---|---|
| Severity weight | W_sev | critical=1.0, high=0.8, medium=0.55, low=0.35, info=0.2 | [0.2, 1.0] |
| MITRE bonus | W_mitre | 0.15 if `mitreTechniques.length > 0`, else 0 | {0, 0.15} |
| Confidence factor | F_conf | `max(0.1, confidence / 100)` | (0.1, 1.0] |
| Recency factor | F_rec | see table below | {0.45, 0.6, 0.75, 0.9, 1.0} |
| Source multiplier | M_src | `1.0 + min(0.3, sources.length × 0.1)` | [1.0, 1.3] |

**Recency factor lookup:**

| Age of `lastSeen` | Recency factor |
|---|---|
| ≤ 1 day | 1.00 |
| ≤ 7 days | 0.90 |
| ≤ 30 days | 0.75 |
| ≤ 90 days | 0.60 |
| > 90 days | 0.45 |

### Worked Example

IOC: `45.95.147.12` — severity=high, confidence=72%, lastSeen 2 days ago, 2 sources, mapped to T1071 (C2 comms).

```
W_sev   = 0.8            (high)
W_mitre = 0.15           (T1071 mapped)
F_conf  = 0.72           (72% confidence)
F_rec   = 0.90           (2 days old)
M_src   = 1.0 + 0.2 = 1.2  (2 sources)

score = round((0.8 + 0.15) × 0.72 × 0.90 × 1.2 × 100)
      = round(0.95 × 0.72 × 0.90 × 1.2 × 100)
      = round(73.87)
      = 74
```

---

## 2. Correlation Signals

CyForesight correlates IOCs to surface related indicators and explain clusters. Three signals are used, each weighted independently:

| Signal | Drizzle / SQL implementation | Weight in relevance score |
|---|---|---|
| **Tag overlap** | Intersection of `ioc.tags[]` arrays | 2 points per shared tag |
| **MITRE technique overlap** | Intersection of `ioc.mitreTechniques[]` arrays | 3 points per shared TID |
| **Source overlap** | Intersection of `ioc.sources[]` arrays | 1.5 points per shared source |

The candidate pool is first narrowed to IOCs of the **same type** (IP, domain, hash…), then ranked by the weighted relevance score descending. The top-N are returned as "Related IOCs".

**Rationale for weights:** MITRE technique overlap is weighted highest (3) because two IOCs sharing a TID have been attributed to the same adversary capability — a strong structural link. Tag overlap (2) captures analyst-annotated campaigns or threat actors. Source overlap (1.5) reflects feed co-occurrence, which is informative but weaker (the same feed often ingests large indicator sets without implying a relationship).

### Asset–Technique Correlation

The MITRE ATT&CK matrix page additionally correlates IOC-to-asset via technique:

1. For each IOC that has `mitreTechniques[]` populated, look up the assets whose `affectedAssets` field includes this IOC's ID.
2. Aggregate by technique ID to produce a ranked list: `techniqueId → iocCount, affectedAssetCount, topAssets[]`.
3. Sort by `iocCount DESC` to surface the most-targeted techniques.

---

## 3. Anomaly Detection Method

### Algorithm: Z-score over rolling 7-day hourly window

```
Input:  Created-at timestamps of all IOCs in the last 7 days
Output: List of 1-hour buckets where ingestion rate is anomalous
```

**Step 1 — Aggregate:**
```sql
SELECT date_trunc('hour', created_at) AS hour, count(*)::int AS count
FROM iocs
WHERE created_at >= now() - interval '7 days'
GROUP BY hour
ORDER BY hour DESC
```

**Step 2 — Compute baseline statistics:**
```
μ = mean(counts)
σ = stddev(counts)   -- population std deviation
```

**Step 3 — Flag anomalies:**
A bucket is flagged as anomalous when:
```
count[h] > μ + 2σ   AND   count[h] ≥ 2
```

The `≥ 2` guard prevents false positives when baseline is near zero (e.g. a fresh install with few IOCs).

**Step 4 — Compute Z-score for each spike:**
```
Z = (count[h] - μ) / max(σ, 1)
```

`max(σ, 1)` avoids division by zero when all hourly counts are identical.

### Interpretation

| Z-score | Interpretation |
|---|---|
| 2.0–3.0 | Moderate spike — likely a scheduled feed sync or manual import |
| 3.0–5.0 | Significant spike — bulk import, mass feed activation, or incident response |
| > 5.0 | Extreme spike — likely a deliberate dataset dump or coordinated threat sharing event |

### Why Z-score?

Z-score (standard normal deviation) is simple, interpretable, and requires no training data beyond the rolling 7-day window. It adapts automatically to each deployment's baseline ingestion rate — a high-volume deployment won't flag normal ingestion as anomalous. An alternative (EWMA-based) approach would respond faster to gradual drift but is harder to explain to stakeholders.

---

## 4. Frontend Score Breakdown UI

The IOC detail page (`/iocs/:id`) renders each score component as a labeled progress bar:

- **Severity Weight** — red bar; height proportional to the weight (0.2–1.0)
- **Confidence Factor** — blue bar; fills to the IOC's reported confidence %
- **Recency Factor** — cyan bar; decays with age of `lastSeen`
- **Source Corroboration** — green bar; fills based on how close the multiplier is to its maximum (+0.3)
- **MITRE Mapping Bonus** — violet bar; full if any technique is mapped, empty otherwise

Each bar is accompanied by a plain-English explanation sentence so an analyst understands exactly how the score was derived without consulting this document.
