# 라이선스

## 앱 번들에 들어가는 오픈소스
`npm run licenses`(빌드 시 자동)로 `app/src/legal/oss-licenses.json` 생성 → 설정 > 오픈소스 라이선스 화면.
2026-10-31 기준 **13개: MIT 11 · ISC 1 · Apache-2.0 1**. 허용 목록 밖(GPL/AGPL 등)이 나오면 빌드 실패.

## 빌드·개발 도구 (번들 미포함)
| 패키지 | 라이선스 | 용도 |
|---|---|---|
| proj4 | MIT | data-build 좌표 변환 |
| @electric-sql/pglite | Apache-2.0 / PostgreSQL | SQL·RLS 테스트 |
| vite, vitest, typescript, @vitejs/plugin-react | MIT / Apache-2.0 | 빌드·테스트 |
| @apps-in-toss/cli | (빌드 도구, 앱 미포함) | `.ait` 패키징 |

## 데이터
- 행정안전부 일반음식점 인허가 정보: 이용허락범위 제한 없음(출처 표시).
- 지하철역 ID·이름(사잇 경유): 서울교통공사 등, 공공누리 제1유형(출처 표시).

## 브랜드
- 앱 아이콘·워드마크: 사용자 제공 원본(`assets/brand/icon-source.png`).
- 이름 '점심합의', 'LUNCH AGREEMENT': 일반 단어 조합이라 상표 식별력이 약할 수 있음. KIPRIS(제9·42·43류) 검색과 로고 결합형 출원 여부는 사용자 결정.
