const RANKING_KEYWORDS = /\b(top|best|worst|greatest|most|least|finest|favorite|iconic|legendary|essential|influential|underrated|overrated|controversial|important|hidden|all.time|must.know|must.see|must.read|must.watch)\b/i;

const LIST_POST_TYPES = new Set([
  'top_list', 'best_of', 'worst_of', 'hidden_gems', 'counter_list',
]);

export interface FormatCheckResult {
  valid: boolean;
  code?: 'NO_NUMBER' | 'NUMBER_TOO_SMALL' | 'NUMBER_TOO_LARGE' | 'NO_RANKING_KEYWORD' | 'NOT_LIST_TYPE';
  error?: string;
  number?: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  NO_NUMBER: 'Title must specify a list size like "Top 10" or "Best 5"',
  NUMBER_TOO_SMALL: 'Minimum list size is 3. Use 3-100.',
  NUMBER_TOO_LARGE: 'Maximum list size is 100. Use 3-100.',
  NO_RANKING_KEYWORD: 'Title must indicate a ranked list (e.g., Top 10, Best 5, 10 Greatest)',
};

export function needsListTitleValidation(postType: string): boolean {
  return LIST_POST_TYPES.has(postType);
}

export function validateListTitle(title: string): FormatCheckResult {
  if (!title || typeof title !== 'string') {
    return { valid: false, code: 'NO_NUMBER', error: ERROR_MESSAGES.NO_NUMBER };
  }

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
