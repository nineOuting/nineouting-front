import { lazy, Suspense } from 'react';
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from 'react-router-dom';
import GuestOnly from './auth/GuestOnly';
import RequireAuth from './auth/RequireAuth';
import ArchivePage from './pages/archive/ArchivePage';
import FolderPage from './pages/folder/FolderPage';
import HomePage from './pages/home/HomePage';
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import PasswordCompletePage from './pages/auth/PasswordCompletePage';
import PasswordFindPage from './pages/auth/PasswordFindPage';
import PasswordResetPage from './pages/auth/PasswordResetPage';
import PasswordVerifyPage from './pages/auth/PasswordVerifyPage';
import SignupCompletePage from './pages/auth/SignupCompletePage';
import SignupPage from './pages/auth/SignupPage';
import MeetingCreatePage from './pages/meeting/MeetingCreatePage';
import MeetingRoomPage from './pages/meeting/MeetingRoomPage';
import MeetingWaitingPage from './pages/meeting/MeetingWaitingPage';
import MinutesEditorPage from './pages/minutes/MinutesEditorPage';
import TemplateEditorPage from './pages/template/TemplateEditorPage';
import TemplateListPage from './pages/template/TemplateListPage';
import { settingsPath } from './pages/settings/useSettingsModal';
import AppShell from './components/AppShell';
import ChannelLauncher from './components/ChannelLauncher';
import TooltipLayer from './components/TooltipLayer';
import InvitationPage from './pages/workspace/InvitationPage';
import InviteLinkPage from './pages/workspace/InviteLinkPage';
import WorkspacePage from './pages/workspace/WorkspacePage';

// 개발 서버에서만 쓰는 화면. 운영 빌드에서는 조건이 false로 바뀌어 번들에서 빠진다
const DevMinutesPage = import.meta.env.DEV ? lazy(() => import('./pages/dev/DevMinutesPage')) : null;
// REQ-214 관리자 페이지. 일반 사용자 번들에 넣지 않으려고 따로 불러온다
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

/** 모든 화면에 함께 그리는 것 */
function RootLayout() {
  return (
    <>
      <TooltipLayer />
      <Outlet />
      <ChannelLauncher />
    </>
  );
}

// REQ-072 화면을 떠나기 전에 묻는 useBlocker는 data router에서만 동작한다
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* REQ-214 관리자 페이지: 일반 로그인과 따로, 공통 화면(채널톡 등) 없이 */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route element={<RootLayout />}>
        {/* 사이드 바와 상단 바를 함께 쓰는 화면. 화면을 옮겨도 틀은 그대로 두고 본문만 바꾼다 (사이드 바 스크롤 유지) */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
          <Route path="/workspaces/:workspaceId/archive" element={<ArchivePage />} />
          {/* 새 회의 창은 폴더 화면 위에 띄운다. 뒤 화면을 다시 그리지 않도록 폴더 화면의 하위 라우트로 둔다 */}
          <Route path="/folders/:folderId" element={<FolderPage />}>
            <Route path="meetings/new" element={<MeetingCreatePage />} />
          </Route>
          {/* REQ-119~121 회의록 양식 목록 */}
          <Route path="/templates" element={<TemplateListPage />} />
        </Route>
        {/* 첫 화면: 로그인하지 않았으면 넵넵 소개, 로그인했으면 홈으로 */}
        <Route
          path="/"
          element={
            <GuestOnly>
              <LandingPage />
            </GuestOnly>
          }
        />
        {/* 예전 설정 주소는 홈 위에 설정 창을 연다 (REQ-145) */}
        <Route
          path="/profile"
          element={<Navigate to={settingsPath('profile')} replace />}
        />
        <Route
          path="/settings"
          element={<Navigate to={settingsPath('display')} replace />}
        />
        <Route
          path="/help"
          element={<Navigate to={settingsPath('help')} replace />}
        />
        <Route
          path="/plan"
          element={<Navigate to={settingsPath('plan')} replace />}
        />
        {/* 로그인한 사람이 로그인, 회원가입 주소를 열면 홈으로 */}
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <SignupPage />
            </GuestOnly>
          }
        />
        <Route path="/signup/complete" element={<SignupCompletePage />} />
        <Route path="/password/find" element={<PasswordFindPage />} />
        <Route path="/password/verify" element={<PasswordVerifyPage />} />
        <Route path="/password/reset" element={<PasswordResetPage />} />
        <Route path="/password/complete" element={<PasswordCompletePage />} />
        {/* 회의 정보 수정 창은 회의 대기 화면 위에 띄운다. 뒤 화면을 다시 그리지 않도록 하위 라우트로 둔다 */}
        <Route
          path="/meetings/:meetingId"
          element={
            <RequireAuth>
              <MeetingWaitingPage />
            </RequireAuth>
          }
        >
          <Route path="edit" element={<MeetingCreatePage />} />
        </Route>
        <Route
          path="/meetings/:meetingId/room"
          element={
            <RequireAuth>
              <MeetingRoomPage />
            </RequireAuth>
          }
        />
        {/* REQ-131~137 회의록 작성, 보기 */}
        <Route
          path="/meetings/:meetingId/minutes"
          element={
            <RequireAuth>
              <MinutesEditorPage />
            </RequireAuth>
          }
        />
        {DevMinutesPage && (
          <Route
            path="/dev/minutes/:meetingId"
            element={
              <RequireAuth>
                <Suspense fallback={null}>
                  <DevMinutesPage />
                </Suspense>
              </RequireAuth>
            }
          />
        )}
        {/* REQ-119~121 회의록 양식. 새 양식은 ?from=양식ID 로 복사해서 시작할 수 있다 */}
        <Route
          path="/templates/new"
          element={
            <RequireAuth>
              <TemplateEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/templates/:templateId/edit"
          element={
            <RequireAuth>
              <TemplateEditorPage />
            </RequireAuth>
          }
        />
        {/* REQ-143 쓰레기통은 설정 창의 삭제 목록 */}
        <Route
          path="/workspaces/:workspaceId/trash"
          element={<Navigate to={settingsPath('trash')} replace />}
        />
        {/* REQ-127 초대 메일의 링크. 로그인하지 않았으면 로그인한 뒤 돌아온다 */}
        <Route
          path="/invitations/:token"
          element={
            <RequireAuth>
              <InvitationPage />
            </RequireAuth>
          }
        />
        {/* REQ-015 초대 링크. 로그인하지 않았으면 로그인한 뒤 돌아온다 */}
        <Route
          path="/invites/:token"
          element={
            <RequireAuth>
              <InviteLinkPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}
