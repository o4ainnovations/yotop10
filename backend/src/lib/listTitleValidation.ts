const ALL_TIME_REGEX = /\b(all time|of all time)\b/i;
const YEAR_ANYWHERE = /\b(19[5-9]\d|20[0-3]\d)\b/;

const RANKING_KEYWORDS = /\b(top|best|worst|greatest|most|least|finest|favorite|iconic|legendary|essential|influential|underrated|overrated|controversial|important|hidden|all.time|must.know|must.see|must.read|must.watch)\b/i;

const LIST_POST_TYPES = new Set([
  'top_list', 'best_of', 'worst_of', 'hidden_gems', 'counter_list',
]);

export interface FormatCheckResult {
  valid: boolean;
  code?: 'NO_NUMBER' | 'NUMBER_TOO_SMALL' | 'NUMBER_TOO_LARGE' | 'NO_RANKING_KEYWORD' | 'NO_BEST' | 'NO_WORST' | 'NO_OF' | 'NOT_LIST_TYPE' | 'ALL_TIME_WITH_YEAR';
  error?: string;
  number?: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  NO_NUMBER: 'Title must specify a list size like "Top 10" or "Best 5"',
  NUMBER_TOO_SMALL: 'Minimum list size is 3. Use 3-100.',
  NUMBER_TOO_LARGE: 'Maximum list size is 100. Use 3-100.',
  NO_RANKING_KEYWORD: 'Title must indicate a ranked list (e.g., Top 10, Best 5, 10 Greatest)',
  NO_BEST: 'Title must start with "Best"',
  NO_WORST: 'Title must start with "Worst"',
  NO_OF: 'Title must contain "of"',
  ALL_TIME_WITH_YEAR: 'Titles with "of all time" or "all time" cannot include a year — they are contradictory',
};

export function needsListTitleValidation(postType: string): boolean {
  return LIST_POST_TYPES.has(postType);
}

export function validateListTitle(title: string, postType?: string): FormatCheckResult {
  if (!title || typeof title !== 'string') {
    return { valid: false, code: 'NO_NUMBER', error: ERROR_MESSAGES.NO_NUMBER };
  }

  if (ALL_TIME_REGEX.test(title) && YEAR_ANYWHERE.test(title)) {
    return { valid: false, code: 'ALL_TIME_WITH_YEAR', error: ERROR_MESSAGES.ALL_TIME_WITH_YEAR };
  }

  // best_of: must start with "Best" and contain "of" anywhere
  if (postType === 'best_of') {
    if (!/^Best\b/i.test(title)) {
      return { valid: false, code: 'NO_BEST', error: ERROR_MESSAGES.NO_BEST };
    }
    if (!/\bof\b/i.test(title)) {
      return { valid: false, code: 'NO_OF', error: ERROR_MESSAGES.NO_OF };
    }
    return { valid: true };
  }

  // worst_of: must start with "Worst" and contain "of" anywhere
  if (postType === 'worst_of') {
    if (!/^Worst\b/i.test(title)) {
      return { valid: false, code: 'NO_WORST', error: ERROR_MESSAGES.NO_WORST };
    }
    if (!/\bof\b/i.test(title)) {
      return { valid: false, code: 'NO_OF', error: ERROR_MESSAGES.NO_OF };
    }
    return { valid: true };
  }

  // top_list, hidden_gems, counter_list: require number + ranking keyword
  const numberMatch = title.match(/\b(\d{1,3})\b/);
  if (!numberMatch) {
    return { valid: false, code: 'NO_NUMBER', error: ERROR_MESSAGES.NO_NUMBER };
  }

  const listNumber = parseInt(numberMatch[1], 10);

  if (listNumber < 3) {
    return { valid: false, code: 'NUMBER_TOO_SMALL', error: ERROR_MESSAGES.NUMBER_TOO_SMALL, number: listNumber };
  }

  if (listNumber > 100) {
    return { valid: false, code: 'NUMBER_TOO_LARGE', error: ERROR_MESSAGES.NUMBER_TOO_LARGE, number: listNumber };
  }

  const numberIndex = title.search(/\b\d{1,3}\b/);
  const searchStart = Math.max(0, numberIndex - 20);
  const searchEnd = Math.min(title.length, numberIndex + 20);
  const contextWindow = title.substring(searchStart, searchEnd);

  if (!RANKING_KEYWORDS.test(contextWindow)) {
    return { valid: false, code: 'NO_RANKING_KEYWORD', error: ERROR_MESSAGES.NO_RANKING_KEYWORD, number: listNumber };
  }

  return { valid: true, number: listNumber };
}
