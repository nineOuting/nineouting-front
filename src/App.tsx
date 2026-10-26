import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import FolderPage from './pages/folder/FolderPage';
import HomePage from './pages/HomePage';
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
import WorkspacePage from './pages/workspace/WorkspacePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/complete" element={<SignupCompletePage />} />
        <Route path="/password/find" element={<PasswordFindPage />} />
        <Route path="/password/verify" element={<PasswordVerifyPage />} />
        <Route path="/password/reset" element={<PasswordResetPage />} />
        <Route path="/password/complete" element={<PasswordCompletePage />} />
        {/* 회의는 프로젝트 폴더 안에서 만든다. 폴더 화면이 생기면 거기서 이 주소로 들어온다 */}
        <Route
          path="/folders/:folderId/meetings/new"
          element={
            <RequireAuth>
              <MeetingCreatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/meetings/:meetingId"
          element={
            <RequireAuth>
              <MeetingWaitingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/meetings/:meetingId/edit"
          element={
            <RequireAuth>
              <MeetingCreatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/meetings/:meetingId/room"
          element={
            <RequireAuth>
              <MeetingRoomPage />
            </RequireAuth>
          }
        />
        {/* 워크스페이스·폴더 화면은 API 연동 전이라 로그인 없이 예시 데이터로 본다 (docs/backlog.md) */}
        <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        <Route path="/folders/:folderId" element={<FolderPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
