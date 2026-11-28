import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppLayout from './AppLayout';
import { AppShellContext, type AppShellOptions } from './useAppShell';

/**
 * 홈, 워크스페이스, 아카이브, 폴더, 양식 목록이 함께 쓰는 틀 (사이드 바 + 상단 바).
 * 화면을 옮길 때 틀은 그대로 두고 본문(Outlet)만 바꾼다. 화면마다 틀을 새로 그리면 사이드 바 스크롤이 처음으로 돌아가고
 * 사이드 바, 상단 바가 다시 그려진다. 화면은 useAppShell로 본문 클래스, 펼칠 워크스페이스 등을 알린다
 */
export default function AppShell() {
  const [options, setOptions] = useState<AppShellOptions>({});

  return (
    <AppShellContext.Provider value={setOptions}>
      <AppLayout className={options.className} workspaceId={options.workspaceId} fitScreen={options.fitScreen}>
        <Outlet />
      </AppLayout>
    </AppShellContext.Provider>
  );
}
