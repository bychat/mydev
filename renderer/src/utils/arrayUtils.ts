/**
 * Array utility functions
 */

/**
 * findLastIndex polyfill for ES2020 targets
 */
export function findLastIdx<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/**
 * Group array items by a key function
 */
export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/**
 * Remove duplicates from array based on key function
 */
export function uniqueBy<T, K>(arr: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sort array by multiple criteria
 */
export function sortBy<T>(
  arr: T[],
  ...compareFns: ((a: T, b: T) => number)[]
): T[] {
  return [...arr].sort((a, b) => {
    for (const fn of compareFns) {
      const result = fn(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extract search keywords from a user's question.
 * Looks for potential function names, class names, variable names, or quoted strings.
 */
export function extractSearchKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  // Extract quoted strings (e.g., "functionName" or 'className')
  const quotedMatches = text.match(/["'`]([^"'`]+)["'`]/g);
  if (quotedMatches) {
    for (const match of quotedMatches) {
      const content = match.slice(1, -1).trim();
      if (content.length >= 3 && content.length <= 50) {
        keywords.push(content);
      }
    }
  }
  
  // Extract camelCase or PascalCase words (likely function/class names)
  const camelCaseMatches = text.match(/\b[a-z]+(?:[A-Z][a-z]+)+\b|\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (camelCaseMatches) {
    keywords.push(...camelCaseMatches);
  }
  
  // Extract snake_case words
  const snakeCaseMatches = text.match(/\b[a-z]+(?:_[a-z]+)+\b/g);
  if (snakeCaseMatches) {
    keywords.push(...snakeCaseMatches);
  }
  
  // Extract words that look like code identifiers (all lowercase, 4+ chars, no common words)
  const commonWords = new Set([
    'what', 'where', 'when', 'which', 'that', 'this', 'these', 'those',
    'with', 'from', 'have', 'will', 'would', 'could', 'should', 'does',
    'make', 'made', 'code', 'file', 'find', 'help', 'want', 'need',
    'function', 'class', 'method', 'variable', 'component',
  ]);
  
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g);
  if (words) {
    for (const word of words) {
      if (!commonWords.has(word) && !keywords.some(k => k.toLowerCase() === word)) {
        keywords.push(word);
      }
    }
  }
  
  // Remove duplicates and limit
  return [...new Set(keywords)].slice(0, 5);
}
