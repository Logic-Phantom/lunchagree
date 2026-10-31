import { describe, expect, it } from 'vitest';
import { COLUMNS } from '../src/column-map.ts';
import { parseCsv } from '../src/csv.ts';
import { toWgs84 } from '../src/reproject.ts';
import { haversine, shardByStation } from '../src/shard-by-station.ts';
import { tagFor } from '../src/tag.ts';
import { toPlaces } from '../src/transform.ts';
import { checkGate, median, missingColumns } from '../src/validate.ts';

describe('csv', () => {
  it('따옴표 안의 쉼표·줄바꿈·이스케이프를 처리하고 BOM을 지운다', () => {
    const rows = parseCsv('﻿a,b\r\n"1,2","x ""y""\nz"\n3,4\n');
    expect(rows).toEqual([{ a: '1,2', b: 'x "y"\nz' }, { a: '3', b: '4' }]);
  });
});

describe('reproject EPSG:5174 → WGS84', () => {
  it('원점(200000, 500000)은 위도 38°, 경도 127.0029° 부근(+towgs84 보정 수백 m 이내)', () => {
    const p = toWgs84(200000, 500000)!;
    expect(p.lat).toBeGreaterThan(37.99);
    expect(p.lat).toBeLessThan(38.01);
    expect(p.lng).toBeGreaterThan(126.99);
    expect(p.lng).toBeLessThan(127.02);
  });

  it('0·비정상 좌표는 버린다', () => {
    expect(toWgs84(0, 0)).toBe(null);
    expect(toWgs84(Number.NaN, 1)).toBe(null);
    expect(toWgs84(9e7, 9e7)).toBe(null);
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
  const row = (id: string, status: string, x: string, y: string, type = '한식') => ({
    [COLUMNS.id]: id, [COLUMNS.name]: `가게${id}`, [COLUMNS.status]: status, [COLUMNS.x]: x, [COLUMNS.y]: y,
    [COLUMNS.businessType]: type, [COLUMNS.address]: '서울', [COLUMNS.roadAddress]: '',
  });

  it('영업 중 + 좌표 있는 곳만 남기고 통계를 낸다', () => {
    const { places, stats } = toPlaces(
      [row('1', '영업/정상', '200000', '450000'), row('2', '폐업', '200000', '450000'), row('3', '영업/정상', '', '')],
      '2026-10-30',
    );
    expect(places.map((p) => p.id)).toEqual(['P1']);
    expect(stats).toEqual({ total: 3, notOpen: 1, noCoord: 1, kept: 1, tagFromSource: 1 });
    expect(places[0].baseDate).toBe('2026-10-30');
  });

  it('역 반경 1km 안만, 가까운 순', () => {
    const s = { id: 'S0001', name: '테스트역', lat: 37.5, lng: 127.0 };
    const mk = (id: string, dLatM: number) => ({ id, name: id, address: '', lat: 37.5 + dLatM / 111_195, lng: 127.0, tags: [], tagSource: 'estimated' as const, baseDate: '' });
    const shards = shardByStation([s], [mk('far', 1200), mk('near', 100), mk('mid', 800)]);
    expect(shards.get('S0001')!.map((p) => p.id)).toEqual(['near', 'mid']);
    expect(haversine(s, mk('x', 1000))).toBeCloseTo(1000, -1);
  });
});

describe('validate', () => {
  it('필수 컬럼 누락을 알려 준다', () => {
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
