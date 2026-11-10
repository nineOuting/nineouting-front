/** REQ-154 화면 테마. 이 브라우저에만 저장한다 (서버에 저장할 자리가 없다) */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nepnep-theme';

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light';
  } catch {
    return 'light';
  }
}

/** nep!nep!_css 토큰은 html[data-theme]를 보고, 속성이 없으면 OS 설정을 따른다 */
export function applyTheme(preference: ThemePreference) {
  if (preference === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', preference);
  }
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // 저장이 막힌 브라우저면 이번 화면에만 적용한다
  }
  applyTheme(preference);
}
