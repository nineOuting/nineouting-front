import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { errorMessage } from '../../api/client';
import {
  DEFAULT_AVATARS,
  deleteMyProfileImage,
  getMyProfile,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_TYPES,
  profileImageSrc,
  registerMyProfileImage,
  updateMyProfile,
  uploadProfileImageFile,
  type MyProfile,
} from '../../api/user';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import { NAME_MAX_LENGTH } from '../../constants/auth';
import ChangePasswordModal from './ChangePasswordModal';
import ProfilePhotoPicker from './ProfilePhotoPicker';
import WithdrawModal from './WithdrawModal';
import layout from './SettingsLayout.module.css';
import SettingsLayout from './SettingsLayout';
import styles from './ProfilePage.module.css';

const AVATAR_SIZE = 64;
/** MSG-126 JPG·PNG가 아니거나 5MB를 넘거나 올리기에 실패하면 */
const PHOTO_FAILED_MESSAGE = '사진을 올리지 못했어요. JPG·PNG 파일을 5MB까지 올릴 수 있어요.';

/**
 * [저장] 전까지 고른 사진. keep: 바꾸지 않음, set: 기본 캐릭터나 올린 사진의 키, remove: [사진 삭제]
 */
type PhotoDraft = { kind: 'keep' } | { kind: 'set'; key: string; url: string } | { kind: 'remove' };

/** 2026-10-02T09:00:00 → 2026.10.02 */
function formatDate(dateTime: string) {
  return dateTime.slice(0, 10).replaceAll('-', '.');
}

/**
 * REQ-114~116 프로필 (디자인 11 Profile_Modal, 설정 창 안): 사진, 이름, 비밀번호 변경, 로그아웃. 모든 워크스페이스에 공통.
 * 사진은 고르거나 올려도 바로 저장하지 않고 미리 보여 주다가 [저장]을 누르면 저장한다 (디자인 11 상태 모음 프로필 사진)
 */

export default function ProfilePage() {
  const navigate = useNavigate();
  const photoButtonsRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<MyProfile>();
  const [photo, setPhoto] = useState<PhotoDraft>({ kind: 'keep' });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const apply = (next: MyProfile) => {
    setProfile(next);
    setName(next.name);
    setPhoto({ kind: 'keep' });
  };

  useEffect(() => {
    let isCurrent = true;
    getMyProfile()
      .then((loaded) => isCurrent && apply(loaded))
      .catch((error: unknown) => isCurrent && setToast({ text: errorMessage(error), variant: 'error' }));
    return () => {
      isCurrent = false;
    };
  }, []);

  const run = async (action: () => Promise<void>, success: string) => {
    setIsBusy(true);
    try {
      await action();
      setToast({ text: success, variant: 'success' });
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    } finally {
      setIsBusy(false);
    }
  };

  // 원 안에 보이는 사진: 고른 사진 > 저장된 사진 > 기본 캐릭터 01
  const shownUrl =
    photo.kind === 'set' ? photo.url : photo.kind === 'remove' ? undefined : profile?.profileImageUrl;
  const avatarUrl = profileImageSrc(shownUrl);
  const selectedDefaultKey = DEFAULT_AVATARS.find(({ url }) => url === avatarUrl)?.key;

  const selectDefault = (key: string, url: string) => {
    setPhoto({ kind: 'set', key, url });
    setPhotoError(undefined);
    setIsPickerOpen(false);
  };

  // 올리는 동안 팝오버를 닫고 사진 자리에 로딩, 실패하면 팝오버를 다시 열어 안내 (MSG-126)
  const uploadFile = async (file: File) => {
    if (!PROFILE_IMAGE_TYPES.includes(file.type) || file.size > PROFILE_IMAGE_MAX_BYTES) {
      setPhotoError(PHOTO_FAILED_MESSAGE);
      return;
    }
    setPhotoError(undefined);
    setIsPickerOpen(false);
    setIsUploading(true);
    try {
      const key = await uploadProfileImageFile(file);
      setPhoto({ kind: 'set', key, url: URL.createObjectURL(file) });
    } catch {
      setPhotoError(PHOTO_FAILED_MESSAGE);
      setIsPickerOpen(true);
    } finally {
      setIsUploading(false);
    }
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setPhotoError(undefined);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || isBusy || isUploading) {
      return;
    }
    void run(async () => {
      if (photo.kind === 'set') {
        await registerMyProfileImage(photo.key);
      } else if (photo.kind === 'remove' && profile.profileImageUrl) {
        await deleteMyProfileImage();
      }
      apply(await updateMyProfile({ name: name.trim() }));
    }, '프로필을 저장했어요');
  };

  const reloadProfile = () => {
    getMyProfile()
      .then((loaded) => setProfile((prev) => prev && { ...prev, passwordChangedAt: loaded.passwordChangedAt }))
      .catch(() => undefined);
  };

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <SettingsLayout title="프로필" description="다른 멤버에게 보이는 내 정보예요">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {profile && (
        <>
          <form className={`${layout.card} ${styles.profileCard}`} onSubmit={save} noValidate>
            <div className={styles.avatarRow}>
              {isUploading ? (
                <span className={`${styles.avatar} ${styles.avatarLoading}`} role="status" aria-label="사진 올리는 중">
                  <Spinner size={24} />
                </span>
              ) : (
                <img src={avatarUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} className={styles.avatar} />
              )}
              <div className={styles.avatarText}>
                <p className={styles.label}>프로필 사진</p>
                <div ref={photoButtonsRef} className={styles.photoButtons}>
                  <button
                    type="button"
                    className={styles.photoButton}
                    disabled={isBusy || isUploading}
                    aria-expanded={isPickerOpen}
                    onClick={() => (isPickerOpen ? closePicker() : setIsPickerOpen(true))}
                  >
                    사진 바꾸기
                  </button>
                  <button
                    type="button"
                    className={styles.photoButton}
                    disabled={isBusy || isUploading}
                    onClick={() => {
                      closePicker();
                      setPhoto({ kind: 'remove' });
                    }}
                  >
                    사진 삭제
                  </button>
                  {isPickerOpen && (
                    <ProfilePhotoPicker
                      anchorRef={photoButtonsRef}
                      selectedKey={selectedDefaultKey}
                      error={photoError}
                      onSelectDefault={selectDefault}
                      onSelectFile={(file) => void uploadFile(file)}
                      onClose={closePicker}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className={styles.form}>
              <TextField
                label="이름"
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField label="이메일" value={profile.email} disabled helper="이메일은 바꿀 수 없어요" />
            </div>
            <div className={styles.footer}>
              <Button isLoading={isBusy} type="submit" size="md" disabled={isBusy || isUploading || !name.trim()}>
                저장
              </Button>
            </div>
          </form>
          <div className={layout.card}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <p className={layout.cardTitle}>비밀번호</p>
                <p className={styles.caption}>
                  {profile.passwordChangedAt
                    ? `마지막 변경 ${formatDate(profile.passwordChangedAt)}`
                    : '로그인할 때 쓰는 비밀번호를 바꿔요'}
                </p>
              </div>
              <button type="button" className={styles.smallButton} onClick={() => setIsPasswordOpen(true)}>
                비밀번호 변경
              </button>
            </div>
          </div>
          <div className={layout.card}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <p className={layout.cardTitle}>로그아웃</p>
                <p className={styles.caption}>이 기기에서 로그아웃해요</p>
              </div>
              <button type="button" className={styles.smallButton} onClick={signOut}>
                로그아웃
              </button>
            </div>
            {/* REQ-207 회원 탈퇴 (디자인 AccountCard WithdrawRow) */}
            <div className={`${styles.row} ${styles.withdrawRow}`}>
              <div className={styles.rowText}>
                <p className={layout.cardTitle}>회원 탈퇴</p>
                <p className={styles.caption}>계정과 내가 만든 회의록이 모두 삭제돼요</p>
              </div>
              <button type="button" className={styles.withdrawButton} onClick={() => setIsWithdrawOpen(true)}>
                탈퇴하기
              </button>
            </div>
          </div>
        </>
      )}
      {isWithdrawOpen && (
        <WithdrawModal
          onDone={() => {
            // 계정이 지워졌으니 이 기기의 로그인도 정리하고 로그인 화면으로 (로그아웃 요청이 실패해도 간다)
            void logout()
              .catch(() => undefined)
              .finally(() => navigate('/login', { replace: true }));
          }}
          onClose={() => setIsWithdrawOpen(false)}
        />
      )}
      {isPasswordOpen && (
        <ChangePasswordModal
          onDone={() => {
            setIsPasswordOpen(false);
            setToast({ text: '비밀번호를 바꿨어요', variant: 'success' });
            reloadProfile(); // MSG-108 마지막 변경 날짜 갱신
          }}
          onClose={() => setIsPasswordOpen(false)}
        />
      )}
    </SettingsLayout>
  );
}
