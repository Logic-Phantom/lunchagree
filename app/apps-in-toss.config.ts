import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔 등록명과 같아야 업로드된다(사용자 지정 'jeomsimhabui'). 바꾸면 src/platform/toss.ts APP_NAME도 같이 바꾼다.
  appName: 'jeomsimhabui',
  brand: {
    // 아이콘 워드마크 남색. CTA 버튼과 같은 색
    primaryColor: '#23252D',
  },
  // clipboard: 방 링크 복사(Clipboard.setText). geolocation: '내 위치로 찾기'를 누를 때만 Device.getLocation(거부해도 직접 추가로 동작)
  permissions: [
    { name: 'clipboard', access: 'write' },
    { name: 'geolocation', access: 'access' },
  ],
  // 토스 내비게이션 바의 뒤로가기를 쓰고, 토스 안에서는 자체 뒤로가기를 그리지 않는다(두 뒤로가기 동시 노출 금지)
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
  },
  webBundleDir: 'dist',
});
