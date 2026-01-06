import * as StackTrace from 'stacktrace-js';
import { DB_AVAILABLE } from './db';
import { eventSocket } from './event-socket';
import { app_lang } from './langpack';
import { persistentStorage } from './persistent-storage.es5';

const app_start_time = Date.now();
const _send_error_report = eventSocket.add_queue('error');

type ErrorReport = Record<string, unknown>;
export type ErrorObject = unknown;

let send_report = (error_report: ErrorReport): void => {
    if (DEBUG) console.error(error_report);
    else _send_error_report(error_report);
};

export function send_error_report(type: string, error_obj: ErrorObject, error_report: ErrorReport = {}): void {
    error_report.type = type;
    error_report.error_obj = error_obj;
    error_report.v = APP_VERSION;
    error_report.b = BUILD_TYPE;
    error_report.l = window.location.href;
    error_report.run_s = Math.floor((Date.now() - app_start_time) / 1000);

    if (persistentStorage) error_report.s = persistentStorage.type();

    try {
        error_report.ui = app_lang();
        DB_AVAILABLE.then((db) => (error_report.db = db.type())); // in startup this will not have anything, but otherwise should run inline

        if (!error_report.msg && (typeof error_obj === 'object' || typeof error_obj === 'function') && error_obj && 'toString' in error_obj) {
            error_report.msg = (error_obj as { toString(): string }).toString();
        }
    } catch (e) {
        // ignore errors in the error handler when trying to fetch more info...
        console.log('error creating report', e);
    }

    if (error_obj) {
        StackTrace.fromError(error_obj as Error).then(
            (frames) => {
                error_report.frames = frames.map((f) => f.toString());
                send_report(error_report);
            },
            (err) => {
                error_report.failure_msg = err.toString();
                send_report(error_report);
            },
        );
    } else send_report(error_report);
}

// Global handler to report unhandled errors
export function setup_error_catcher(): void {
    window.onerror = (msg: string | Event, file?: string, line?: number, col?: number, error_obj?: Error) => {
        send_error_report('unhandled', error_obj ?? msg, { msg, file, line, col });
    };
}
