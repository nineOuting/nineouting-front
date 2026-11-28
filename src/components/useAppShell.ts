import { createContext, useContext, useLayoutEffect } from 'react';

/** 공통 틀(AppShell) 안의 화면이 틀에 알리는 값 (AppLayout에 넘기던 것) */
export interface AppShellOptions {
  /** 본문(main)에 붙일 화면 클래스 */
  className?: string;
  /** 지금 보고 있는 워크스페이스 (왼쪽 메뉴에서 펼쳐 둔다) */
  workspaceId?: number;
  /** 화면 높이에 맞춘다 (홈) */
  fitScreen?: boolean;
}

export const AppShellContext = createContext<((options: AppShellOptions) => void) | null>(null);

/**
 * 공통 틀 안의 화면이 부른다. 그리기 전에(useLayoutEffect) 알려서 이전 화면의 클래스가 잠깐 보이지 않게 한다.
 * 틀 밖(회의 대기처럼 AppLayout을 직접 쓰는 화면)에서는 아무것도 하지 않는다
 */
export function useAppShell({ className, workspaceId, fitScreen }: AppShellOptions) {
  const setOptions = useContext(AppShellContext);
  useLayoutEffect(() => {
    setOptions?.({ className, workspaceId, fitScreen });
  }, [setOptions, className, workspaceId, fitScreen]);
}
