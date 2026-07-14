import { vi } from 'vitest';

export function createEventSocketMock() {
    return {
        eventSocket: {
            add_queue: () => vi.fn(),
            is_setup: () => Promise.resolve(),
            register_listener: vi.fn(),
            unregister_listener: vi.fn(),
        },
    };
}
