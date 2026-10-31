import proj4 from 'proj4';
import { describe, expect, it } from 'vitest';
import { haversineMeters } from '../../app/src/domain/distance.ts';
import { tileKey, tilesAround } from '../../app/src/domain/tiles.ts';
import { buildTiles, toTileRow } from '../src/build.ts';
import { COLUMNS } from '../src/column-map.ts';
import { ApiError, parsePage, SIDO, slim } from '../src/fetch-api.ts';
import { mergeRows } from '../src/reference-points.ts';
import { CRS_DEFS, toWgs84 } from '../src/reproject.ts';
import { tagFor } from '../src/tag.ts';
import { toPlaces, type Place } from '../src/transform.ts';
import { checkGate, findMeasurePoints, median, missingColumns, placesNear } from '../src/validate.ts';
import { addressKey, compareCrs } from '../src/verify-crs.ts';

/** WGS84 → 해당 좌표계 TM(x, y). 테스트용 역변환. */
function toTm(lat: number, lng: number, crs: keyof typeof CRS_DEFS): [number, number] {
  const [x, y] = proj4(CRS_DEFS[crs], 'WGS84').inverse([lng, lat]);
  return [x, y];
}

const place = (id: string, lat: number, lng: number, tags: string[] = ['korean']): Place => ({
  id, name: id, address: '', lat, lng, tags, tagSource: 'source', baseDate: '2026-10-31',
});

describe('reproject', () => {
  it('두 정의는 서울에서 동서 약 250m 차이 — 그래서 실측 판정이 필요', () => {
    const [x, y] = toTm(37.4977, 127.0279, 'EPSG:5174');
    const a = toWgs84(x, y, 'EPSG:5174')!;
    const b = toWgs84(x, y, 'EPSG:2097')!;
    expect(haversineMeters(a, { lat: 37.4977, lng: 127.0279 })).toBeLessThan(1);
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(300);
  });

  it('0·비정상 좌표는 버린다', () => {
    expect(toWgs84(0, 0)).toBe(null);
    expect(toWgs84(Number.NaN, 1)).toBe(null);
    expect(toWgs84(9e7, 9e7)).toBe(null);
  });
});

describe('verify-crs', () => {
  const ref = { lat: 37.4977, lng: 127.0279, address: '서울특별시 강남구 강남대로 지하 396' };
  const row = (lat: number, lng: number) => {
    const [x, y] = toTm(lat, lng, 'EPSG:2097'); // 원본이 2097이라고 가정한 합성 데이터
    return { [COLUMNS.roadAddress]: '서울특별시 강남구 강남대로 지하 396, 지하1층 (역삼동)', [COLUMNS.x]: String(x), [COLUMNS.y]: String(y) };
  };

  it('주소 키는 쉼표 뒤·괄호·공백을 버린다', () => {
    expect(addressKey('서울특별시 강남구 강남대로 지하 396, 지하1층 (역삼동)')).toBe('서울특별시강남구강남대로지하396');
  });

  it('기준점 주소와 같은 매장 표본으로 원본 좌표계를 맞힌다', () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(37.4977 + (i - 12) * 0.0001, 127.0279 + ((i % 5) - 2) * 0.0003));
    const r = compareCrs(rows, [ref]);
    expect(r.samples).toBe(25);
    expect(r.best).toBe('EPSG:2097');
    expect(r.confirmed).toBe(true);
  });

  it('표본이 적으면 확정하지 않는다', () => {
    expect(compareCrs([row(37.4977, 127.0279)], [ref]).confirmed).toBe(false);
    expect(compareCrs([], [ref]).best).toBe(null);
  });
});

describe('reference-points', () => {
  it('같은 역 노선별 행은 평균, 이름이 같아도 멀면 따로, 괄호 부역명 제거', () => {
    const pts = mergeRows([
      { 역사명: '강남', 역위도: '37.4980', 역경도: '127.0280', 역사도로명주소: '서울특별시 강남구 강남대로 지하396' },
      { 역사명: '강남', 역위도: '37.4974', 역경도: '127.0279', 역사도로명주소: '' },
      { 역사명: '시청', 역위도: '37.5644', 역경도: '126.9762', 역사도로명주소: '서울특별시 중구 세종대로 지하101' },
      { 역사명: '시청', 역위도: '36.3517', 역경도: '127.3867', 역사도로명주소: '대전광역시 서구 둔산중로 지하 55' },
      { 역사명: '삼성(무역센터)', 역위도: '37.5088', 역경도: '127.0632', 역사도로명주소: '서울특별시 강남구 테헤란로 지하538' },
    ]);
    expect(pts.filter((p) => p.name === '강남')).toHaveLength(1);
    expect(pts.find((p) => p.name === '강남')!.lat).toBeCloseTo(37.4977, 4);
    expect(pts.filter((p) => p.name === '시청')).toHaveLength(2);
    expect(findMeasurePoints(pts).map((p) => p.name)).toEqual(['강남', '삼성', '시청']);
    expect(findMeasurePoints(pts).find((p) => p.name === '시청')!.address).toMatch(/^서울/);
  });
});

describe('tiles (앱과 같은 계산)', () => {
  it('타일 키와 반경 1km 타일 목록', () => {
    expect(tileKey(37.4977, 127.0279)).toBe('7499_25405');
    const keys = tilesAround({ lat: 37.4977, lng: 127.0279 }, 1000);
    expect(keys).toContain('7499_25405');
    expect(keys.length).toBeGreaterThanOrEqual(25); // 약 2km 상자 ÷ 555m×440m 칸
    expect(keys.length).toBeLessThanOrEqual(42);
  });

  it('타일로 나눴다가 반경으로 다시 찾으면 1km 안만 정확히 나온다', () => {
    const c = { lat: 37.5, lng: 127.0 };
    const ps = [place('in1', 37.5009, 127.0), place('in2', 37.5, 127.011), place('out', 37.51, 127.0)];
    const near = placesNear(buildTiles(ps), c);
    expect(near.map((p) => p.id).sort()).toEqual(['in1', 'in2']);
  });

  it('타일 행은 좌표 5자리·첫 태그·추정 여부만', () => {
    expect(toTileRow({ ...place('P1', 37.1234567, 127.7654321), tagSource: 'estimated', address: '서울 어딘가' })).toEqual(['P1', 'P1', 37.12346, 127.76543, 'korean', 1, '서울 어딘가']);
    expect(toTileRow(place('P2', 37, 127, []))[4]).toBe('');
  });
});

describe('fetch-api', () => {
  it('item 배열/단일 객체/빈 items', () => {
    const ok = (items: unknown) => ({ response: { header: { resultCode: '00' }, body: { totalCount: 3, items } } });
    expect(parsePage(ok({ item: [{ a: '1' }, { a: '2' }] })).items).toHaveLength(2);
    expect(parsePage(ok({ item: { a: '1' } })).items).toHaveLength(1);
    expect(parsePage(ok('')).items).toEqual([]);
    expect(parsePage(ok('')).total).toBe(3);
  });

  it('오류 코드는 멈춘다', () => {
    expect(() => parsePage({ response: { header: { resultCode: '22', resultMsg: 'LIMITED' } } })).toThrow(ApiError);
    expect(() => parsePage({ nope: 1 })).toThrow(ApiError);
  });

  it('필요한 필드만 남긴다(전화번호 등 버림), 기본 수집 범위는 전국 17개 시·도', () => {
    const s = slim({ [COLUMNS.name]: '가게', TELNO: '02-000-0000', ML_PRCTR_CNT: '3' });
    expect(s[COLUMNS.name]).toBe('가게');
    expect('TELNO' in s).toBe(false);
    expect(SIDO).toHaveLength(17);
  });
});

describe('tag', () => {
  it('업태가 있으면 원천, 없으면 이름으로 추정', () => {
    expect(tagFor('한식', '아무개')).toEqual({ tags: ['korean'], tagSource: 'source' });
    expect(tagFor('기타', '할매국밥')).toEqual({ tags: ['soup'], tagSource: 'estimated' });
    expect(tagFor(undefined, '이름만')).toEqual({ tags: [], tagSource: 'estimated' });
  });
});

describe('transform', () => {
  const row = (id: string, status: string, x: string, y: string, type = '한식', sanitation = '') => ({
    [COLUMNS.id]: id, [COLUMNS.name]: `가게${id}`, [COLUMNS.status]: status, [COLUMNS.x]: x, [COLUMNS.y]: y,
    [COLUMNS.businessType]: type, [COLUMNS.sanitationType]: sanitation, [COLUMNS.address]: '서울', [COLUMNS.roadAddress]: '',
  });

  it('영업 중 + 좌표 있는 곳만, 중복 관리번호 제거, 업태 비면 위생업태 사용', () => {
    const { places, stats } = toPlaces(
      [
        row('1', '영업/정상', '200000', '450000'),
        row('1', '영업/정상', '200000', '450000'),
        row('2', '폐업', '200000', '450000'),
        row('3', '영업/정상', '', ''),
        row('4', '영업/정상', '200100', '450000', '', '중국식'),
      ],
      '2026-10-30',
    );
    expect(places.map((p) => p.id)).toEqual(['P1', 'P4']);
    expect(places[1].tags).toEqual(['chinese']);
    expect(stats).toEqual({ total: 5, notOpen: 1, noCoord: 1, kept: 2, tagFromSource: 2 });
  });
});

describe('validate', () => {
  it('필수 필드 누락을 알려 준다', () => {
    expect(missingColumns([COLUMNS.id, COLUMNS.name])).toEqual([COLUMNS.status, COLUMNS.x, COLUMNS.y]);
  });

  it('Phase 0 게이트: 지점별 1km 후보 수 중앙값 ≥ 100 & 태그 ≥ 70%', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    const many = Array.from({ length: 100 }, (_, i) => place(`p${i}`, 37.5, 127, i < 75 ? ['korean'] : []));
    expect(checkGate([many]).pass).toBe(true);
    expect(checkGate([many.slice(0, 99)]).pass).toBe(false);
  });
});
