import { afterEach, describe, expect, it, vi } from 'vitest';

const log = vi.fn();
vi.mock('@apps-in-toss/web-framework', () => ({ Analytics: { log } }));

import { logEvent } from '../src/platform/toss';

afterEach(() => {
  vi.unstubAllGlobals();
  log.mockReset();
});

describe('logEvent', () => {
  it('토스 밖에서는 보내지 않는다', async () => {
    await logEvent('lunch_decided');
    expect(log).not.toHaveBeenCalled();
  });

  it('토스 안에서는 이벤트 이름만 보낸다', async () => {
    vi.stubGlobal('window', { ReactNativeWebView: {} });
    await logEvent('lunch_decided');
    expect(log).toHaveBeenCalledWith({ log_name: 'lunch_decided', log_type: 'event', params: {} });
  });

  it('전송 실패가 앱으로 번지지 않는다', async () => {
    vi.stubGlobal('window', { ReactNativeWebView: {} });
    log.mockRejectedValue(new Error('fail'));
    await expect(logEvent('room_joined')).resolves.toBeUndefined();
  });
});
