import { vi } from 'vitest';

export function createGlobalsMock(overrides: Record<string, unknown> = {}) {
    return {
        BUILD_TYPE: 'www',
        DEBUG: false,
        APP_VERSION: '1.0.0',
        BUILD_DATE: '2026-01-01T00:00:00.000Z',
        GIT_SHA: 'abc1234',
        SHARE_DOMAIN: '',
        API_HOST: '',
        EVENT_SOCKET_HOST: '',
        DUMP_VERSION: 2,
        DB_PATH: '',
        get_uuid: () => 'test-uuid',
        get_client_type: () => 'www',
        is_firsttime: false,
        match_media_watcher: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        random_int: (range = 1) => Math.floor(Math.random() * range),
        ...overrides,
    };
}
