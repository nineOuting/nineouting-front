import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** 설정 창 왼쪽 메뉴 (디자인 Page 9 11 설정: 프로필, 요금제, 화면, 삭제 목록, 도움말) */
export type SettingsTab = 'profile' | 'plan' | 'display' | 'trash' | 'help';

export const SETTINGS_TABS: SettingsTab[] = ['profile', 'plan', 'display', 'trash', 'help'];

/** 주소의 ?settings=탭 이름. 창을 닫아도 보던 화면이 그대로 남고, 뒤로 가기로 닫을 수 있다 */
export const SETTINGS_PARAM = 'settings';

/** 설정 창 주소 (예전 /profile 같은 주소에서 넘어올 때) */
export function settingsPath(tab: SettingsTab, pathname = '/home') {
  return `${pathname}?${SETTINGS_PARAM}=${tab}`;
}

/** REQ-145 설정 창 열기, 닫기. 보던 화면 위에 띄운다 */
export function useSettingsModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(SETTINGS_PARAM);
  const tab = SETTINGS_TABS.find((item) => item === value) ?? null;

  // 창 안에서 메뉴를 바꿀 때는 기록을 쌓지 않는다 (뒤로 가기 한 번에 창이 닫히게)
  const open = useCallback(
    (next: SettingsTab, options?: { replace?: boolean }) =>
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set(SETTINGS_PARAM, next);
          return params;
        },
        { replace: options?.replace },
      ),
    [setSearchParams],
  );

  const close = useCallback(
    () =>
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete(SETTINGS_PARAM);
        return params;
      }),
    [setSearchParams],
  );

  return { tab, open, close };
}
