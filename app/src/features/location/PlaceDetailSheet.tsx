// 지도·목록에서 음식점을 눌렀을 때: 공공데이터로 아는 것만 보여 주고, 영업시간·실제 영업 여부는 카카오맵·네이버지도에서 확인하게 연결한다.
import { Button, Notice, Sheet } from '../../components/ui';
import { kakaoMapSearchUrl, naverMapSearchUrl, tagLabel, type NearbyPlace } from '../../domain';
import { openExternal } from '../../platform/toss';

/** 카카오맵·네이버지도 장소 검색 버튼(영업시간·리뷰 확인용). */
export function MapLinks({ name, address }: { name: string; address: string | null }) {
  return (
    <div className="map-links">
      <Button variant="outline" small onClick={() => void openExternal(kakaoMapSearchUrl(name, address))}>
        카카오맵에서 보기
      </Button>
      <Button variant="outline" small onClick={() => void openExternal(naverMapSearchUrl(name, address))}>
        네이버지도에서 보기
      </Button>
    </div>
  );
}

export function PlaceDetailSheet({
  nearby, onClose, onAdd, added,
}: { nearby: NearbyPlace | null; onClose: () => void; onAdd?: (n: NearbyPlace) => void; added?: boolean }) {
  if (!nearby) return null;
  const { place, walkMin, distanceM } = nearby;
  const kind = place.tags.map(tagLabel).join('·') || '종류 미확인';
  return (
    <Sheet
      open
      title={place.name}
      onClose={onClose}
      footer={
        onAdd ? (
          <Button onClick={() => onAdd(nearby)} disabled={added} icon={added ? 'check' : 'plus'}>
            {added ? '이미 후보에 있어요' : '후보에 넣기'}
          </Button>
        ) : undefined
      }
    >
      <p className="sub">
        {kind}
        {place.tagSource === 'estimated' && place.tags.length ? '(이름으로 추정)' : ''} · 약 {walkMin}분({Math.round(distanceM / 10) * 10}m, 직선 기준 추정)
      </p>
      {place.address && <p className="caption">{place.address}</p>}
      <MapLinks name={place.name} address={place.address} />
      <Notice>영업시간·오늘 영업 여부·메뉴는 지도 앱에서 확인해 주세요. 점심합의의 정보는 인허가 기준(기준일 {place.baseDate || '미상'})이라 실제와 다를 수 있어요.</Notice>
    </Sheet>
  );
}
