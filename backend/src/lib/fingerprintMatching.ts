import { FingerprintObservation } from '../models/FingerprintObservation';

type FingerprintSignals = Record<string, string | number | boolean>;

const SIGNALS = {
  tier0: [
    { name: 'screenResolution', weight: 25 },
    { name: 'colorDepth', weight: 25 },
    { name: 'hardwareConcurrency', weight: 25 },
    { name: 'timezoneOffset', weight: 25 },
    { name: 'platform', weight: 25 },
    { name: 'devicePixelRatio', weight: 25 },
    { name: 'maxTouchPoints', weight: 25 },
  ],
  tier1: [
    { name: 'webglRenderer', weight: 10 },
    { name: 'webglVendor', weight: 10 },
    { name: 'audioFingerprint', weight: 10 },
    { name: 'cpuCoreCount', weight: 10 },
    { name: 'maxHeapSize', weight: 10 },
    { name: 'canvasHash', weight: 10 },
    { name: 'webglExtensions', weight: 10 },
  ],
  tier2: [
    { name: 'canvasPixelRatio', weight: 1 },
    { name: 'touchSupport', weight: 1 },
    { name: 'webglShaderPrecision', weight: 1 },
    { name: 'audioSampleRate', weight: 1 },
    { name: 'localStorageAvailable', weight: 1 },
    { name: 'indexedDBAvailable', weight: 1 },
  ]
};

function getSignalAgeWeight(ageDays: number): number {
  if (ageDays < 7) return 1.0;
  if (ageDays < 30) return 0.5;
  if (ageDays < 90) return 0.1;
  return 0.0;
}

function calculateSimilarity(signalA: FingerprintSignals, signalB: FingerprintSignals, signalList: Array<{ name: string; weight: number }>): number {
  let score = 0; let maximum = 0;
  for (const signal of signalList) {
    maximum += signal.weight;
    if (signalA[signal.name] !== undefined && signalA[signal.name] === signalB[signal.name]) score += signal.weight;
  }
  return maximum > 0 ? score / maximum : 0;
}

export async function findMatchingUser(tier0: FingerprintSignals, tier1: FingerprintSignals, tier2: FingerprintSignals): Promise<string | null> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const observations = await FingerprintObservation.find({ observed_at: { $gte: ninetyDaysAgo } }).sort({ observed_at: -1 }).lean();
  const allSignals: FingerprintSignals = { ...tier0, ...tier1, ...tier2 };

  let bestMatch: { userId: string; score: number } | null = null;

  for (const observation of observations) {
    const ageMs = Date.now() - observation.observed_at.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const ageWeight = getSignalAgeWeight(ageDays);
    if (ageWeight === 0) continue;

    const observedAll = { ...(observation.tier0 as unknown as FingerprintSignals || {}), ...(observation.tier1 as unknown as FingerprintSignals), ...(observation.tier2 as unknown as FingerprintSignals) };

    // Tier 0 (machine-stable) — cross-browser threshold ≥ 0.80
    const t0Score = calculateSimilarity(allSignals, observedAll, SIGNALS.tier0);

    if (t0Score >= 0.80) {
      // Same machine confirmed via Tier 0. Accept regardless of Tier 1/2 browser differences.
      const finalScore = t0Score * ageWeight;
      if (finalScore >= 0.75) return observation.user_id;
    }

    // Tier 1 + Tier 2 (same-browser re-identification) — threshold ≥ 0.90
    const t1Score = calculateSimilarity(allSignals, observedAll, SIGNALS.tier1);
    const t2Score = calculateSimilarity(allSignals, observedAll, SIGNALS.tier2);
    const combinedScore = (t0Score * 25 + t1Score * 10 + t2Score * 1) / 36 * ageWeight;

    // Negative matching: 6/7 Tier 0 signals = same device
    let t0Matches = 0;
    for (const signal of SIGNALS.tier0) {
      if (allSignals[signal.name] !== undefined && allSignals[signal.name] === observedAll[signal.name]) t0Matches++;
    }
    if (t0Matches >= 6 && combinedScore >= 0.70) return observation.user_id;

    if (!bestMatch || combinedScore > bestMatch.score) {
      bestMatch = { userId: observation.user_id, score: combinedScore };
    }
  }

  if (bestMatch && bestMatch.score >= 0.90) return bestMatch.userId;
  return null;
}

export async function storeFingerprintObservation(
  userId: string, fingerprintHash: string,
  tier0: FingerprintSignals, tier1: FingerprintSignals, tier2: FingerprintSignals
): Promise<void> {
  await FingerprintObservation.create({
    user_id: userId, fingerprint_hash: fingerprintHash,
    tier0, tier1, tier2, observed_at: new Date(),
  });
}
