// This doesn't work because we need abcsf2 as window. to be able to handle the loading
//import { Audio5 } from 'abc2svg/snd';

import * as Comlink from 'comlink';
import type { AbcRenderRequest, AbcRenderResult, AbcRenderer } from './abc2svg-renderer';
import { timeout } from './util';

// The below inlining is used to try to fix a cordova problem with inability to load workers via file:// protocol which
// used to work but never should have. The true solution rather than inlining is to set cordova <content
// src="https://localhost/index.html" /> but this will loose localStorage (ie set lists) which is probably more
// important than this.
//
// TODO: This causes the entirety of abc2svg to be inlined into the main js file which is not great for size.
import AbcWorker from './abc2svg.worker?worker&inline';

// Safari needs horrible hacks to make sound play. The standard AudioContext
// play-on-click sets it to running but no sound comes unless you have already
// played an mp3...
let fake_audio_elem: HTMLAudioElement | null | undefined;
let setup_fake_audio_elem: () => boolean = () => false;
if (BUILD_TYPE != 'chrome' && BUILD_TYPE != 'edge' && navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1) {
    setup_fake_audio_elem = () => {
        if (!fake_audio_elem) {
            try {
                fake_audio_elem = document.createElement('audio');
                document.body.appendChild(fake_audio_elem);
                fake_audio_elem.src = 'silence.mp3';
            } catch (e) {
                // ignore errors such as 'Not Implemented' on some browsers'
            }
        }
        return true;
    };
}

export function setup_abc2svg() {
    // Fake abc2svg... loadjs not needed at present but perhaps will be in future
    /*
    window.abc2svg = {};
    window.abc2svg.loadjs = function(fn, relay, onerror) {
        let s = document.createElement('script');
        s.src = fn;
        s.type = 'text/javascript'
        if (relay)
            s.onload = relay;
        s.onerror = onerror || function() {
            console.log('error loading ', fn)
        }
        document.head.appendChild(s)
    };
    */

    // Needs doing here to precache the mp3 audio or something
    setup_fake_audio_elem();
}

let abcWorker: Comlink.Remote<AbcRenderer> | false | undefined;
// TODO: Switch this to rxjs so a failure will just remove the button from the FE immediately
let _can_do_worker = 'Worker' in window;

type AbcErrorMsg = unknown;
type AbcErrorReason = unknown;

export class ABC {
    private _current_audio: Float32Array[] = [];
    private _active_notes: Record<string, number> = {};
    private abc_set_note: (note_id: string, is_start: boolean) => void;
    private on_instrument_loading: (loading: boolean) => void;
    private _last_play_pos = 0;
    private _playing = false;
    private _abc_play:
        | {
              play: (startIndex: number, endIndex: number, notes: Float32Array[]) => void;
              stop: () => void;
          }
        | false;

    constructor(abc_set_note: (note_id: string, is_start: boolean) => void = () => {}, on_instrument_loading: (loading: boolean) => void = () => {}) {
        this.abc_set_note = abc_set_note || (() => {});
        this.on_instrument_loading = on_instrument_loading || (() => {});
        this._abc_play = !window.Audio5({}).get_outputs()
            ? false
            : window.Audio5({
                  gain: 0.7,
                  speed: 1,
                  errmsg: (msg: AbcErrorMsg) => {
                      console.log('audio play issue', msg);
                  },
                  instr_load: (instr: string, done: (data: Uint8Array) => void, fail: (reason?: AbcErrorReason) => void) => {
                      // window.fetch is not supported on ie or ios < 10.3. Cordova for android at least doesn't support
                      // fetch() for file: urls
                      // TODO: Port to fetch_json
                      const loadPromise: Promise<ArrayBuffer> =
                          !window.fetch || window.location.protocol == 'file:'
                              ? new Promise((res, rej) => {
                                    let req = new window.XMLHttpRequest();
                                    req.onload = () => {
                                        if (req.status < 200 || req.status >= 300) return rej();
                                        /* To support ie9 etc we should use the below
                                        let data = req.responseText;
                                        let buf = new window.ArrayBuffer(data.length);
                                        let arr = new window.Uint8Array(buf);
                                        for( let i = 0; i < data.length; i++ )
                                            arr[i] = data.charCodeAt(i) & 0xff;
                                        res(arr);
                                            */
                                        res(req.response);
                                    };
                                    req.open('GET', `sf2/${instr}.sf2`);
                                    //req.overrideMimeType('text/plain; charset=x-user-defined');   // ie9
                                    req.responseType = 'arraybuffer';
                                    req.send();
                                })
                              : window.fetch(`sf2/${instr}.sf2`).then((data) => data.arrayBuffer());

                      this.on_instrument_loading(true);
                      loadPromise.then((data) => done(new window.Uint8Array(data)), fail).finally(() => this.on_instrument_loading(false));
                  },
                  onnote: (note_id: number, is_start: boolean) => {
                      if (!this._playing) return;

                      this._last_play_pos = note_id;
                      this.abc_set_note(String(note_id), is_start);

                      const noteKey = String(note_id);
                      if (is_start) this._active_notes[noteKey] = 1;
                      else delete this._active_notes[noteKey];
                  },
              });
    }

    toggle_playing(play: boolean = !this._playing) {
        if (!this._abc_play) return;

        this._playing = play;

        // TODO: Capture plays/pauses as a stat
        if (play) {
            if (setup_fake_audio_elem()) {
                fake_audio_elem?.play();

                // Try to remove it to stop it from displaying on the iphone lock
                // screen (unless audiocontext is running)
                setTimeout(() => {
                    if (!fake_audio_elem)
                        // may have been called multiple times
                        return;
                    fake_audio_elem!.pause();
                    fake_audio_elem!.remove();
                    fake_audio_elem = null;
                }, 50);
            }

            // Cancel active any notes from the pause
            for (let note_id in this._active_notes) this.abc_set_note(note_id, false);

            // in _current_audio [0] is index, [1] is
            // start time (in seconds) so we can actually seek to a certain
            // position in the music by just splicing the list
            const notes = this._current_audio;
            let start_pos = 0;

            // convert the last position note id into the note in the play routine and then rewind a little
            if (this._last_play_pos) {
                // Find the note
                let note_offset: number | undefined;
                for (let i = 0; i < notes.length; i++) {
                    if (notes[i][0] == this._last_play_pos) {
                        note_offset = i;
                        break;
                    }
                }
                if (note_offset !== undefined) {
                    // go back to the first note played at t-3
                    const seek_time = Math.max(0, notes[note_offset][1] - 3);
                    for (let i = note_offset; i >= 0; i--) {
                        if (notes[i][1] < seek_time) {
                            start_pos = i + 1;
                            break;
                        }
                    }
                }
            }

            this._abc_play.play(start_pos, 100000, notes);
        } else this._abc_play.stop();
    }

    reset_play_position() {
        this._last_play_pos = 0;
    }

    set_audio(audio: Float32Array[] = []) {
        this.reset_play_position();
        this._current_audio = audio;
    }

    async abc_render(details: AbcRenderRequest): Promise<AbcRenderResult> {
        console.log('abc_render', details, abcWorker);
        if (abcWorker === undefined) {
            let _worker: Worker | undefined;
            try {
                _worker = new AbcWorker();
            } catch (e) {
                // ignore issues loading worker per below - just disable it
                console.warn('error loading abc worker', e);
            }

            if (_worker) {
                abcWorker = Comlink.wrap<AbcRenderer>(_worker);

                // Give 2s for it to load and start up correctly
                try {
                    await timeout(abcWorker.ping(), 2000);
                } catch (_) {
                    console.warn('timeout loading abc worker');
                    abcWorker = false; // don't try calling it again
                    _can_do_worker = false;
                }
            } else {
                abcWorker = false; // don't try calling it again
                _can_do_worker = false;
            }
        }

        if (!_can_do_worker || !abcWorker) throw new Error('Worker not available');

        // To avoid worker load hangs etc just timeout the call after a bit
        return await timeout(abcWorker.abc_render(details), 1000);
    }
}

export const can_do_worker = () => _can_do_worker;
