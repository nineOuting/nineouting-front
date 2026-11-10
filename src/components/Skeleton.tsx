import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

/** 디자인 HomeLoadingPage, ArchiveLoadingPage의 회색 자리 (불러오는 중) */
export default function Skeleton({ width = '100%', height = 16, className }: SkeletonProps) {
  return <span className={[styles.skeleton, className].filter(Boolean).join(' ')} style={{ width, height }} aria-hidden="true" />;
}
