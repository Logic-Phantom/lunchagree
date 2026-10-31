// 방 화면 공통 훅: 방 불러오기, 공유 방은 5초 폴링(Realtime 대신 — D-012), 최근 방 갱신, 추천 계산.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isExpired } from '@jeomsimhabui/room-core';
import { errorMessage, localRepo, remoteConfigured, remoteRepo, type RoomRepo, type RoomView } from '../../data/room-repo';
import { recommend, type LatLng, type RecommendResult } from '../../domain';
import { touchRecentRoom } from '../../storage/records';

const POLL_MS = 5000;

async function loadAny(roomId: string): Promise<{ view: RoomView; repo: RoomRepo } | null> {
  const local = await localRepo.load(roomId);
  if (local) return { view: local, repo: localRepo };
  if (!remoteConfigured()) return null;
  const remote = await remoteRepo.load(roomId);
  return remote ? { view: remote, repo: remoteRepo } : null;
}

export function useRoom(roomId: string | undefined) {
  const [view, setView] = useState<RoomView | null>(null);
  const [repo, setRepo] = useState<RoomRepo>(localRepo);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!roomId) return;
    try {
      const r = await loadAny(roomId);
      if (!r) {
        setError('방을 찾을 수 없어요. 마감됐거나 이 기기에서 만든 방이 아니에요.');
        return;
      }
      setView(r.view);
      setRepo(r.repo);
      setError(null);
      void touchRecentRoom({
        roomId,
        title: r.view.room.title,
        mode: r.view.mode,
        participantCount: r.view.participants.length,
        updatedAt: new Date().toISOString(),
        expiresAt: r.view.room.expiresAt,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 공유 방만 폴링(다른 사람의 입력·투표 반영). 화면이 가려지면 멈춘다.
  useEffect(() => {
    if (view?.mode !== 'remote') return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [view?.mode, reload]);

  const expired = view ? isExpired(view.room.expiresAt) : false;
  const isHost = view ? view.meId === view.room.hostParticipantId : false;
  return { view, repo, error, loading, reload, expired, isHost };
}

/** origin = 이 기기의 현재 위치(useMyLocation). 위치를 모르면 거리 미확인으로 계산한다. */
export function useRecommendation(view: RoomView | null, origin: LatLng | null = null): RecommendResult | null {
  return useMemo(() => (view ? recommend(view.candidates, view.group, origin) : null), [view, origin]);
}

/** 참가자 순서 = 아바타 색 순서. */
export function participantIndex(view: RoomView, participantId: string): number {
  return Math.max(0, view.participants.findIndex((p) => p.id === participantId));
}
