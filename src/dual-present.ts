// For debugging
const DEBUG_SINGLE_SCREEN = DEBUG && 0; // run presentation in popup window

// TODO: Add Comlink to make this a lot simpler?
import { Subject } from 'rxjs';
import { create } from 'zustand';
import { eventSocket } from './event-socket';
import { is_chrome_extension, is_cordova } from './util';

const send_available_event = eventSocket.add_queue('cast-available', 5, 7 * 24 * 60 * 60);
const send_active_event = eventSocket.add_queue('cast-active', 10, 7 * 24 * 60 * 60);

interface Cast {
    supported: boolean;
    available: boolean;
    active: boolean;
    set: (newState: Cast) => void;
}
export const useCast = create<Cast>((set) => ({
    supported: false,
    available: false,
    active: false,
    set: (newState: Cast) => set({ ...newState }),
}));

type Connection = unknown;

type CastSize = { width: number; height: number };

type PresentationMessageData = unknown;

interface PresentationState {
    cast_available?: boolean;
    cast_active?: boolean;
    cast_size?: CastSize;
    songxml_request?: boolean;
}

interface PresentationAvailability {
    value: boolean;
    onchange: (() => void) | null;
}

interface PresentationConnectionAvailableEvent extends Event {
    connection: PresentationSession;
}

interface PresentationRequest {
    getAvailability(): Promise<PresentationAvailability>;
    addEventListener(type: string, listener: (event: PresentationConnectionAvailableEvent) => void): void;
    start(): Promise<Connection>;
}

interface PresentationSession extends EventTarget {
    state: string;
    onstatechange: ((this: PresentationSession, ev: Event) => any) | null;
    onmessage: ((this: PresentationSession, ev: MessageEvent) => any) | null;
    close(): void;
    terminate(): void;
    send(data: string): void;
    postMessage(message: unknown): void; // Cordova specific
}

export abstract class PresentationCommon {
    cast_available: boolean = false;
    cast_active: boolean = false;
    cast_size: CastSize | undefined;

    subject = new Subject<PresentationState>();
    _connection: PresentationSession | Window | null = null;
    private connection_had_msg: boolean = false;

    constructor() {
        useCast.setState({ supported: true });
    }

    set_cast_availability(val: boolean) {
        this.cast_available = val;
        send_available_event(val ? 1 : 0);
        this.subject.next({ cast_available: val });
        console.log('cast available', this.cast_available);
    }

    handle_connect() {
        this.cast_active = true;
        send_active_event(1);
        this.subject.next({ cast_active: true });
    }

    handle_close() {
        this._connection = null;
        this.connection_had_msg = false;
        this.cast_active = false;
        send_active_event(0);
        this.subject.next({ cast_active: false });
    }

    handle_message(msg: string) {
        if (this._connection) {
            if (!this.connection_had_msg) {
                this.subject.next({ songxml_request: true });
            }
            this.connection_had_msg = true;
        }

        let data: { width?: number; height?: number } | undefined;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            return;
        }
        const { width, height } = data ?? {};
        if (height && width) {
            this.cast_size = { width, height };
            this.subject.next({ cast_size: this.cast_size });
        }
    }

    is_casting() {
        return !!this._connection;
    }

    abstract _close(): void;
    abstract _send_msg(data: string): void;
    abstract enter_cast_mode(): void;

    close() {
        if (this._connection) {
            this._close();
            this.handle_close(); // should be triggered anyway but do here to make sure
        }
    }

    send_msg(data: PresentationMessageData) {
        //console.log('sending', data);
        if (this._connection) {
            const state = 'state' in this._connection ? this._connection.state : 'connected'; // Window is always connected
            if (state == 'connected') this._send_msg(JSON.stringify(data));
        }
    }

    exit_cast_mode() {
        if (this._connection) {
            // Doesn't seem to detect the close/terminate event all the time
            // unfortunately so send a close message
            this.send_msg({ close: 1, html: '' });

            this.close();
        }
    }
}

class PresentationW3C extends PresentationCommon {
    request: PresentationRequest;

    constructor(request: PresentationRequest) {
        super();

        this.request = request;

        (navigator as unknown as { presentation: { defaultRequest: PresentationRequest } }).presentation.defaultRequest = this.request; // hook into the cast functionality in chrome

        this.request.getAvailability().then(
            (availability) => {
                this.set_cast_availability(availability.value);
                availability.onchange = () => this.set_cast_availability(availability.value);
            },
            () => {
                // Monitoring for availability is not supported - assume it is available and prompt later...
                this.set_cast_availability(true);
            },
        );

        this.request.addEventListener('connectionavailable', (event) => {
            this._connection = event.connection as PresentationSession;
            this._connection!.addEventListener('connect', () => this.handle_connect());
            this._connection!.addEventListener('close', () => this.handle_close());
            this._connection!.addEventListener('terminate', () => this.handle_close());
            this._connection!.addEventListener('message', ((evt: MessageEvent) => this.handle_message(evt.data as string)) as EventListener);
        });
    }

    _close() {
        (this._connection as PresentationSession).terminate();
    }

    _send_msg(str: string) {
        (this._connection as PresentationSession).send(str);
    }

    enter_cast_mode() {
        this.request.start().then(
            (connection: Connection) => console.log('connected to', connection),
            () => {}, // ignore errs
        );
    }
}

class PresentationCordova extends PresentationCommon {
    constructor() {
        super();
        (navigator as unknown as { presentation: { onavailablechange: (ev: { available: boolean }) => void } }).presentation.onavailablechange = (ev) =>
            this.set_cast_availability(ev.available);
    }

    _close() {
        (this._connection as PresentationSession).close();
    }

    _send_msg(str: string) {
        (this._connection as PresentationSession).postMessage(str);
    }

    enter_cast_mode() {
        let c = (this._connection = (
            navigator as unknown as { presentation: { requestSession: (url: string) => PresentationSession } }
        ).presentation.requestSession('presentor.html') as PresentationSession);
        c.onmessage = (msg: MessageEvent) => this.handle_message(msg.data);
        c.onstatechange = () => {
            if (c.state == 'connected') this.handle_connect();
            else if (c.state == 'disconnected') this.handle_close();
        };
    }
}

class PresentationWindow extends PresentationCommon {
    constructor() {
        super();
        this.set_cast_availability(true);
        window.addEventListener('unload', () => {
            this.close(); // close any presentations
        });

        window.addEventListener('message', (event) => {
            if ('string' != typeof event.data) return;

            if (!this._connection || event.source !== this._connection) return;

            this.handle_message(event.data);
        });

        setInterval(() => {
            if (this._connection && (this._connection as Window).closed) this.handle_close();
        }, 500);
    }

    _close() {
        (this._connection as Window).close();
    }

    _send_msg(str: string) {
        (this._connection as Window).postMessage(str, '*');
    }

    enter_cast_mode() {
        this._connection = window.open('presentor.html', 'presentor', 'scrollbars=no,status=no,location=no,toolbar=no,menubar=no');
        if (this._connection) {
            // popup may be blocked or something
            //this._connection.state = 'connected'; // Window doesn't have state
            this.handle_connect();
        }
    }
}

let _presentation: Promise<PresentationCommon> | undefined;
export function get_presentation(): Promise<PresentationCommon> {
    if (!_presentation) _presentation = init_casting();
    return _presentation;
}

async function init_casting(): Promise<PresentationCommon> {
    if (!DEBUG_SINGLE_SCREEN && window.PresentationRequest) {
        let request;
        try {
            // Chrome extension seems to need full path. The extension captures
            // this request and redirects it locally anyway. Filed bug report under
            // https://bugs.chromium.org/p/chromium/issues/detail?id=933681
            request = new window.PresentationRequest([is_chrome_extension() ? 'https://songs.worshipleaderapp.com/presentor.html' : 'presentor.html']);
        } catch (e) {
            // Really old chrome versions seem to have issues (eg 33 on android
            // 4.4 has PresentationRequest but it bombs out)
        }

        // The above returns an object on older chrome (eg 63) but
        // request.getAvailability is undefined and so bombs out.
        //
        // Not sure why but chrome 70 returned a Cannot set property
        // 'defaultRequest' of undefined issue so checking this as well...
        if (request && request.getAvailability && navigator.presentation) return new PresentationW3C(request);
    }

    if (is_cordova()) {
        return new Promise((resolve, reject) =>
            document.addEventListener('deviceready', () => {
                if (navigator.presentation) resolve(new PresentationCordova());
                else reject();
            }),
        );
    }

    // Option to do presentation in an external window in other browsers that
    // don't support PresentationRequest
    return new PresentationWindow();
}
