import type { SearchItem, SearchMethod, SearchResult } from "./types";

const SCORE_GAP_LEADING = -0.005;
const SCORE_GAP_TRAILING = -0.005;
const SCORE_GAP_INNER = -0.01;
const SCORE_MATCH_CONSECUTIVE = 1.0;
const SCORE_MATCH_SLASH = 0.9;
const SCORE_MATCH_WORD = 0.8;
const SCORE_MATCH_CAPITAL = 0.7;
const SCORE_MATCH_DOT = 0.6;
const BONUS_FIRST_CHAR = 0.6;

function isSlash(c: string): boolean {
  return c === "/" || c === "\\";
}

function computeBonus(prev: string, curr: string): number {
  if (isSlash(prev)) return SCORE_MATCH_SLASH;
  if (prev === "_" || prev === "-" || prev === " ") return SCORE_MATCH_WORD;
  if (prev === ".") return SCORE_MATCH_DOT;
  if (prev === prev.toLowerCase() && curr === curr.toUpperCase()) return SCORE_MATCH_CAPITAL;
  return 0;
}

function fuzzyMatch(needle: string, haystack: string): { score: number; positions: number[] } | null {
  const n = needle.length;
  const m = haystack.length;
  if (n === 0) return { score: 0, positions: [] };
  if (n > m) return null;

  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  let ni = 0;
  for (let hi = 0; hi < m; hi++) {
    if (needleLower[ni] === haystackLower[hi]) ni++;
    if (ni === n) break;
  }
  if (ni < n) return null;

  const D: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  const M: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));

  for (let i = 0; i < n; i++) {
    let prevScore = -Infinity;
    let gapScore = i === n - 1 ? SCORE_GAP_TRAILING : SCORE_GAP_INNER;

    for (let j = 0; j < m; j++) {
      if (needleLower[i] === haystackLower[j]) {
        let score = 0;
        if (i === 0) {
          score = j * SCORE_GAP_LEADING;
          if (j === 0) score += BONUS_FIRST_CHAR;
          else score += computeBonus(haystack[j - 1], haystack[j]);
        } else if (j > 0) {
          const bonus = computeBonus(haystack[j - 1], haystack[j]);
          score = Math.max(
            M[i - 1][j - 1] + bonus,
            D[i - 1][j - 1] + SCORE_MATCH_CONSECUTIVE
          );
        }
        D[i][j] = score;
        M[i][j] = Math.max(score, prevScore + gapScore);
      } else {
        D[i][j] = -Infinity;
        M[i][j] = prevScore + gapScore;
      }
      prevScore = M[i][j];
    }
  }

  let bestJ = 0;
  for (let j = 1; j < m; j++) {
    if (M[n - 1][j] > M[n - 1][bestJ]) bestJ = j;
  }

  const positions: number[] = new Array(n);
  let i = n - 1;
  let j = bestJ;
  while (i >= 0 && j >= 0) {
    if (D[i][j] !== -Infinity && (i === 0 || j === 0 || D[i][j] >= M[i][j])) {
      positions[i] = j;
      i--;
      j--;
    } else {
      j--;
    }
  }

  return { score: M[n - 1][bestJ], positions };
}

function fulltextMatch(needle: string, haystack: string): { score: number; positions: number[] } | null {
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return null;

  const positions = Array.from({ length: needle.length }, (_, i) => idx + i);
  let score = 1.0;
  if (idx === 0) score += 0.5;
  score -= idx * 0.01;
  return { score, positions };
}

function prefixMatch(needle: string, haystack: string): { score: number; positions: number[] } | null {
  const words = haystack.split(/[\s\-_/.:]+/);
  const needleLower = needle.toLowerCase();
  let offset = 0;

  for (const word of words) {
    if (word.toLowerCase().startsWith(needleLower)) {
      const start = haystack.toLowerCase().indexOf(word.toLowerCase(), offset);
      const positions = Array.from({ length: needle.length }, (_, i) => start + i);
      let score = 1.0;
      if (start === 0) score += 0.5;
      return { score, positions };
    }
    offset += word.length + 1;
  }
  return null;
}

export function search(items: SearchItem[], query: string, method: SearchMethod): SearchResult[] {
  if (!query) {
    return items.map((item) => ({ item, score: 0, positions: [] }));
  }

  const matchFn = method === "fuzzy" ? fuzzyMatch
    : method === "fulltext" ? fulltextMatch
    : prefixMatch;

  const results: SearchResult[] = [];

  for (const item of items) {
    const haystack = `${item.title} ${item.url}`;
    const match = matchFn(query, haystack);
    if (match) {
      results.push({ item, score: match.score, positions: match.positions });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
