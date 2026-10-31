// 참가자 아바타: 온보딩처럼 동그란 바탕 + 사람 실루엣. 방장('나')은 남색 그릇 모양.
export function Avatar({ index, host = false, size = 40, label }: { index: number; host?: boolean; size?: number; label?: string }) {
  const n = (index % 6) + 1;
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: `var(--avatar-${n}-bg)`, color: `var(--avatar-${n}-fg)` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {host ? (
          // 그릇 + 김(점심합의 마크 모양)
          <>
            <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z" />
            <path d="M9 3.5l1 3M12 2.5v3.5M15 3.5l-1 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="12" cy="8.5" r="4.2" />
            <path d="M4 20.5a8 8 0 0 1 16 0z" />
          </>
        )}
      </svg>
    </span>
  );
}

/** 겹쳐 놓은 아바타 묶음(투표 화면 "4명이 투표했어요"). */
export function AvatarStack({ indices, size = 26 }: { indices: { index: number; host: boolean }[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {indices.map((a) => (
        <Avatar key={a.index} index={a.index} host={a.host} size={size} />
      ))}
    </span>
  );
}
