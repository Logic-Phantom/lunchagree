// 결과 화면 하단 배너 1개 자리(Phase 4). 투표 화면에는 광고를 두지 않는다.
// WebView 배너 API·테스트 광고 ID는 앱인토스 문서로 재확인한 뒤 연결한다(추측 금지) → 지금은 아무것도 그리지 않는다.
// 광고는 추천처럼 보이지 않게 '광고' 표기를 붙인다(프롬프트 §2 하지 않는 것).
export const ADS_ENABLED = false;

export function ResultBanner() {
  if (!ADS_ENABLED) return null;
  return (
    <aside className="ad-slot" aria-label="광고">
      <span className="badge">광고</span>
    </aside>
  );
}
