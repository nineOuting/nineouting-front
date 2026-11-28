import { useState } from 'react';
import { FALLBACK_AVATAR_URL, profileImageSrc } from '../api/user';

interface AvatarProps {
  /** 서버가 준 profileImageUrl. 없으면 기본 캐릭터 01 */
  url?: string | null;
  /** 각 화면의 사진 자리 클래스 (크기, 테두리) */
  className?: string;
  /** width, height 속성이 필요한 곳만 */
  size?: number;
  /** 이름을 읽어 줘야 하는 곳만 (기본은 꾸밈 그림) */
  alt?: string;
}

/** 계정 사진. 사진이 없거나 불러오지 못하면(만료된 저장소 주소 등) 기본 캐릭터 01을 보여 준다 */
export default function Avatar({ url, className, size, alt = '' }: AvatarProps) {
  const src = profileImageSrc(url ?? undefined);
  const [failedSrc, setFailedSrc] = useState<string>();
  const shown = failedSrc === src ? FALLBACK_AVATAR_URL : src;

  return (
    <img
      src={shown}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => shown !== FALLBACK_AVATAR_URL && setFailedSrc(src)}
    />
  );
}
