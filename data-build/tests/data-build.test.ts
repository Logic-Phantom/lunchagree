import proj4 from 'proj4';
import { describe, expect, it } from 'vitest';
import { COLUMNS } from '../src/column-map.ts';
import { ApiError, parsePage, slim } from '../src/fetch-api.ts';
import { CRS_DEFS, toWgs84 } from '../src/reproject.ts';
import { haversine, shardByStation } from '../src/shard-by-station.ts';
import { matchStations, normalizeStationName, parseStationRows, regionOf } from '../src/stations.ts';
import { tagFor } from '../src/tag.ts';
import { toPlaces } from '../src/transform.ts';
import { checkGate, median, missingColumns } from '../src/validate.ts';
import { addressKey, compareCrs } from '../src/verify-crs.ts';
import { rowsToRecords } from '../src/xlsx.ts';

/** WGS84 → 해당 좌표계 TM(x, y). 테스트용 역변환. */
function toTm(lat: number, lng: number, crs: keyof typeof CRS_DEFS): [number, number] {
  const [x, y] = proj4(CRS_DEFS[crs], 'WGS84').inverse([lng, lat]);
  return [x, y];
}

describe('reproject', () => {
  it('두 정의는 서울에서 동서 약 250m 차이 — 그래서 실측 판정이 필요', () => {
    const [x, y] = toTm(37.4977, 127.0279, 'EPSG:5174');
    const a = toWgs84(x, y, 'EPSG:5174')!;
    const b = toWgs84(x, y, 'EPSG:2097')!;
    expect(haversine(a, { lat: 37.4977, lng: 127.0279 })).toBeLessThan(1);
    const d = haversine(a, b);
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
  const station = { lat: 37.4977, lng: 127.0279, address: '서울특별시 강남구 강남대로 지하 396' };
  const row = (lat: number, lng: number) => {
    const [x, y] = toTm(lat, lng, 'EPSG:2097'); // 원본이 2097이라고 가정한 합성 데이터
    return { [COLUMNS.roadAddress]: '서울특별시 강남구 강남대로 지하 396, 지하1층 (역삼동)', [COLUMNS.x]: String(x), [COLUMNS.y]: String(y) };
  };

  it('주소 키는 쉼표 뒤·괄호·공백을 버린다', () => {
    expect(addressKey('서울특별시 강남구 강남대로 지하 396, 지하1층 (역삼동)')).toBe('서울특별시강남구강남대로지하396');
  });

  it('역 안 매장 표본으로 원본 좌표계를 맞힌다', () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(37.4977 + (i - 12) * 0.0001, 127.0279 + ((i % 5) - 2) * 0.0003));
    const r = compareCrs(rows, [station]);
    expect(r.samples).toBe(25);
    expect(r.best).toBe('EPSG:2097');
    expect(r.confirmed).toBe(true);
    expect(r.medianM['EPSG:5174'] - r.medianM['EPSG:2097']).toBeGreaterThan(80);
  });

  it('표본이 적으면 확정하지 않는다', () => {
    expect(compareCrs([row(37.4977, 127.0279)], [station]).confirmed).toBe(false);
    expect(compareCrs([], [station]).best).toBe(null);
  });
});

describe('stations', () => {
  it('역명 정규화', () => {
    expect(normalizeStationName('서울역')).toBe('서울');
    expect(normalizeStationName('강남역')).toBe('강남');
    expect(normalizeStationName('흑석(중앙대입구)')).toBe('흑석');
    expect(normalizeStationName('시청.용인대')).toBe('시청용인대');
  });

  it('지역: 시·도 정식 명칭, 경기는 시 단위, 오타·옛 이름 보정', () => {
    expect(regionOf('서울시 강남구 강남대로 지하396')).toBe('서울특별시 강남구');
    expect(regionOf('경기도 성남시 분당구 판교역로 160')).toBe('경기도 성남시');
    expect(regionOf('인천시 남구 경인로 1')).toBe('인천광역시 미추홀구');
    expect(regionOf('충남 아산시 배방읍')).toBe('충청남도 아산시');
    expect(regionOf('부산광역시 부산진구')).toBe(null);
  });

  it('노선 힌트로 동명이역을 가르고, 같은 역 노선별 좌표는 평균', () => {
    const rows = parseStationRows(
      rowsToRecords(
        [
          ['역사명', '노선명', '역위도', '역경도', '역사도로명주소'],
          ['양평', '5호선', '37.5256', '126.8862', '서울특별시 영등포구 양평로 지하 31'],
          ['양평', '경의중앙선', '37.4927', '127.4919', '경기도 양평군 양평읍 역전길 30'],
          ['강남', '2호선', '37.4980', '127.0280', '서울특별시 강남구 강남대로 지하396'],
          ['강남', '신분당선', '37.4974', '127.0279', '서울특별시 강남구 강남대로 지하 396'],
          ['서면', '부산1호선', '35.1578', '129.0592', '부산광역시 부산진구 중앙대로 지하730'],
        ],
        ['역사명', '역위도', '역경도'],
      ),
    );
    const r = matchStations(
      [{ id: 'S1', name: '양평' }, { id: 'S2', name: '양평(경의중앙선)' }, { id: 'S3', name: '강남' }, { id: 'S4', name: '서면' }],
      rows,
    );
    const by = Object.fromEntries(r.matched.map((m) => [m.id, m]));
    expect(by.S1.lng).toBeCloseTo(126.8862, 3);
    expect(by.S2.lng).toBeCloseTo(127.4919, 3);
    expect(by.S3.lat).toBeCloseTo(37.4977, 4);
    expect(by.S3.rows).toBe(2);
    expect(r.missing).toEqual(['서면']); // 수도권 밖 동명이역은 쓰지 않는다
  });
});

describe('fetch-api 응답 파싱', () => {
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

  it('필요한 필드만 남긴다(전화번호 등 버림)', () => {
    const s = slim({ [COLUMNS.name]: '가게', TELNO: '02-000-0000', ML_PRCTR_CNT: '3' });
    expect(s[COLUMNS.name]).toBe('가게');
    expect('TELNO' in s).toBe(false);
  });
});

describe('tag', () => {
  it('업태가 있으면 원천, 없으면 이름으로 추정', () => {
    expect(tagFor('한식', '아무개')).toEqual({ tags: ['korean'], tagSource: 'source' });
    expect(tagFor('기타', '할매국밥')).toEqual({ tags: ['soup'], tagSource: 'estimated' });
    expect(tagFor(undefined, '이름만')).toEqual({ tags: [], tagSource: 'estimated' });
  });
});

describe('transform + shard', () => {
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

  it('역 반경 1km 안만, 가까운 순', () => {
    const s = { id: 'S0001', name: '테스트역', lat: 37.5, lng: 127.0 };
    const mk = (id: string, dLatM: number) => ({ id, name: id, address: '', lat: 37.5 + dLatM / 111_195, lng: 127.0, tags: [], tagSource: 'estimated' as const, baseDate: '' });
    const shards = shardByStation([s], [mk('far', 1200), mk('near', 100), mk('mid', 800)]);
    expect(shards.get('S0001')!.map((p) => p.id)).toEqual(['near', 'mid']);
  });
});

describe('validate', () => {
  it('필수 필드 누락을 알려 준다', () => {
    expect(missingColumns([COLUMNS.id, COLUMNS.name])).toEqual([COLUMNS.status, COLUMNS.x, COLUMNS.y]);
  });

  it('Phase 0 게이트: 중앙값 100 이상 & 태그 70% 이상', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    const p = (tags: string[]) => ({ id: 'x', name: 'x', address: '', lat: 0, lng: 0, tags, tagSource: 'source' as const, baseDate: '' });
    const many = Array.from({ length: 100 }, (_, i) => p(i < 75 ? ['korean'] : []));
    expect(checkGate(new Map([['A', many]]), ['A']).pass).toBe(true);
    expect(checkGate(new Map([['A', many.slice(0, 99)]]), ['A']).pass).toBe(false);
  });
});
