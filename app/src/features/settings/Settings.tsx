// 설정: 앱 정보(메인 카피) · 추천 기준 안내 · 데이터 출처 · 개인정보 처리방침 · 오픈소스 라이선스.
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Header, Row, Screen } from '../../components/ui';
import { STATION_SOURCE } from '../../data/stations';
import { MENU_CHECK_NOTICE, PLACE_DISCLAIMER, WALK_DETOUR_FACTOR, WALK_METERS_PER_MIN } from '../../domain';
import ossLicenses from '../../legal/oss-licenses.json';

const VERSION = '0.1.0';

export function Settings() {
  const navigate = useNavigate();
  return (
    <Screen>
      <Header title="설정" />
      <section className="about">
        <img src="./brand/logo.png" alt="" width={56} height={56} />
        <div>
          <strong>점심합의 - 같이 정하는 오늘 점심</strong>
          <small>오늘 점심, 우리끼리 빠르게 정하자.</small>
          <small className="faint">LUNCH AGREEMENT · 버전 {VERSION}</small>
        </div>
      </section>
      <div className="row-list">
        <Row icon="info" label="추천 기준 안내" onClick={() => navigate('/settings/how')} />
        <Row icon="doc" label="데이터 출처" onClick={() => navigate('/settings/sources')} />
        <Row icon="shield" label="개인정보 처리방침" onClick={() => navigate('/settings/privacy')} />
        <Row icon="copy" label="오픈소스 라이선스" onClick={() => navigate('/settings/licenses')} />
        <Row icon="clock" label="최근 이용 기록" onClick={() => navigate('/history')} />
      </div>
    </Screen>
  );
}

export function SettingsPage() {
  const { page } = useParams();
  if (page === 'how') {
    return (
      <Screen>
        <Header title="추천 기준 안내" />
        <div className="prose">
          <h2>꼭 지키는 조건</h2>
          <p>못 먹는 것(모두의 합), 예산(가장 낮은 상한), 걷기 한도(가장 짧은 한도)는 자동으로 풀지 않아요. 후보가 부족하면 어떤 조건이 막았는지 알려 드리고, 완화는 직접 정해요. 못 먹는 것은 완화하지 않아요.</p>
          <h2>못 먹는 것은 어떻게 거르나요?</h2>
          <p>공공데이터에는 메뉴가 없어서 음식 종류로만 걸러요. 예를 들어 '해산물'을 고르면 회·해산물 가게는 빼고, 해산물 메뉴가 있을 수 있는 종류에는 '메뉴 확인 필요'를 붙여요. {MENU_CHECK_NOTICE}</p>
          <h2>순서는 어떻게 정하나요?</h2>
          <p>먹고 싶은 종류가 겹칠수록, 가까울수록 앞에 와요. 한 사람이 여러 종류를 고르면 그 사람의 선호가 나눠서 반영돼요. 점수 숫자는 보여 주지 않아요.</p>
          <h2>거리와 시간</h2>
          <p>기준역에서 직선거리를 재고 × {WALK_DETOUR_FACTOR}(길 돌아가는 정도) ÷ 분당 {WALK_METERS_PER_MIN}m로 걷는 시간을 어림해요. 실제와 다를 수 있어 항상 '추정'으로 표시해요.</p>
          <h2>투표</h2>
          <p>한 사람 한 표이고 언제든 바꿀 수 있어요. 동률이면 자동으로 정하지 않고 방장이 고르거나 다시 투표해요.</p>
        </div>
      </Screen>
    );
  }
  if (page === 'sources') {
    return (
      <Screen>
        <Header title="데이터 출처" />
        <div className="prose">
          <h2>음식점</h2>
          <p>행정안전부 식품 일반음식점 인허가 정보(공공데이터포털, 이용허락범위 제한 없음). 영업 중인 곳만 골라 기준역 반경 1km로 나눠 둬요. 기준일은 후보 목록에 표시돼요.</p>
          <p>{PLACE_DISCLAIMER}</p>
          <p>카카오·네이버 지도 데이터는 쓰지 않아요. 식당 사진·로고·메뉴판 이미지도 쓰지 않고, 그림은 음식 종류를 나타내는 점심합의 자체 아이콘이에요.</p>
          <h2>지하철역</h2>
          <p>역 이름과 ID는 사잇 프로젝트의 역 데이터를 사용해요. {STATION_SOURCE}</p>
          <h2>직접 추가한 후보</h2>
          <p>참가자가 입력한 이름·가격은 "직접 입력"으로 표시하며 점심합의가 확인한 정보가 아니에요.</p>
        </div>
      </Screen>
    );
  }
  if (page === 'privacy') {
    return (
      <Screen>
        <Header title="개인정보 처리방침" />
        <div className="prose">
          <h2>모으는 정보</h2>
          <p>공유 방을 쓸 때만 닉네임, 예산 상한, 먹고 싶은 음식 종류, 못 먹는 음식 칩, 걷기 한도, 투표를 서버(Supabase)에 저장해요. 알레르기·종교·건강 같은 이유는 묻지도 저장하지도 않아요.</p>
          <h2>누가 볼 수 있나요?</h2>
          <p>같은 방 참여자에게는 "그룹 상한 1만원", "해산물 제외"처럼 모은 결과만 보여요. 누가 무엇을 골랐는지는 보이지 않아요.</p>
          <h2>얼마나 보관하나요?</h2>
          <p>방은 당일 23:59 또는 만든 지 12시간 중 이른 시각에 마감되고, 하루 한 번 서버에서 지워져요.</p>
          <h2>사용자 구분</h2>
          <p>로그인은 쓰지 않아요. 중복 참여를 막기 위해 토스가 주는 익명 키를 방마다 다시 암호화(해시)한 값만 보내요. 이 값으로 다른 방의 참여와 연결할 수 없어요.</p>
          <h2>기기에 저장하는 정보</h2>
          <p>내 기본 조건, 최근 방, 결정 기록은 이 기기에만 저장돼요. 한 기기 모드의 모든 입력도 서버로 보내지 않아요. 앱을 지우면 함께 지워져요.</p>
          <h2>문의</h2>
          <p>앱인토스 콘솔에 등록한 문의 채널로 연락해 주세요.</p>
        </div>
      </Screen>
    );
  }
  if (page === 'licenses') {
    return (
      <Screen>
        <Header title="오픈소스 라이선스" />
        <p className="sub">점심합의에 포함된 오픈소스 {ossLicenses.packages.length}개</p>
        <ul className="oss-list">
          {ossLicenses.packages.map((p) => (
            <li key={`${p.name}@${p.version}`}>
              <details>
                <summary>
                  <strong>{p.name}</strong>
                  <small>
                    {p.version} · {p.license}
                  </small>
                </summary>
                <pre>{[...p.copyright, '', p.textId ? (ossLicenses.texts as Record<string, string>)[p.textId] : `License: ${p.license}`].join('\n')}</pre>
              </details>
            </li>
          ))}
        </ul>
      </Screen>
    );
  }
  return <Navigate to="/settings" replace />;
}
