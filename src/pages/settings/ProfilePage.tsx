import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { errorMessage } from '../../api/client';
import {
  deleteMyProfileImage,
  getMyProfile,
  PROFILE_IMAGE_TYPES,
  updateMyProfile,
  uploadMyProfileImage,
  type MyProfile,
} from '../../api/user';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import { NAME_MAX_LENGTH } from '../../constants/auth';
import ChangePasswordModal from './ChangePasswordModal';
import layout from './SettingsLayout.module.css';
import SettingsLayout from './SettingsLayout';
import styles from './ProfilePage.module.css';

const AVATAR_SIZE = 64;
// user-service UpdateProfileRequest 길이 제한과 같다
const AFFILIATION_MAX_LENGTH = 100;
const IMAGE_TYPE_MESSAGE = 'JPG, PNG, WEBP 사진만 올릴 수 있어요.';

/** REQ-114~118 내 계정 프로필 (디자인 ProfilePage): 사진, 이름, 소속, 비밀번호 변경, 로그아웃 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<MyProfile>();
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const apply = (next: MyProfile) => {
    setProfile(next);
    setName(next.name);
    setAffiliation(next.affiliation);
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

  const changeImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !profile) {
      return;
    }
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setToast({ text: IMAGE_TYPE_MESSAGE, variant: 'error' });
      return;
    }
    await run(async () => {
      const profileImageUrl = await uploadMyProfileImage(file);
      setProfile({ ...profile, profileImageUrl });
    }, '프로필 사진을 바꿨어요');
  };

  const removeImage = () =>
    run(async () => {
      await deleteMyProfileImage();
      setProfile((prev) => prev && { ...prev, profileImageUrl: undefined });
    }, '프로필 사진을 지웠어요');

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || isBusy) {
      return;
    }
    void run(async () => apply(await updateMyProfile({ name: name.trim(), affiliation: affiliation.trim() })), '프로필을 저장했어요');
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
              {profile.profileImageUrl ? (
                <img src={profile.profileImageUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} className={styles.avatar} />
              ) : (
                <span className={styles.avatar} aria-hidden="true" />
              )}
              <div className={styles.avatarText}>
                <p className={styles.label}>프로필 사진</p>
                <div className={styles.inline}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={PROFILE_IMAGE_TYPES.join(',')}
                    className={styles.fileInput}
                    onChange={changeImage}
                  />
                  <button type="button" className={styles.smallButton} disabled={isBusy} onClick={() => fileRef.current?.click()}>
                    사진 바꾸기
                  </button>
                  {profile.profileImageUrl && (
                    <Button variant="text" disabled={isBusy} onClick={removeImage}>
                      사진 지우기
                    </Button>
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
              <TextField
                label="소속"
                placeholder="예: 디자인팀"
                maxLength={AFFILIATION_MAX_LENGTH}
                value={affiliation}
                onChange={(event) => setAffiliation(event.target.value)}
              />
              <TextField label="이메일" value={profile.email} disabled helper="이메일은 바꿀 수 없어요" />
            </div>
            <div className={styles.footer}>
              <Button isLoading={isBusy} type="submit" size="md" disabled={isBusy || !name.trim()}>
                저장
              </Button>
            </div>
          </form>
          <div className={layout.card}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <p className={layout.cardTitle}>비밀번호</p>
                <p className={styles.caption}>로그인할 때 쓰는 비밀번호를 바꿔요</p>
              </div>
              <button type="button" className={styles.smallButton} onClick={() => setIsPasswordOpen(true)}>
                비밀번호 변경
              </button>
            </div>
            <div className={styles.divider} />
            <div className={styles.row}>
              <Button variant="text" onClick={signOut}>
                로그아웃
              </Button>
            </div>
          </div>
        </>
      )}
      {isPasswordOpen && (
        <ChangePasswordModal
          onDone={() => {
            setIsPasswordOpen(false);
            setToast({ text: '비밀번호를 바꿨어요', variant: 'success' });
          }}
          onClose={() => setIsPasswordOpen(false)}
        />
      )}
    </SettingsLayout>
  );
}
