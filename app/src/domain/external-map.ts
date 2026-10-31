// 카카오맵·네이버지도 '장소 검색' 링크. 실제 영업 여부·영업시간·리뷰는 그쪽 장소 페이지에서 사용자가 직접 본다.
// 우리는 그 데이터를 받거나 저장하지 않는다(카카오 로컬 API 저장 금지 약관과 무관 — 링크만 연다, D-039).
// 검색어 = 사업장명 + 도로명주소의 '시군구 도로명'까지(동명 상호 구분용). 인허가 상호와 간판이 다르면 검색이 빗나갈 수 있다.

export function mapSearchQuery(name: string, address: string | null): string {
  const parts = (address ?? '').split(',')[0].replace(/\(.*?\)/g, '').trim().split(/\s+/);
  // '서울특별시 강남구 강남대로 396' → '강남구 강남대로'
  const area = parts.length >= 3 ? `${parts[1]} ${parts[2]}` : '';
  return `${name} ${area}`.trim();
}

export function kakaoMapSearchUrl(name: string, address: string | null): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(mapSearchQuery(name, address))}`;
}

export function naverMapSearchUrl(name: string, address: string | null): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(mapSearchQuery(name, address))}`;
}
