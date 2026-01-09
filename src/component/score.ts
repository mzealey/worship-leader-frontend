import { ABC } from '../abc2svg';
import { type AbcRenderRequest } from '../abc2svg-renderer';
import { DEBUG } from '../globals';
import { _load_songxml_into } from '../load-songxml';
import { ensure_visible } from '../util';
import { hide_spinner, show_spinner } from './spinner';

export function init_sheet_music() {
    const elem = $('.sheet-music').empty();

    const get_abc = (): ABC | undefined => elem.data('ABC');

    elem.on('click', () => get_abc()?.toggle_playing());

    let timer;
    const clear_timer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    const long_press = () => {
        clear_timer();
        const abc = get_abc();
        if (!abc) return;
        abc.toggle_playing(false);
        abc.reset_play_position();
        abc.toggle_playing(true);
    };

    elem.on('contextmenu', (e) => {
        // right click / long-press on chrome and sensible browsers
        long_press();
        e.preventDefault();
        return false;
    });

    // Long-press on safari. NOTE: runs muted if you use long-press to trigger
    // the first play on the page as the timeout triggers the .play event
    // (which loads audiocontext) rather than a direct user action...
    let timer_ran;
    elem.on('touchstart', () => {
        timer_ran = 0;
        if (!timer) {
            timer = setTimeout(() => {
                timer_ran = 1;
                long_press();
            }, 1000);
        }
    });
    elem.on('touchend', (e) => {
        clear_timer();
        if (timer_ran) {
            e.preventDefault();
            return false;
        }
    });
}

// Given an abc file, render as SVG
export async function load_score_into(elem, abc_score, songdata, requested_width?) {
    elem.addClass('showing-score').removeClass('showing-songxml').data('songdata', songdata).data('abc', abc_score);

    let sheet_elem = elem.find('.sheet-music').empty();

    elem.find('.songxml').empty();

    const abc = new ABC(
        (note_id: string, is_start: boolean) => {
            let $note = sheet_elem.find('svg #i' + note_id);
            let note = $note.get(0);
            if (note) {
                note.style.fillOpacity = is_start ? 0.4 : 0;
                if (is_start) ensure_visible($note.parents('svg'));
            }
        },
        (loading: boolean) => {
            (loading ? show_spinner : hide_spinner)();
        },
    );
    sheet_elem.data('ABC', abc);

    let render_params: AbcRenderRequest = {
        abc: abc_score,

        // If sheet_elem is not displayed (which should never happen but might
        // if we had a display: none somewhere that shouldn't be) then estimate
        // from browser window width...
        width: requested_width || sheet_elem.width() * 1.25 || $(window).width(),
    };

    let details = $('#primary-song').data('keychange');
    if (details) render_params.delta = details.delta;

    // TODO: Handle timeout if web worker load failed for some reason as not always reflected correctly
    const res = await abc.abc_render(render_params);
    abc.set_audio(res.audio);

    let start = Date.now();
    sheet_elem.html(res.svg);
    if (DEBUG) console.log('rendering svg took', Date.now() - start, 'ms');

    // Restore the songxml after if we don't have any words (eg for translated ones)
    if (!/\n[wW]:/.test(abc_score)) _load_songxml_into(elem, songdata, 1);
}
