export interface NormalizedTitle {
  original: string;
  normalized: string;
  words: string[];
  hasYearSuffix: boolean;
  year?: number;
  length: number;
}

/**
 * Standard title normalization pipeline
 * Implemented exactly per plans.md specification
 */
export function normalizeTitle(title: string): NormalizedTitle {
  let normalized = title
    .toLowerCase()
    .replace(/[^\w\s:']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove filler words, but only if at least 3 words remain after removal
  const wordsBefore = normalized.split(' ').filter(w => w.length > 0);
  let withoutFillers = wordsBefore
    .filter(word => !['the', 'and', 'of', 'in'].includes(word))
    .join(' ');

  if (withoutFillers.split(' ').filter(w => w.length > 0).length >= 3) {
    normalized = withoutFillers;
  }

  // Simple plural normalization
  normalized = normalized
    .replace(/ies\b/g, 'y')
    .replace(/ves\b/g, 'f')
    .replace(/es\b/g, '')
    .replace(/s\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Detect year suffix at END only
  const yearMatch = normalized.match(/\s(19[5-9]\d|20[0-3]\d)$/);
  const hasYearSuffix = !!yearMatch;
  const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

  const words = normalized.split(' ').filter(w => w.length > 0);

  return {
    original: title,
    normalized,
    words,
    hasYearSuffix,
    year,
    length: normalized.length,
  };
}

/**
 * Check if two normalized titles are year variations only
 */
export function isYearVariation(a: NormalizedTitle, b: NormalizedTitle): boolean {
  const aWithoutYear = a.hasYearSuffix 
    ? a.normalized.slice(0, -5).trim() 
    : a.normalized;
  
  const bWithoutYear = b.hasYearSuffix 
    ? b.normalized.slice(0, -5).trim() 
    : b.normalized;
  
  return aWithoutYear === bWithoutYear && a.year !== b.year;
}
