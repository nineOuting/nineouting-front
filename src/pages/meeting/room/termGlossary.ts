import type { TranscriptTerm } from '../../../api/meeting';

/** 마우스를 올렸을 때 뜻 카드에 보일 것 */
export interface TermCard {
  term: string;
  /** 카드 제목. 용어집에 적힌 이름이 없으면 term */
  title: string;
  text: string;
}

/** 표기(소문자) → 뜻 카드, 그리고 전사에서 표기를 찾는 정규식 */
export interface TermMatcher {
  pattern: RegExp | null;
  cards: Map<string, TermCard>;
}

const ALNUM_START = /^[a-z0-9]/i;
const ALNUM_END = /[a-z0-9]$/i;

/** 영문, 숫자로 시작하거나 끝나는 표기는 앞뒤에 영문, 숫자가 붙으면 다른 말로 본다 (KPIs 안의 KPI는 칠하지 않음) */
function toPattern(surface: string) {
  const escaped = surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = ALNUM_START.test(surface) ? '(?<![A-Za-z0-9])' : '';
  const after = ALNUM_END.test(surface) ? '(?![A-Za-z0-9])' : '';
  return `${before}${escaped}${after}`;
}

/**
 * REQ-191 Live_24 전사 속 용어 (ai-service 전사 속 용어 목록 API 명세 6장).
 * term과 aliases를 함께 칠하고, 영문은 대소문자를 무시하며, 겹치면 긴 표기를 먼저 칠한다.
 * 한글은 조사가 붙어도 찾는다 (리텐션이의 리텐션)
 */
export function buildTermMatcher(terms: TranscriptTerm[]): TermMatcher {
  const cards = new Map<string, TermCard>();
  for (const { term, name, aliases, text } of terms) {
    const card = { term, title: name || term, text };
    for (const surface of [term, ...(aliases ?? [])]) {
      const key = surface.trim().toLowerCase();
      if (key && !cards.has(key)) {
        cards.set(key, card);
      }
    }
  }
  if (cards.size === 0) {
    return { pattern: null, cards };
  }
  const surfaces = [...cards.keys()].sort((a, b) => b.length - a.length).map(toPattern);
  return { pattern: new RegExp(surfaces.join('|'), 'gi'), cards };
}

/** 전사 한 줄을 용어와 나머지 글자로 나눈다 */
export function splitByTerms(text: string, matcher: TermMatcher): { text: string; card?: TermCard }[] {
  if (!matcher.pattern) {
    return [{ text }];
  }
  const parts: { text: string; card?: TermCard }[] = [];
  let last = 0;
  for (const match of text.matchAll(matcher.pattern)) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index) });
    }
    parts.push({ text: match[0], card: matcher.cards.get(match[0].toLowerCase()) });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last) });
  }
  return parts;
}

/** "리텐션이 뭐야?", "KPI가 뭐야?" 처럼 받침에 맞춰 묻는 말을 만든다 */
export function askAbout(term: string) {
  const last = term.charCodeAt(term.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasBatchim = isHangul && (last - 0xac00) % 28 !== 0;
  return `${term}${hasBatchim ? '이' : '가'} 뭐야?`;
}
