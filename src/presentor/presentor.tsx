import '../main.scss';

interface PresentationMessage {
    vertical?: boolean;
    html?: string;
    zoom?: string | number;
    scrollX?: number;
    scrollY?: number;
    width?: number;
    height?: number;
}

interface PresentationSession extends EventTarget {
    send(data: string): void;
    postMessage?(data: string): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<string>) => void): void;
    addEventListener(type: 'close' | 'terminate', listener: () => void): void;
    state?: string;
    onstatechange?: (() => void) | null;
    onmessage?: ((message: string) => void) | null;
}

interface PresentationConnectionEvent extends Event {
    connection: PresentationSession;
}

interface PresentationConnectionList {
    connections: PresentationSession[];
    addEventListener(type: 'connectionavailable', listener: (event: PresentationConnectionEvent) => void): void;
}

interface NavigatorPresentation {
    receiver?: {
        connectionList: Promise<PresentationConnectionList>;
    };
    onpresent?: (event: { session: PresentationSession }) => void;
}

// This is loaded either as a remote presentation OR as an iframe embedded in
// the main page to mirror what is on the screen during that presentation.
//
// Either way we don't have any libraries loaded here.
function set_html(html: string): void {
    const elem = document.getElementById('songxml');
    if (elem) elem.innerHTML = html;
}

let is_vertical = false;
function handle_message_common(data: PresentationMessage): void {
    const songxml = document.getElementById('songxml');
    if (songxml && 'vertical' in data) {
        is_vertical = !!data.vertical;
        songxml.classList.toggle('vertical-lr', !!is_vertical);
        document.documentElement.classList.toggle('vertical', !!is_vertical);
    }

    if (typeof data.html === 'string') set_html(data.html);

    if (songxml && data.zoom !== undefined) songxml.className = songxml.className.replace(/\s*\bzoom-[\d-]+/g, '') + ` zoom-${data.zoom}`;
}

abstract class CastCommon<TConnection> {
    protected connections: TConnection[];

    constructor() {
        this.connections = [];
        document.documentElement.classList.add('presentation-cast');
        window.addEventListener('resize', () => this.connections.forEach((connection) => this.send_update(connection)));
    }

    send_update(connection: TConnection): void {
        let to_send = JSON.stringify({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        this._send_update(connection, to_send);
    }

    // Implement in subclass
    protected abstract _send_update(connection: TConnection, to_send: string): void;

    handle_message(msg: string): void {
        const data = JSON.parse(msg) as PresentationMessage;
        handle_message_common(data);

        // NOTE that in ios simulator you need to do some other interaction
        // (like flick to elements panel) to get the render done on this so it
        // looks like sometimes it does not work but it does really...
        if (data.scrollX !== undefined || data.scrollY !== undefined) window.scrollTo(data.scrollX ?? 0, data.scrollY ?? 0);
    }
}

class CastW3C extends CastCommon<PresentationSession> {
    constructor() {
        super();

        const presentation = navigator.presentation as NavigatorPresentation | undefined;
        const receiver = presentation?.receiver;
        receiver?.connectionList.then((list) => {
            list.connections.forEach((connection) => this.add_connection(connection));
            list.addEventListener('connectionavailable', (event: PresentationConnectionEvent) => this.add_connection(event.connection));
        });
    }

    private add_connection(connection: PresentationSession): void {
        this.connections.push(connection);
        connection.addEventListener('message', (event: MessageEvent<string>) => this.handle_message(event.data));
        this.send_update(connection);

        // NOTE: These listeners don't seem to be called generally unfortunately.
        const remove_connection = () => {
            this.connections = this.connections.filter((c) => c != connection);
            if (!this.connections.length) set_html(''); // blank screen on disconnect
        };
        connection.addEventListener('close', remove_connection);
        connection.addEventListener('terminate', remove_connection);
    }

    protected _send_update(connection: PresentationSession, to_send: string): void {
        try {
            connection.send(to_send);
        } catch (e) {
            // ignore any issues with sending the data eg if connection was closed
        }
    }
}

class CastCordova extends CastCommon<PresentationSession> {
    constructor() {
        super();

        const presentation = navigator.presentation as NavigatorPresentation | undefined;
        if (!presentation) return;

        presentation.onpresent = (event) => {
            const session = event.session;
            this.connections = [session];
            session.onstatechange = () => {
                if (session.state === 'disconnected') {
                    this.connections = [];
                    set_html('');
                }
            };
            session.onmessage = (msg) => {
                this.handle_message(msg);
            };
            // Send the update out-of-band as it appears if we send it straight
            // off it doesnt get through.
            setTimeout(() => this.send_update(session));
        };
    }

    protected _send_update(connection: PresentationSession, to_send: string): void {
        connection.postMessage?.(to_send);
    }
}

class CastWindow extends CastCommon<Window> {
    constructor() {
        super();

        const opener = window.opener;
        if (!opener) return;

        this.connections = [opener];
        window.addEventListener('message', (event: MessageEvent<string>) => {
            if (typeof event.data !== 'string') return;

            this.handle_message(event.data);
        });
        // Send the update out-of-band as it appears if we send it straight
        // off it doesnt get through.
        setTimeout(() => this.send_update(opener));
    }

    protected _send_update(connection: Window, to_send: string): void {
        connection.postMessage(to_send, '*');
    }
}

class IFrameWindow {
    constructor() {
        document.documentElement.classList.add('presentation-iframe');

        let last_width = 0;
        let last_height = 0;

        window.addEventListener('message', (event: MessageEvent<string>) => {
            if (typeof event.data !== 'string') return;

            const msg = JSON.parse(event.data) as PresentationMessage;
            handle_message_common(msg);
            if ('vertical' in msg) last_width = 0; // force data refresh
        });

        // Only way I can really see to properly watch the height as it updates...
        // TODO: Skip on mobile safari as it automatically sets to 100% height...
        setInterval(() => {
            const height = document.documentElement.offsetHeight;

            // Nasty hack when in an iframe unfortunately :(
            const width = is_vertical ? 10000 : document.documentElement.offsetWidth;
            if (height != last_height || width != last_width) {
                window.parent.postMessage(JSON.stringify({ width, height }), '*');
                last_width = width;
                last_height = height;
            }
        }, 100);
    }
}

function inIframe(): boolean {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const presentation = navigator.presentation as NavigatorPresentation | undefined;
    if (inIframe()) new IFrameWindow();
    else if (window.opener) new CastWindow();
    else if (presentation?.receiver) new CastW3C();
});

if (BUILD_TYPE == 'phonegap') {
    // window.cordova doesnt exist in this context so can't use is_cordova
    document.addEventListener('deviceready', () => {
        const presentation = navigator.presentation as NavigatorPresentation | undefined;
        if (presentation) new CastCordova();
    });
}
