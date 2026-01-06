import '../main.scss';

// This is loaded either as a remote presentation OR as an iframe embedded in
// the main page to mirror what is on the screen during that presentation.
//
// Either way we don't have jquery or any other libraries loaded here.

interface MessageData {
    vertical?: boolean;
    html?: string;
    zoom?: string | number;
    scrollX?: number;
    scrollY?: number;
    width?: number;
    height?: number;
}

function set_html(html: string): void {
    const songxml = document.getElementById('songxml');
    if (songxml) {
        songxml.innerHTML = html;
    }
}

let is_vertical: boolean | undefined;
function handle_message_common(data: MessageData): void {
    const songxml = document.getElementById('songxml');
    if (!songxml) return;

    if ('vertical' in data) {
        is_vertical = data.vertical;
        songxml.classList.toggle('vertical-lr', !!is_vertical);
        document.documentElement.classList.toggle('vertical', !!is_vertical);
    }

    if ('html' in data) set_html(data.html!);

    if ('zoom' in data) songxml.className = songxml.className.replace(/\s*\bzoom-[\d-]+/g, '') + ` zoom-${data.zoom}`;
}

abstract class CastCommon {
    connections: any[];
    abstract _send_update(connection: any, to_send: string): void;

    constructor() {
        this.connections = [];
        document.documentElement.classList.add('presentation-cast');
        window.addEventListener('resize', () => this.connections.forEach((connection) => this.send_update(connection)));
    }

    send_update(connection: any): void {
        const to_send = JSON.stringify({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        this._send_update(connection, to_send);
    }

    handle_message(msg: string): void {
        const data: MessageData = JSON.parse(msg);
        handle_message_common(data);

        // NOTE that in ios simulator you need to do some other interaction
        // (like flick to elements panel) to get the render done on this so it
        // looks like sometimes it does not work but it does really...
        if ('scrollX' in data || 'scrollY' in data) window.scrollTo(data.scrollX || 0, data.scrollY || 0);
    }
}

class CastW3C extends CastCommon {
    constructor() {
        super();

        navigator.presentation.receiver.connectionList.then((list: any) => {
            list.connections.map((connection: any) => this.add_connection(connection));
            list.addEventListener('connectionavailable', (event: any) => this.add_connection(event.connection));
        });
    }

    add_connection(connection: any): void {
        this.connections.push(connection);
        connection.addEventListener('message', (event: any) => this.handle_message(event.data));
        this.send_update(connection);

        // NOTE: These listeners don't seem to be called generally unfortunately.
        const remove_connection = (): void => {
            this.connections = this.connections.filter((c) => c != connection);
            if (!this.connections.length) set_html(''); // blank screen on disconnect
        };
        connection.addEventListener('close', remove_connection);
        connection.addEventListener('terminate', remove_connection);
    }

    _send_update(connection: any, to_send: string): void {
        try {
            connection.send(to_send);
        } catch (e) {
            // ignore any issues with sending the data eg if connection was closed
        }
    }
}

class CastCordova extends CastCommon {
    constructor() {
        super();

        navigator.presentation.onpresent = (e: any) => {
            this.connections = [e.session];
            e.session.onstatechange = function (this: any): void {
                if (this.state == 'disconnected') {
                    this.connections = [];
                    set_html('');
                }
            };
            e.session.onmessage = (msg: string) => this.handle_message(msg);
            // Send the update out-of-band as it appears if we send it straight
            // off it doesnt get through.
            setTimeout(() => this.send_update(e.session));
        };
    }

    _send_update(connection: any, to_send: string): void {
        connection.postMessage(to_send);
    }
}

class CastWindow extends CastCommon {
    constructor() {
        super();

        this.connections = [window.opener];
        window.addEventListener('message', (event: MessageEvent) => {
            if ('string' != typeof event.data) return;

            this.handle_message(event.data);
        });
        // Send the update out-of-band as it appears if we send it straight
        // off it doesnt get through.
        setTimeout(() => this.send_update(window.opener));
    }

    _send_update(connection: any, to_send: string): void {
        connection.postMessage(to_send, '*');
    }
}

class IFrameWindow {
    constructor() {
        document.documentElement.classList.add('presentation-iframe');

        let last_width = 0;
        let last_height = 0;

        window.addEventListener('message', (event: MessageEvent) => {
            if ('string' != typeof event.data) return;

            const msg: MessageData = JSON.parse(event.data);
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
    if (inIframe()) new IFrameWindow();
    else if (window.opener) new CastWindow();
    else if (navigator.presentation && navigator.presentation.receiver) new CastW3C();
});

if (BUILD_TYPE == 'phonegap') {
    // window.cordova doesnt exist in this context so can't use is_cordova
    document.addEventListener('deviceready', () => {
        if (navigator.presentation) new CastCordova();
    });
}
