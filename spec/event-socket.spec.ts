import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistentStorage } from '../src/persistent-storage.es5';

vi.mock('../src/globals', () => ({
    EVENT_SOCKET_HOST: 'https://songs.worshipleaderapp.com',
    get_uuid: vi.fn(() => 'test-uuid-123'),
    DEBUG: false,
}));

vi.mock('../src/util', () => ({
    deferred_promise: vi.fn(() => {
        let resolve: (value?: unknown) => void;
        let reject: (reason?: unknown) => void;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        promise.catch(() => {});
        return [{ resolve: resolve!, reject: reject! }, promise];
    }),
    fetch_json: vi.fn(() => Promise.resolve({ completed: [] })),
}));

class MockWebSocket {
    static instances: MockWebSocket[] = [];
    url: string;
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    readyState = 0;
    sentMessages: string[] = [];

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    send(data: string) {
        this.sentMessages.push(data);
    }

    close() {
        this.readyState = 3;
        if (this.onclose) {
            this.onclose(new CloseEvent('close'));
        }
    }

    simulateOpen() {
        this.readyState = 1;
        if (this.onopen) {
            this.onopen(new Event('open'));
        }
    }

    simulateMessage(data: unknown) {
        if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
        }
    }

    simulateError() {
        if (this.onerror) {
            this.onerror(new Event('error'));
        }
    }

    static reset() {
        MockWebSocket.instances = [];
    }

    static getLastInstance(): MockWebSocket | undefined {
        return MockWebSocket.instances[MockWebSocket.instances.length - 1];
    }
}

describe('EventSocket', () => {
    let originalWebSocket: typeof WebSocket;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        persistentStorage.clear();
        MockWebSocket.reset();

        originalWebSocket = window.WebSocket;
        (window as any).WebSocket = MockWebSocket;

        vi.resetModules();
    });

    afterEach(() => {
        window.WebSocket = originalWebSocket;
        vi.useRealTimers();
    });

    async function createEventSocket() {
        const module = await import('../src/event-socket');
        return module.eventSocket;
    }

    describe('constructor and initialization', () => {
        it('creates WebSocket connection with correct endpoint', async () => {
            await createEventSocket();

            const ws = MockWebSocket.getLastInstance();
            expect(ws).toBeDefined();
            expect(ws!.url).toBe('wss://songs.worshipleaderapp.com/api/event/ws/test-uuid-123');
        });

        it('sends time skew event on connection open', async () => {
            await createEventSocket();

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            expect(ws.sentMessages.length).toBeGreaterThan(0);
            const firstMessage = JSON.parse(ws.sentMessages[0]);
            expect(firstMessage[0][2]).toBe('time');
        });

        it('type returns websocket when connected', async () => {
            const eventSocket = await createEventSocket();

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            expect(eventSocket.type()).toBe('websocket');
        });

        it('type returns fallback when WebSocket not available', async () => {
            (window as any).WebSocket = undefined;

            const eventSocket = await createEventSocket();

            expect(eventSocket.type()).toBe('fallback');
        });
    });

    describe('queue management', () => {
        it('add_queue creates a new queue and returns add function', async () => {
            const eventSocket = await createEventSocket();

            const addToQueue = eventSocket.add_queue('test-queue');

            expect(typeof addToQueue).toBe('function');
            expect(eventSocket.queues['test-queue']).toBeDefined();
        });

        it('add_queue throws if queue already exists', async () => {
            const eventSocket = await createEventSocket();

            eventSocket.add_queue('duplicate-queue');

            expect(() => eventSocket.add_queue('duplicate-queue')).toThrow('Queue duplicate-queue already created');
        });

        it('add_queue respects max_items limit', async () => {
            const eventSocket = await createEventSocket();

            const addToQueue = eventSocket.add_queue('limited-queue', 3);

            addToQueue('item1');
            addToQueue('item2');
            addToQueue('item3');
            addToQueue('item4');
            addToQueue('item5');

            expect(eventSocket.queues['limited-queue'].items.length).toBe(3);
        });

        it('add_queue removes duplicates when dup_key provided', async () => {
            const eventSocket = await createEventSocket();

            const addToQueue = eventSocket.add_queue('dedup-queue');

            addToQueue('first', 'key1');
            addToQueue('second', 'key2');
            addToQueue('updated-first', 'key1');

            const items = eventSocket.queues['dedup-queue'].items;
            expect(items.length).toBe(2);
            expect(items.find((i) => i.item === 'first')).toBeUndefined();
            expect(items.find((i) => i.item === 'updated-first')).toBeDefined();
        });

        it('add_queue loads items from persistent storage', async () => {
            persistentStorage.setObj('event-queues', {
                'restored-queue': {
                    name: 'restored-queue',
                    items: [{ ts: Date.now(), item: 'stored-item' }],
                    max_age: -1,
                    max_items: 100,
                },
            });

            const eventSocket = await createEventSocket();
            eventSocket.add_queue('restored-queue');

            expect(eventSocket.queues['restored-queue'].items.length).toBe(1);
            expect(eventSocket.queues['restored-queue'].items[0].item).toBe('stored-item');
        });

        it('throws when adding item to non-existent queue', async () => {
            const eventSocket = await createEventSocket();

            expect(() => (eventSocket as any)._add_item('nonexistent', 'data')).toThrow('Queue nonexistent not registered');
        });
    });

    describe('message sending via WebSocket', () => {
        it('sends queued messages when WebSocket opens', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('send-queue');

            addToQueue('test-message');

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            const messages = ws.sentMessages.map((m) => JSON.parse(m));
            const hasQueueMessage = messages.some((batch) => batch.some((msg: unknown[]) => msg[2] === 'send-queue'));
            expect(hasQueueMessage).toBe(true);
        });

        it('includes timestamp delta in sent messages', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('ts-queue');

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();
            ws.sentMessages = [];

            addToQueue('timestamped');

            const messages = ws.sentMessages.flatMap((m) => JSON.parse(m));
            const queueMessage = messages.find((msg: unknown[]) => msg[2] === 'ts-queue');
            expect(queueMessage).toBeDefined();
            expect(typeof queueMessage[1]).toBe('number');
        });
    });

    describe('message processing', () => {
        it('removes completed items from queue on response', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('response-queue');

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            addToQueue('will-be-completed');

            const queueItem = eventSocket.queues['response-queue'].items[0];
            const rid = queueItem.rid;

            ws.simulateMessage([[rid, 'ok']]);

            expect(eventSocket.queues['response-queue'].items.length).toBe(0);
        });

        it('triggers listener callback on notification', async () => {
            const eventSocket = await createEventSocket();
            const callback = vi.fn();

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            eventSocket.register_listener('test-channel', callback);

            ws.simulateMessage([[0, '_not', 'test-channel', { data: 'notification-data' }]]);

            expect(callback).toHaveBeenCalledWith({ data: 'notification-data' }, 'test-channel');
        });

        it('saves queues after processing responses', async () => {
            const eventSocket = await createEventSocket();
            eventSocket.add_queue('persist-queue');

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            ws.simulateMessage([[999, 'done']]);

            const saved = persistentStorage.getObj('event-queues');
            expect(saved).toBeDefined();
        });
    });

    describe('listener registration', () => {
        it('register_listener stores listener info', async () => {
            const eventSocket = await createEventSocket();
            const callback = vi.fn();

            eventSocket.register_listener('my-channel', callback, { filter: 'value' });

            expect(eventSocket._listeners['my-channel']).toBeDefined();
            expect(eventSocket._listeners['my-channel'].initial_query).toEqual({ filter: 'value' });
        });

        it('register_listener sends subscription via WebSocket when connected', async () => {
            const eventSocket = await createEventSocket();
            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();
            ws.sentMessages = [];

            eventSocket.register_listener('sub-channel', vi.fn());

            const messages = ws.sentMessages.flatMap((m) => JSON.parse(m));
            const subMessage = messages.find((msg: unknown[]) => msg[2] === '_sub');
            expect(subMessage).toBeDefined();
            expect(subMessage[3][0]).toBe('sub-channel');
        });

        it('unregister_listener removes listener and sends unsubscribe', async () => {
            const eventSocket = await createEventSocket();
            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            eventSocket.register_listener('unsub-channel', vi.fn());
            ws.sentMessages = [];

            eventSocket.unregister_listener('unsub-channel');

            expect(eventSocket._listeners['unsub-channel']).toBeUndefined();
            const messages = ws.sentMessages.flatMap((m) => JSON.parse(m));
            const unsubMessage = messages.find((msg: unknown[]) => msg[2] === '_unsub');
            expect(unsubMessage).toBeDefined();
        });

        it('register_listener replaces existing listener for same channel', async () => {
            const eventSocket = await createEventSocket();
            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            const callback1 = vi.fn();
            const callback2 = vi.fn();

            eventSocket.register_listener('replace-channel', callback1);
            eventSocket.register_listener('replace-channel', callback2);

            ws.simulateMessage([[0, '_not', 'replace-channel', 'data']]);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });
    });

    describe('WebSocket reconnection', () => {
        it('attempts reconnect after close', async () => {
            await createEventSocket();

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();
            ws.close();

            expect(MockWebSocket.instances.length).toBe(1);

            vi.advanceTimersByTime(10001);

            expect(MockWebSocket.instances.length).toBe(2);
        });

        it('closes socket on error', async () => {
            await createEventSocket();

            const ws = MockWebSocket.getLastInstance()!;
            const closeSpy = vi.spyOn(ws, 'close');

            ws.simulateError();

            expect(closeSpy).toHaveBeenCalled();
        });
    });

    describe('fallback HTTP polling', () => {
        it('uses fallback when WebSocket throws on construction', async () => {
            (window as any).WebSocket = function () {
                throw new Error('WebSocket blocked');
            };

            const eventSocket = await createEventSocket();

            expect(eventSocket.type()).toBe('fallback');
        });

        it('fallback sends messages via fetch_json after timeout', async () => {
            const { fetch_json } = await import('../src/util');

            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('fallback-queue');

            eventSocket._use_fallback = true;
            addToQueue('fallback-item');

            vi.advanceTimersByTime(120001);

            eventSocket._fallback_maybe_send_messages();

            expect(fetch_json).toHaveBeenCalled();
        });
    });

    describe('queue purging', () => {
        it('purges items older than max_age', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('purge-queue', 100, 60);

            addToQueue('old-item');

            vi.advanceTimersByTime(61000);

            (eventSocket as any)._purge_queues();

            expect(eventSocket.queues['purge-queue'].items.length).toBe(0);
        });

        it('keeps items within max_age', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('keep-queue', 100, 60);

            addToQueue('fresh-item');

            vi.advanceTimersByTime(30000);

            (eventSocket as any)._purge_queues();

            expect(eventSocket.queues['keep-queue'].items.length).toBe(1);
        });

        it('does not purge items when max_age is -1', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('forever-queue', 100, -1);

            addToQueue('eternal-item');

            vi.advanceTimersByTime(1000000);

            (eventSocket as any)._purge_queues();

            expect(eventSocket.queues['forever-queue'].items.length).toBe(1);
        });
    });

    describe('queue persistence', () => {
        it('saves queues with max_age != 0 to storage', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('persist-queue', 100, -1);

            addToQueue('persistent-item');

            const saved = persistentStorage.getObj<Record<string, unknown>>('event-queues');
            expect(saved).toBeDefined();
            expect(saved!['persist-queue']).toBeDefined();
        });

        it('does not save queues with max_age = 0', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('volatile-queue', 100, 0);

            addToQueue('volatile-item');

            const saved = persistentStorage.getObj<Record<string, unknown>>('event-queues');
            expect(saved!['volatile-queue']).toBeUndefined();
        });

        it('does not save empty queues', async () => {
            const eventSocket = await createEventSocket();
            eventSocket.add_queue('empty-queue', 100, -1);

            const saved = persistentStorage.getObj<Record<string, unknown>>('event-queues');
            expect(saved?.['empty-queue']).toBeUndefined();
        });
    });

    describe('is_setup promise', () => {
        it('resolves when WebSocket connects', async () => {
            const eventSocket = await createEventSocket();

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            await expect(eventSocket.is_setup()).resolves.toBeUndefined();
        });
    });

    describe('generate events to send', () => {
        it('does not resend items within 30 second window', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('throttle-queue');

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            addToQueue('item1');

            const firstSendCount = ws.sentMessages.length;

            vi.advanceTimersByTime(10000);
            (eventSocket as any)._ws_send_messages();

            expect(ws.sentMessages.length).toBe(firstSendCount);
        });

        it('resends items after 30 second window', async () => {
            const eventSocket = await createEventSocket();
            const addToQueue = eventSocket.add_queue('resend-queue');

            const ws = MockWebSocket.getLastInstance()!;
            ws.simulateOpen();

            addToQueue('resend-item');

            const firstSendCount = ws.sentMessages.length;

            vi.advanceTimersByTime(31000);
            (eventSocket as any)._ws_send_messages();

            expect(ws.sentMessages.length).toBeGreaterThan(firstSendCount);
        });
    });
});
