import { DB_AVAILABLE } from './db';
import { eventSocket } from './event-socket';
import { get_client_type } from './globals';
import { useAppLang } from './langpack';
import { persistentStorage } from './persistent-storage.es5';

export function setup_feedback_sender() {
    const send_usage_time = eventSocket.add_queue('usage', 1, 0);

    // Roughly track the amount of time the app has been used (in the foreground)
    let stored_track_time = persistentStorage.getObj<number>('usage-time', 0);
    let last_track_time = Date.now();
    setInterval(() => {
        const cur_time = Date.now();
        if (!document.hidden) {
            stored_track_time += Math.floor((cur_time - last_track_time) / 1000);
            persistentStorage.setObj('usage-time', stored_track_time);
        }
        last_track_time = cur_time;
    }, 5000);
    setInterval(() => send_usage_time(persistentStorage.getObj<number>('usage-time', 0)), 300000); // update usage time very occasionally

    const { appLang } = useAppLang.getState();
    // Send initial info about this app, give db and other systems like
    // app_lang time to init before sending this info
    DB_AVAILABLE.then((db) => {
        const send_initial_data = eventSocket.add_queue('initial', 1, 0);
        send_initial_data({
            ui: appLang,
            db: db.type(),
            w: window.innerWidth,
            h: window.innerHeight,
            u: persistentStorage.getObj('uses', 0),
            v: APP_VERSION,
            t: persistentStorage.getObj('usage-time', 0),
            c: get_client_type(),
        });
    });
}
