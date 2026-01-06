import { get_host, get_main_domain, get_uuid } from './globals';
import { persistentStorage } from './persistent-storage.es5';
import { deferred_promise, fetch_json, type DeferredPromise } from './util';

const DEBUG_XHR = 0;

type EventData = unknown;
type DupKey = unknown;

type QueueItem<T = EventData> = {
    ts: number;
    item: T;
    dup_key?: DupKey;
    last_send?: number;
    rid?: number;
};

type QueueState<T = EventData> = {
    name: string;
    items: QueueItem<T>[];
    max_age: number;
    max_items: number;
};

type ListenerCallback = (data: EventData, channel?: string) => void;

type ListenerInfo = {
    initial_query: Record<string, unknown>;
    callback: ListenerCallback;
};

type ListenerMap = Record<string, ListenerInfo>;
type QueueMap = Record<string, QueueState>;
// response id, other data
type WireMessage = [number, number | '_not', ...unknown[]];
type WireMessageBatch = WireMessage[];

/*
 * Either send a message to the server (which will get a response to guarentee
 * it was received and processed successfully, but which will not do any
 * callbacks as we are not sure if it will happen in this session or some later
 * time), or hook to a notification which may send some data back straight away
 * and trigger on later events too.
 */
class EventSocket {
    _ws: WebSocket | undefined;
    _ws_endpoint: string;
    _fallback_endpoint: string;
    _storage_key: string;
    queues: QueueMap;
    _id_counter: number;
    _last_ws_send: number;
    _last_fallback_send: number;
    _listeners: ListenerMap;
    _use_fallback: boolean;
    _register_fallback_debounce: number | undefined;
    _is_connected_promise: DeferredPromise<void>;
    _is_setup: Promise<void>;

    constructor() {
        let host = get_main_domain();
        let fallback_host = get_host();
        if (DEBUG) {
            host = host.replace(/:3500/, ':3100'); // maybe change the port if on dev
            fallback_host = host;
        }

        // http -> ws; https -> wss
        this._ws_endpoint = host.replace(/^http/, 'ws') + '/api/event/ws/' + get_uuid();
        this._fallback_endpoint = fallback_host + '/api/event/add/' + get_uuid();

        this._storage_key = 'event-queues';
        this.queues = {};
        this._id_counter = 1;
        this._last_ws_send = Date.now();
        this._last_fallback_send = 0;

        this._listeners = {};
        this._use_fallback = false;

        if (DEBUG) {
            window.event_socket = this;
            if (DEBUG_XHR) this._use_fallback = true;
        }

        // Pretty much everything other than ie9 supports WebSocket apparently,
        // but may be some issues from behind firewalls etc
        [this._is_connected_promise, this._is_setup] = deferred_promise<void>();
        if (window.WebSocket) this._ws_connect();
        else {
            this._use_fallback = true;
            this._is_connected_promise.reject();
        }

        setInterval(() => this._fallback_maybe_send_messages(), 2000);
    }

    type(): 'websocket' | 'fallback' {
        return this._ws ? 'websocket' : 'fallback';
    }
    is_setup(): Promise<void> {
        return this._is_setup;
    }

    _ws_connect(): void {
        if (this._use_fallback || this._ws) return;

        let ws: WebSocket;
        try {
            ws = new window.WebSocket(this._ws_endpoint);
        } catch (e) {
            this._use_fallback = true;
            return;
        }

        ws.onmessage = (e: MessageEvent<string>) => {
            const msg = JSON.parse(e.data) as WireMessageBatch;
            this._last_ws_send = Date.now();
            this._process_responses(msg);
        };
        ws.onopen = () => {
            // Special first message to allow server to calculate the skew
            this._ws = ws;
            this._ws_send([this._get_time_skew_event()]);
            let pubsub = this._generate_pubsub_to_send();
            if (pubsub.length) this._ws_send(pubsub);
            this._ws_send_messages();

            this._is_connected_promise.resolve();
        };
        ws.onclose = () => {
            // Try a reconnect in a bit
            setTimeout(() => this._ws_connect(), 10000);
            delete this._ws;
        };

        ws.onerror = () => ws.close();
    }

    _ws_send(msg: WireMessageBatch): void {
        if (!this._ws)
            // TODO: Throw an err?
            return;

        try {
            this._ws.send(JSON.stringify(msg));
        } catch (e) {
            // Socket may have disconnected or something - FF throws NS_ERROR_NOT_CONNECTED for example
            this._ws.onerror?.(new Event('error'));
        }
    }

    _get_time_skew_event(): WireMessage {
        return [0, 0, 'time', Date.now()];
    }

    _process_responses(msgs: WireMessageBatch): void {
        const completed_msgs: Record<number, EventData[]> = {};

        msgs.forEach((raw) => {
            // Each message response is an array containing the response id followed by any data for callbacks etc...
            const [rid, ...msg] = [...raw];

            // Process any notifications first
            if (msg[0] && msg[0] === '_not') {
                const channel = msg[1] as string;
                const data = msg[2];
                const info = this._listeners[channel];
                if (info && info.callback) info.callback(data, channel);
            } else {
                completed_msgs[rid] = msg;
            }
        });
        Object.values(this.queues).forEach((q) => {
            q.items = q.items.filter((item) => (item.rid ? !completed_msgs[item.rid] : true));
        });
        this._save_queues();
    }

    _purge_queues(): void {
        const now = Date.now();
        Object.values(this.queues).forEach((q) => {
            if (q.max_age > 0) q.items = q.items.filter((item) => now - item.ts < q.max_age * 1000);
        });
    }

    // Stuff to send at the beginning of a connection
    _generate_pubsub_to_send(): WireMessageBatch {
        const events: WireMessageBatch = [];
        for (const channel in this._listeners) {
            const listener = this._listeners[channel];
            events.push([0, 0, '_sub', [channel, listener.initial_query]]);
        }
        return events;
    }

    _generate_events_to_send(): WireMessageBatch {
        this._purge_queues();

        // Don't send items if they could be in-fly
        const now = Date.now();
        const to_send: WireMessageBatch = [];
        Object.values(this.queues).forEach((q) => {
            const items = q.items.filter((item) => !item.last_send || now - item.last_send > 30000);
            items.forEach((item) => {
                item.last_send = now;
                item.rid = this._id_counter++;
                to_send.push([item.rid, Date.now() - item.ts, q.name, item.item]);
            });
        });
        // order by the time they were generated
        return to_send.sort((a, b) => (b[1] as number) - (a[1] as number));
    }

    _ws_send_messages(): void {
        const events = this._generate_events_to_send();
        if (!events.length) return;

        this._ws_send(events);
    }

    _send_messages(): void {
        if (this._ws) this._ws_send_messages();
    }

    _fallback_maybe_send_messages(force = false): void {
        const now = Date.now();
        if (this._ws) return;

        if (!this._use_fallback && !force && now - this._last_ws_send < 120000)
            // 2 min timeout when failing over
            return;

        // If pubsub then send more frequently to poll-emulate the push- of websocket
        let events = this._generate_pubsub_to_send();
        const FALLBACK_SEND_FREQUENCY = force ? 100 : events.length ? 10000 : 30000;
        if (now - this._last_fallback_send < FALLBACK_SEND_FREQUENCY) return;

        events = events.concat(this._generate_events_to_send());
        if (!events.length) return;

        this._last_fallback_send = now;
        events.unshift(this._get_time_skew_event());
        fetch_json<{ completed?: EventData[] }>(this._fallback_endpoint, {
            method: 'POST',
            body: JSON.stringify({ events }),
        }).then((ret) => this._process_responses((ret.completed ?? []) as WireMessageBatch));
    }

    // Create a queue for the server
    // max_age is how long the items should last for. -1 means keep forever, 0
    // means not to store between session runs, other values mean max number of
    // seconds to save the item for.
    add_queue<T = EventData>(name: string, max_items = 100, max_age = -1): (item: T, dup_key?: DupKey) => void {
        if (this.queues[name]) throw new Error(`Queue ${name} already created`);

        const queue: QueueState<T> = {
            name,
            items: [],
            max_age,
            max_items,
        };
        this.queues[name] = queue as QueueState<unknown>;

        // Load old values from storage if we want
        const old = persistentStorage.getObj<Record<string, QueueState<T>>>(this._storage_key);
        if (old && old[name] && Array.isArray(old[name].items)) queue.items = old[name].items;

        return (item: T, dup_key?: DupKey) => this._add_item(name, item, dup_key);
    }

    register_listener<T = unknown>(channel: string, callback: (data: T, channel?: string) => void, initial_query: Record<string, unknown> = {}): void {
        this.unregister_listener(channel); // ensure we only have one at a time

        this._listeners[channel] = { initial_query, callback: callback as ListenerCallback };

        // If we are connected to websocket then send as a request straight
        // away, otherwise _generate_pubsub_to_send will send at beginning of
        // new connection. Otherwise trigger an XHR request straight away which
        // will do the equivelent of a single poll
        if (this._ws) this._ws_send([[0, 0, '_sub', [channel, initial_query]]]);
        else {
            // debounce multiple registrations at the same time
            if (this._register_fallback_debounce) clearTimeout(this._register_fallback_debounce);
            this._register_fallback_debounce = window.setTimeout(() => this._fallback_maybe_send_messages(true), 200);
        }
    }

    unregister_listener(channel: string): void {
        if (this._ws) {
            const listener = this._listeners[channel];
            if (listener) this._ws_send([[0, 0, '_unsub', [channel]]]);
        }

        delete this._listeners[channel];
    }

    _add_item<T>(queue: string, item: T, dup_key?: DupKey): void {
        const q = this.queues[queue];
        if (!q) throw new Error(`Queue ${queue} not registered`);

        const new_item: QueueItem = {
            ts: Date.now(),
            item,
        };
        if (dup_key !== undefined) {
            new_item.dup_key = dup_key;

            // Remove any current duplicates
            q.items = q.items.filter((existing) => existing.dup_key === undefined || existing.dup_key !== dup_key);
        }

        q.items.push(new_item);
        while (q.items.length > q.max_items)
            // keep the queue the correct size
            q.items.shift();
        this._new_items();
    }

    _new_items() {
        this._send_messages();
        this._save_queues();
    }

    _save_queues(): void {
        // Don't save queues that should not be persisted
        const to_save: Partial<QueueMap> = {};
        for (const name in this.queues) {
            const queue = this.queues[name];
            if (queue.max_age !== 0 && queue.items.length > 0) to_save[name] = queue;
        }
        persistentStorage.setObj(this._storage_key, to_save);
    }
}

export const eventSocket = new EventSocket();
