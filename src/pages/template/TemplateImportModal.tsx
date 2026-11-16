import { useEffect, useRef, useState, type DragEvent } from 'react';
import errorIcon from '../../assets/icons/error.svg';
import fileIcon from '../../assets/icons/minutes-doc.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import styles from './TemplateImportModal.module.css';

const ICON_SIZE = 20;
const UPLOAD_ICON_SIZE = 24;
// 분석 중 화면을 잠깐 보여 준 뒤 결과로 넘어간다
const READING_MS = 1200;

type Step = 'upload' | 'reading' | 'failed';

interface TemplateImportModalProps {
  onClose: () => void;
}

/**
 * 디자인 Version02 TemplateImportModal (Upload → Reading → Failed): 회의록 PDF를 올려 양식으로 바꾼다.
 * 아직 백엔드에 PDF 분석 기능이 없어, 파일을 올리면 분석하지 못했다는 안내로 끝난다
 */
export default function TemplateImportModal({ onClose }: TemplateImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'reading') {
      return undefined;
    }
    const timer = window.setTimeout(() => setStep('failed'), READING_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  const pick = (picked: File | undefined) => {
    if (picked) {
      setFile(picked);
      setStep('upload');
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    pick(event.dataTransfer.files[0]);
  };

  return (
    <Dialog
      title="양식 가져오기"
      description="기존 회의록 PDF를 올리면 항목을 분석해 편집할 수 있는 양식으로 변환해 드려요."
      width="md"
      hideClose={step === 'reading'}
      onClose={step === 'reading' ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" size="md" disabled={step === 'reading'} onClick={onClose}>
            취소
          </Button>
          {step === 'failed' ? (
            <Button size="md" onClick={() => inputRef.current?.click()}>
              다른 파일 올리기
            </Button>
          ) : (
            <Button size="md" disabled={!file} isLoading={step === 'reading'} onClick={() => setStep('reading')}>
              {step === 'reading' ? '분석하는 중' : '가져오기'}
            </Button>
          )}
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {step === 'failed' && (
        <div className={styles.failed} role="alert">
          <Icon src={errorIcon} size={ICON_SIZE} className={styles.failedIcon} />
          <div>
            <p className={styles.failedTitle}>PDF를 분석하지 못했어요.</p>
            <p className={styles.failedText}>
              파일에 문제가 있거나 내용을 인식하기 어려울 수 있어요. 다른 PDF 파일을 선택해 주세요.
            </p>
          </div>
        </div>
      )}
      {step === 'reading' && (
        <div className={styles.reading} role="status">
          <Spinner size={UPLOAD_ICON_SIZE} />
          <p className={styles.dropTitle}>PDF를 분석하고 있어요</p>
          <p className={styles.dropText}>항목을 찾아 양식으로 바꾸는 중이에요. 잠시만 기다려 주세요.</p>
        </div>
      )}
      {step === 'upload' && (
        <div
          className={[styles.dropZone, isDragOver ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Icon src={uploadIcon} size={UPLOAD_ICON_SIZE} />
          <p className={styles.dropTitle}>PDF 파일을 여기에 끌어다 놓으세요</p>
          <p className={styles.dropText}>또는 파일을 직접 선택할 수 있어요.</p>
          <Button variant="secondary" size="md" className={styles.pickButton} onClick={() => inputRef.current?.click()}>
            파일 선택
          </Button>
        </div>
      )}
      {file && step !== 'reading' && (
        <p className={styles.file}>
          <Icon src={fileIcon} size={ICON_SIZE} />
          {file.name}
        </p>
      )}
    </Dialog>
  );
}
