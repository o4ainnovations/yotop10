const levenshtein = require('fast-levenshtein');
import { normalizeTitle, NormalizedTitle, isYearVariation } from './titleNormalization';

/**
 * Dynamic threshold calculation based on title length
 * Exact implementation per plans.md specification
 */
function getThresholds(length: number): { block: number; warn: number } {
  if (length < 8) return { block: 1.0, warn: 1.0 }; // SKIP CHECK
  if (length <= 12) return { block: 0.90, warn: 0.80 };
  if (length <= 25) return { block: 0.87, warn: 0.77 };
  return { block: 0.82, warn: 0.72 };
}

/**
 * Calculate similarity between two titles
 */
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshtein.get(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - (distance / maxLength);
}

/**
 * Count number of exact whole word matches
 */
function countWordMatches(a: string[], b: string[]): number {
  const setA = new Set(a);
  return b.filter(word => setA.has(word)).length;
}

/**
 * Full title matching logic
 * Returns similarity score and whether it's a duplicate
 */
export function checkTitleMatch(
  newTitle: string, 
  existingTitle: string
): { 
  similarity: number; 
  isDuplicate: boolean; 
  isWarning: boolean;
  isYearVariation: boolean;
} {
  const a = normalizeTitle(newTitle);
  const b = normalizeTitle(existingTitle);

  if (isYearVariation(a, b)) {
    return {
      similarity: 1.0,
      isDuplicate: false,
      isWarning: false,
      isYearVariation: true,
    };
  }

  const similarity = calculateSimilarity(a.normalized, b.normalized);
  const wordMatches = countWordMatches(a.words, b.words);
  const thresholds = getThresholds(a.length);

  // Two layer matching system: must meet both similarity AND word count requirements
  const isDuplicate = similarity >= thresholds.block && wordMatches >= 2;
  const isWarning = similarity >= thresholds.warn && wordMatches >= 2;

  return {
    similarity: Math.round(similarity * 100),
    isDuplicate,
    isWarning,
    isYearVariation: false,
  };
}
