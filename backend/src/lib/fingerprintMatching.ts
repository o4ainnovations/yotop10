import { FingerprintObservation } from '../models/FingerprintObservation';

// Signal definitions with weights
const SIGNALS = {
  tier1: [
    { name: 'webglRenderer', weight: 10 },
    { name: 'webglVendor', weight: 10 },
    { name: 'audioFingerprint', weight: 10 },
    { name: 'cpuCoreCount', weight: 10 },
    { name: 'maxHeapSize', weight: 10 },
    { name: 'devicePixelRatio', weight: 10 },
    { name: 'canvasHash', weight: 10 },
    { name: 'webglExtensions', weight: 10 },
  ],
  tier2: [
    { name: 'timezoneOffset', weight: 1 },
    { name: 'canvasPixelRatio', weight: 1 },
    { name: 'touchSupport', weight: 1 },
    { name: 'webglShaderPrecision', weight: 1 },
    { name: 'audioSampleRate', weight: 1 },
    { name: 'colorDepth', weight: 1 },
    { name: 'hardwareConcurrency', weight: 1 },
    { name: 'localStorageAvailable', weight: 1 },
    { name: 'indexedDBAvailable', weight: 1 },
  ]
};

/**
 * Time decay weighting
 * Older observations count for exponentially less
 */
function getSignalAgeWeight(ageDays: number): number {
  if (ageDays < 7) return 1.0;
  if (ageDays < 30) return 0.5;
  if (ageDays < 90) return 0.1;
  return 0.0;
}

/**
 * Tiered similarity score calculation
 */
function calculateSimilarityScore(signalA: Record<string, any>, signalB: Record<string, any>): number {
  let score = 0;
  let maximum = 0;

  // Check Tier 1 signals
  for (const signal of SIGNALS.tier1) {
    maximum += signal.weight;
    if (signalA[signal.name] === signalB[signal.name]) {
      score += signal.weight;
    }
  }

  // Check Tier 2 signals
  for (const signal of SIGNALS.tier2) {
    maximum += signal.weight;
    if (signalA[signal.name] === signalB[signal.name]) {
      score += signal.weight;
    }
  }

  return score / maximum;
}

/**
 * Negative matching logic
 * If 6 out of 7 Tier 1 signals match exactly and one differs: it is still the same device
 */
function applyNegativeMatching(similarity: number, signalA: Record<string, any>, signalB: Record<string, any>): number {
  let tier1Matches = 0;
  
  for (const signal of SIGNALS.tier1) {
    if (signalA[signal.name] === signalB[signal.name]) {
      tier1Matches++;
    }
  }

  // The single biggest accuracy gain
  if (tier1Matches >= 6) {
    return Math.max(similarity, 0.95);
  }

  return similarity;
}

/**
 * Find existing user match for new fingerprint observation
 */
export async function findMatchingUser(tier1: Record<string, any>, tier2: Record<string, any>): Promise<string | null> {
  // Get all observations from last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const observations = await FingerprintObservation.find({
    observed_at: { $gte: ninetyDaysAgo }
  }).sort({ observed_at: -1 });

  let bestMatch: { userId: string; score: number } | null = null;

  for (const observation of observations) {
    const ageMs = Date.now() - observation.observed_at.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const ageWeight = getSignalAgeWeight(ageDays);

    if (ageWeight === 0) continue;

    const observedTier1 = observation.tier1 as unknown as Record<string, any>;
    const observedTier2 = observation.tier2 as unknown as Record<string, any>;
    
    let similarity = calculateSimilarityScore(
      { ...tier1, ...tier2 },
      { ...observedTier1, ...observedTier2 }
    );

    similarity = applyNegativeMatching(similarity, tier1, observedTier1);
    similarity *= ageWeight;

    // ≥0.95 = Same device
    if (similarity >= 0.95) {
      return observation.user_id;
    }

    if (!bestMatch || similarity > bestMatch.score) {
      bestMatch = {
        userId: observation.user_id,
        score: similarity
      };
    }
  }

  return null;
}

/**
 * Store new fingerprint observation
 */
export async function storeFingerprintObservation(
  userId: string,
  fingerprintHash: string,
  tier1: Record<string, any>,
  tier2: Record<string, any>
): Promise<void> {
  await FingerprintObservation.create({
    user_id: userId,
    fingerprint_hash: fingerprintHash,
    tier1,
    tier2,
    observed_at: new Date(),
  });
}
