// 음식 종류 썸네일. 온보딩 시안의 음식 사진 자리를 자체 그림으로 대신한다
// (식당 사진·메뉴판 이미지는 쓰지 않는다 — 프롬프트 §7-3). 실제 메뉴를 뜻하지 않는 '종류' 표시일 뿐이다.

type Kind = 'bowl' | 'noodle' | 'fish' | 'meat' | 'western' | 'snack' | 'cup' | 'plate';

const KIND_BY_TAG: Record<string, { kind: Kind; bg: string }> = {
  korean: { kind: 'bowl', bg: 'var(--thumb-warm)' },
  soup: { kind: 'bowl', bg: 'var(--thumb-red)' },
  noodle: { kind: 'noodle', bg: 'var(--thumb-yellow)' },
  chinese: { kind: 'noodle', bg: 'var(--thumb-red)' },
  japanese: { kind: 'fish', bg: 'var(--thumb-blue)' },
  seafood: { kind: 'fish', bg: 'var(--thumb-blue)' },
  meat: { kind: 'meat', bg: 'var(--thumb-red)' },
  western: { kind: 'western', bg: 'var(--thumb-green)' },
  snack: { kind: 'snack', bg: 'var(--thumb-yellow)' },
  fastfood: { kind: 'western', bg: 'var(--thumb-yellow)' },
  asian: { kind: 'noodle', bg: 'var(--thumb-green)' },
  cafe: { kind: 'cup', bg: 'var(--thumb-warm)' },
};

function Art({ kind }: { kind: Kind }) {
  const ink = 'var(--color-ink)';
  const y = 'var(--color-yellow)';
  switch (kind) {
    case 'bowl':
      return (
        <>
          <path d="M8 26h32a16 16 0 0 1-32 0z" fill={ink} />
          <path d="M18 12l2 6M24 10v7M30 12l-2 6" stroke={y} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'noodle':
      return (
        <>
          <path d="M8 26h32a16 16 0 0 1-32 0z" fill={ink} />
          <path d="M17 26c0-6 4-6 4-12M23 26c0-6 4-6 4-12M29 26c0-6 4-6 4-12" stroke={y} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M30 6l8 14M34 5l7 13" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case 'fish':
      return (
        <>
          <path d="M8 24c6-9 18-11 26-3l6-5v16l-6-5c-8 8-20 6-26-3z" fill={ink} />
          <circle cx="16" cy="22.5" r="2" fill={y} />
        </>
      );
    case 'meat':
      return (
        <>
          <rect x="8" y="30" width="32" height="5" rx="2.5" fill={ink} />
          <path d="M12 26c2-8 8-12 14-10s9 6 10 10z" fill={ink} />
          <path d="M18 14l1-4M24 13v-4M30 14l-1-4" stroke={y} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'western':
      return (
        <>
          <circle cx="24" cy="26" r="13" fill={ink} />
          <circle cx="24" cy="26" r="7" fill={y} />
          <path d="M6 14v10M9 14v10M6 19h3M7.5 24v12M42 14c-3 3-3 8 0 10v12" stroke={ink} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      );
    case 'snack':
      return (
        <>
          <rect x="9" y="17" width="30" height="16" rx="8" fill={ink} />
          <circle cx="17" cy="25" r="3" fill={y} />
          <circle cx="24" cy="25" r="3" fill={y} />
          <circle cx="31" cy="25" r="3" fill={y} />
        </>
      );
    case 'cup':
      return (
        <>
          <path d="M12 18h20v10a10 10 0 0 1-20 0z" fill={ink} />
          <path d="M32 21h3a4 4 0 0 1 0 8h-3" stroke={ink} strokeWidth="2.6" fill="none" />
          <path d="M18 8c-2 3 2 4 0 7M24 8c-2 3 2 4 0 7" stroke={y} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      );
    default:
      return (
        <>
          <circle cx="24" cy="25" r="13" fill={ink} />
          <path d="M20 18v6a2 2 0 0 0 4 0v-6M22 24v9M28 18c-2 2-2 6 0 7v8" stroke={y} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      );
  }
}

export function FoodThumb({ tags, size = 56, wide = false }: { tags: readonly string[]; size?: number; wide?: boolean }) {
  const meta = KIND_BY_TAG[tags[0] ?? ''] ?? { kind: 'plate' as Kind, bg: 'var(--thumb-gray)' };
  return (
    <span className={wide ? 'food-thumb food-thumb--wide' : 'food-thumb'} style={wide ? { background: meta.bg } : { width: size, height: size, background: meta.bg }} aria-hidden="true">
      <svg width={wide ? 120 : size * 0.78} height={wide ? 120 : size * 0.78} viewBox="0 0 48 48">
        <Art kind={meta.kind} />
      </svg>
    </span>
  );
}
