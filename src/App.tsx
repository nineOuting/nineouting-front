import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
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
        {/* 회의 화면은 API 연동 전이라 로그인 없이 예시 데이터로 본다 (docs/backlog.md) */}
        <Route path="/meetings/new" element={<MeetingCreatePage />} />
        <Route path="/meetings/:meetingId" element={<MeetingWaitingPage />} />
        <Route path="/meetings/:meetingId/edit" element={<MeetingCreatePage />} />
        <Route path="/meetings/:meetingId/room" element={<MeetingRoomPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
