import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
    vi.stubGlobal(
        'WebSocket',
        class MockWebSocket {
            static CONNECTING = 0;
            static OPEN = 1;
            static CLOSING = 2;
            static CLOSED = 3;
            readyState = MockWebSocket.CLOSED;
            onopen: ((..._args: any[]) => void) | null = null;
            onclose: ((..._args: any[]) => void) | null = null;
            onmessage: ((..._args: any[]) => void) | null = null;
            onerror: ((..._args: any[]) => void) | null = null;
            send = vi.fn();
            close = vi.fn();
            addEventListener = vi.fn();
            removeEventListener = vi.fn();
            dispatchEvent = vi.fn();
        },
    );
    vi.restoreAllMocks();
});
