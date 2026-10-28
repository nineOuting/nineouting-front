import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import {
  deleteWorkspaceProfileImage,
  getWorkspaceProfile,
  PROFILE_IMAGE_TYPES,
  updateWorkspaceProfile,
  uploadWorkspaceProfileImage,
  type WorkspaceProfile,
} from '../../api/user';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import { NAME_MAX_LENGTH } from '../../constants/auth';
import styles from './WorkspaceProfileModal.module.css';

const CLOSE_ICON_SIZE = 24;
const AVATAR_SIZE = 64;
// user-service UpdateWorkspaceProfileRequest 길이 제한과 같다
const AFFILIATION_MAX_LENGTH = 100;
const IMAGE_TYPE_MESSAGE = 'JPG, PNG, WEBP 사진만 올릴 수 있어요.';

interface WorkspaceProfileModalProps {
  workspaceId: number;
  onSaved: (text: string) => void;
  onClose: () => void;
}

/**
 * REQ-114·115·118 이 워크스페이스에서 보이는 내 프로필 (2026-10-28 결정: 워크스페이스마다 따로 정할 수 있다).
 * 디자인이 없어 새 폴더 창 모양을 따랐다 (docs/backlog.md)
 */
export default function WorkspaceProfileModal({ workspaceId, onSaved, onClose }: WorkspaceProfileModalProps) {
  const titleId = useId();
  const nameId = useId();
  const affiliationId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  const apply = (next: WorkspaceProfile) => {
    setProfile(next);
    setName(next.name);
    setAffiliation(next.affiliation);
  };

  useEffect(() => {
    let isCurrent = true;
    getWorkspaceProfile(workspaceId)
      .then((loaded) => isCurrent && apply(loaded))
      .catch((loadError: unknown) => isCurrent && setError(errorMessage(loadError)));
    return () => {
      isCurrent = false;
    };
  }, [workspaceId]);

  const runBusy = async (action: () => Promise<WorkspaceProfile>) => {
    setIsBusy(true);
    setError(undefined);
    try {
      apply(await action());
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError));
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const changeImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setError(IMAGE_TYPE_MESSAGE);
      return;
    }
    await runBusy(() => uploadWorkspaceProfileImage(workspaceId, file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || isBusy) {
      return;
    }
    // 바꾼 칸만 보낸다. 같은 값을 보내면 계정 프로필을 따르던 칸이 이 워크스페이스 값으로 굳는다
    const changes: { name?: string; affiliation?: string } = {};
    if (name.trim() !== profile.name) {
      changes.name = name.trim();
    }
    if (affiliation.trim() !== profile.affiliation) {
      changes.affiliation = affiliation.trim();
    }
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    if (await runBusy(() => updateWorkspaceProfile(workspaceId, changes))) {
      onSaved('이 워크스페이스의 프로필을 저장했어요.');
    }
  };

  return (
    <Modal labelledBy={titleId} onClose={onClose} closeOnDimClick className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.head}>
          <div className={styles.texts}>
            <h2 id={titleId} className={styles.title}>
              이 워크스페이스에서 내 프로필
            </h2>
            <p className={styles.description}>
              회의 참석자 등에 보이는 이름·소속·사진을 이 워크스페이스에서만 바꿀 수 있어요. 칸을 비우면 계정 프로필
              값으로 돌아가요.
            </p>
          </div>
          <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onClose}>
            <Placeholder size={CLOSE_ICON_SIZE} />
          </button>
        </div>

        {profile && (
          <>
            <div className={styles.photoRow}>
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt=""
                  width={AVATAR_SIZE}
                  height={AVATAR_SIZE}
                  className={styles.avatar}
                />
              ) : (
                <span className={styles.avatar} aria-hidden="true" />
              )}
              <input
                ref={fileRef}
                type="file"
                accept={PROFILE_IMAGE_TYPES.join(',')}
                className={styles.fileInput}
                onChange={changeImage}
              />
              <button
                type="button"
                className={styles.secondary}
                disabled={isBusy}
                onClick={() => fileRef.current?.click()}
              >
                사진 바꾸기
              </button>
              {profile.customProfileImage && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={isBusy}
                  onClick={() => runBusy(() => deleteWorkspaceProfileImage(workspaceId))}
                >
                  계정 사진으로
                </button>
              )}
            </div>
            <div className={styles.field}>
              <label htmlFor={nameId} className={styles.label}>
                이름 {!profile.customName && <span className={styles.hint}>(계정 프로필 값)</span>}
              </label>
              <input
                id={nameId}
                className={styles.input}
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={affiliationId} className={styles.label}>
                소속 {!profile.customAffiliation && <span className={styles.hint}>(계정 프로필 값)</span>}
              </label>
              <input
                id={affiliationId}
                className={styles.input}
                placeholder="예: 디자인팀"
                maxLength={AFFILIATION_MAX_LENGTH}
                value={affiliation}
                onChange={(event) => setAffiliation(event.target.value)}
              />
            </div>
          </>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={!profile || isBusy}>
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
