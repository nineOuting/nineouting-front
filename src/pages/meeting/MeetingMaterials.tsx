import { useEffect, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '../../api/client';
import {
  deleteMaterial,
  listMaterials,
  uploadMaterial,
  type MaterialSearchStatus,
  type MeetingMaterial,
} from '../../api/meeting';
import closeIcon from '../../assets/icons/close-sm.svg';
// 디자인 MaterialItem PdfIcon: 파일 형식과 상관없이 모든 자료에 같은 아이콘
import fileIcon from '../../assets/icons/pdf.svg';
import retryIcon from '../../assets/icons/refresh.svg';
// 디자인 06 UploadMaterialsModal UploadIcon: 위쪽 화살표 + 막대 (양식 올리기의 upload-file.svg와 다름)
import uploadIcon from '../../assets/icons/upload.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import styles from './MeetingMaterials.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
// 디자인 UploadIcon 32px (디자인 체크 2026-11-19)
const UPLOAD_ICON_SIZE = 32;
// REQ-067 50MB 이하 파일만 (MSG-067). 서버도 다시 확인한다
const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
const SEARCH_STATUS_POLL_MS = 5000;

/**
 * REQ-187 검색 상태 (MSG-078~080, 디자인 06 상태 모음 "사전 자료 AI 검색 상태").
 * 검색 가능, 준비 중은 크기 옆에 짧게, 안 되는 것은 크기 대신 이유를 문장으로 보여 준다
 */
const SEARCH_STATUS: Record<MaterialSearchStatus, { text: string; isWarning?: boolean }> = {
  PREPARING: { text: '검색 준비 중…' },
  READY: { text: '검색 가능' },
  // MSG-078
  UNREADABLE: { text: '읽을 수 없는 파일이에요. 파일 형식을 확인해 주세요.', isWarning: true },
  // MSG-079
  TOO_LARGE: { text: '내용이 약 100쪽을 넘어 AI 검색에서 빠졌어요.', isWarning: true },
  // MSG-080
  FAILED: { text: 'AI 검색 준비에 실패했어요. 파일을 지우고 다시 올려 주세요.', isWarning: true },
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 올리기 창의 파일 하나 (디자인 "올리는 중", "올리기 실패") */
interface Upload {
  key: number;
  file: File;
  state: 'uploading' | 'done' | 'failed';
  loaded: number;
  error?: string;
  /** 크기 초과처럼 다시 해도 안 되는 실패는 다시 시도 버튼을 숨긴다 */
  canRetry?: boolean;
  material?: MeetingMaterial;
}

interface MeetingMaterialsProps {
  meetingId: number;
  /** 참석자만 올린다. 지우기는 서버가 올린 사람, 회의를 만든 사람인지 확인한다 */
  canUpload: boolean;
  /** 디자인 MeetingWaiting_UploadMaterials: 머리말 [올리기]로 여는 창 */
  isUploadOpen: boolean;
  onUploadClose: () => void;
  /** 머리말 "사전 자료 N"에 쓸 개수 */
  onCountChange?: (count: number) => void;
  /** [완료]로 창을 닫은 뒤 알림 (되돌리기를 누르면 방금 올린 자료를 지운다) */
  onUploaded?: (count: number, undo: () => void) => void;
}

let nextUploadKey = 1;

/**
 * REQ-067 회의 사전 자료: 파일은 저장소(S3)에 바로 올리고, 누르면 원래 이름으로 내려받는다.
 * 올리기 창은 파일을 고르면 바로 올리고 파일마다 진행률, 완료, 실패를 보여 준다 (디자인 06 상태 모음)
 */
export default function MeetingMaterials({
  meetingId,
  canUpload,
  isUploadOpen,
  onUploadClose,
  onCountChange,
  onUploaded,
}: MeetingMaterialsProps) {
  const [materials, setMaterials] = useState<MeetingMaterial[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCurrent = true;
    listMaterials(meetingId)
      .then((items) => isCurrent && setMaterials(items))
      .catch((caught: unknown) => {
        if (isCurrent) {
          setMaterials([]);
          setError(errorMessage(caught));
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [meetingId]);

  useEffect(() => {
    onCountChange?.(materials?.length ?? 0);
  }, [materials, onCountChange]);

  // REQ-187 검색 준비 중인 자료가 있으면 상태가 정해질 때까지 가끔 다시 본다
  const isPreparing = materials?.some(({ searchStatus }) => searchStatus === 'PREPARING') ?? false;
  useEffect(() => {
    if (!isPreparing) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      listMaterials(meetingId)
        .then(setMaterials)
        .catch(() => undefined);
    }, SEARCH_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [meetingId, isPreparing]);

  const isUploading = uploads.some(({ state }) => state === 'uploading');
  const doneUploads = uploads.filter(({ state }) => state === 'done');

  const updateUpload = (key: number, patch: Partial<Upload>) =>
    setUploads((prev) => prev.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)));

  const startUpload = (key: number, file: File) => {
    updateUpload(key, { state: 'uploading', loaded: 0, error: undefined });
    uploadMaterial(meetingId, file, (loaded) => updateUpload(key, { loaded }))
      .then((material) => {
        updateUpload(key, { state: 'done', loaded: file.size, material });
        setMaterials((prev) => [...(prev ?? []), material]);
      })
      .catch((caught: unknown) => updateUpload(key, { state: 'failed', error: errorMessage(caught), canRetry: true }));
  };

  const addFiles = (files: File[]) => {
    const added = files.map((file): Upload => ({ key: nextUploadKey++, file, state: 'uploading', loaded: 0 }));
    // MSG-067 50MB가 넘으면 그 파일 줄에 알리고 올리지 않는다
    const tooLarge = added.filter(({ file }) => file.size > MAX_MATERIAL_BYTES);
    tooLarge.forEach((upload) => Object.assign(upload, { state: 'failed', error: '50MB를 넘어 올리지 못했어요', canRetry: false }));
    setUploads((prev) => [...prev, ...added]);
    added.filter((upload) => upload.state === 'uploading').forEach(({ key, file }) => startUpload(key, file));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const remove = async (material: MeetingMaterial) => {
    try {
      await deleteMaterial(meetingId, material.materialId);
      setMaterials((prev) => prev && prev.filter(({ materialId }) => materialId !== material.materialId));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  /** 창의 파일 줄 빼기. 이미 올린 파일이면 지운다 */
  const removeUpload = (upload: Upload) => {
    setUploads((prev) => prev.filter(({ key }) => key !== upload.key));
    if (upload.material) {
      void remove(upload.material);
    }
  };

  const closeUpload = () => {
    setUploads([]);
    onUploadClose();
  };

  /** [취소]: 이 창에서 올린 파일을 지우고 닫는다 */
  const cancelUpload = () => {
    doneUploads.forEach(({ material }) => material && void remove(material));
    closeUpload();
  };

  /** [완료]: 올린 파일을 남기고 닫는다 (MSG-119 토스트, [되돌리기]로 지운다) */
  const finishUpload = () => {
    const saved = doneUploads.flatMap(({ material }) => (material ? [material] : []));
    closeUpload();
    if (saved.length > 0) {
      onUploaded?.(saved.length, () => saved.forEach((material) => void remove(material)));
    }
  };

  return (
    <>
      {materials && materials.length > 0 ? (
        <ul className={styles.list}>
          {materials.map((material) => {
            const status = material.searchStatus ? SEARCH_STATUS[material.searchStatus] : undefined;
            return (
              <li key={material.materialId} className={styles.item}>
                <Icon
                  src={fileIcon}
                  size={ICON_SIZE}
                  className={styles.fileIcon}
                />
                <a className={styles.texts} href={material.downloadUrl} aria-label={`${material.fileName} 내려받기`}>
                  <span className={styles.name}>{material.fileName}</span>
                  {status?.isWarning ? (
                    <span className={styles.warning}>{status.text}</span>
                  ) : (
                    <span className={styles.meta}>
                      {formatSize(material.size)}
                      {status && ` · ${status.text}`}
                    </span>
                  )}
                </a>
                {canUpload && (
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`${material.fileName} 삭제`}
                    onClick={() => void remove(material)}
                  >
                    <Icon src={closeIcon} size={ICON_SIZE} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>{materials ? '아직 올린 자료가 없어요' : '자료를 불러오는 중이에요'}</p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isUploadOpen && (
        <Dialog
          title="사전 자료 올리기"
          description="회의 전에 함께 볼 자료를 올려 주세요. 참여자 모두 볼 수 있어요"
          width="md"
          hideClose={isUploading}
          onClose={isUploading ? () => undefined : cancelUpload}
          footer={
            <>
              <Button variant="secondary" size="md" disabled={isUploading} onClick={cancelUpload}>
                취소
              </Button>
              <Button size="md" disabled={isUploading || doneUploads.length === 0} onClick={finishUpload}>
                완료
              </Button>
            </>
          }
        >
          {uploads.length > 0 && (
            <ul className={styles.uploadList}>
              {uploads.map((upload) => {
                const percent = Math.round((upload.loaded / Math.max(1, upload.file.size)) * 100);
                return (
                  <li key={upload.key} className={styles.uploadItem}>
                    <Icon
                      src={fileIcon}
                      size={ICON_SIZE}
                      className={styles.fileIcon}
                    />
                    <div className={styles.texts}>
                      <span className={styles.name}>{upload.file.name}</span>
                      {upload.state === 'uploading' && (
                        <>
                          <span className={styles.meta}>
                            {formatSize(upload.file.size)} 중 {formatSize(upload.loaded)} · {percent}%
                          </span>
                          <span className={styles.progress} aria-hidden="true">
                            <span className={styles.progressBar} style={{ width: `${percent}%` }} />
                          </span>
                        </>
                      )}
                      {upload.state === 'done' && <span className={styles.meta}>{formatSize(upload.file.size)} · 업로드 완료</span>}
                      {upload.state === 'failed' && (
                        <span className={styles.uploadError} role="alert">
                          {upload.error}
                        </span>
                      )}
                    </div>
                    {upload.state === 'failed' && upload.canRetry && (
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`${upload.file.name} 다시 올리기`}
                        onClick={() => startUpload(upload.key, upload.file)}
                      >
                        <Icon src={retryIcon} size={SMALL_ICON_SIZE} />
                      </button>
                    )}
                    {upload.state !== 'uploading' && (
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`${upload.file.name} 빼기`}
                        onClick={() => removeUpload(upload)}
                      >
                        <Icon src={closeIcon} size={SMALL_ICON_SIZE} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div
            className={[styles.dropZone, isDragOver ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Icon src={uploadIcon} size={UPLOAD_ICON_SIZE} className={styles.dropIcon} />
            <p className={styles.dropTitle}>파일을 여기에 끌어다 놓으세요</p>
            <p className={styles.dropText}>또는 파일을 직접 선택할 수 있어요.</p>
            <Button
              variant="secondary"
              size="md"
              className={styles.pickButton}
              disabled={!canUpload}
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
          </div>
          <p className={styles.formats}>PDF · Word · Excel · 텍스트(txt·md·csv) | 파일당 50MB · 약 100쪽 · 최대 5개</p>
        </Dialog>
      )}
    </>
  );
}
