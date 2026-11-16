/**
 * 디자인 Version02 Live_22~24 용어 감지. 아직 AI 용어 감지가 없어 자주 나오는 업무 용어 사전으로 전사에서 찾는다 (화면 확인용)
 */
export const GLOSSARY: Record<string, { name: string; meaning: string }> = {
  리텐션: { name: '리텐션 (Retention)', meaning: '한 번 쓴 사용자가 다시 돌아와 계속 쓰는 비율이에요.' },
  온보딩: { name: '온보딩 (Onboarding)', meaning: '새 사용자가 서비스에 처음 들어와 익숙해지기까지의 과정이에요.' },
  KPI: { name: 'KPI (핵심 성과 지표)', meaning: '목표를 얼마나 이뤘는지 재는 핵심 숫자예요.' },
  MVP: { name: 'MVP (최소 기능 제품)', meaning: '핵심 기능만 담아 빨리 내놓는 첫 버전이에요.' },
  이탈률: { name: '이탈률 (Churn rate)', meaning: '서비스를 쓰다가 그만두는 사용자의 비율이에요.' },
  우선순위: { name: '우선순위', meaning: '여러 일 중 먼저 처리할 순서예요.' },
  QA: { name: 'QA (품질 보증)', meaning: '출시 전에 기능이 제대로 동작하는지 검사하는 일이에요.' },
};

export const TERM_PATTERN = new RegExp(`(${Object.keys(GLOSSARY).join('|')})`, 'g');

/** 전사 전체에서 나온 용어 (처음 나온 순서) */
export function detectTerms(texts: string[]) {
  const found: string[] = [];
  for (const text of texts) {
    for (const match of text.matchAll(TERM_PATTERN)) {
      if (!found.includes(match[0])) {
        found.push(match[0]);
      }
    }
  }
  return found;
}

/** "리텐션이 뭐야?", "KPI가 뭐야?" 처럼 받침에 맞춰 묻는 말을 만든다 */
export function askAbout(term: string) {
  const last = term.charCodeAt(term.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasBatchim = isHangul && (last - 0xac00) % 28 !== 0;
  return `${term}${hasBatchim ? '이' : '가'} 뭐야?`;
}
