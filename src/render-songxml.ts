import { send_dual_present_song, update_presentation_view_size } from './component/dual-present';
import { load_score_into } from './component/score';
import { file_feedback, song_feedback } from './feedback';
import { current_page } from './jqm-util';
import { load_songxml_into } from './load-songxml';
import { is_set } from './settings';

let resized_for_print = false;
export function resize_for_print() {
    if (resized_for_print) return;

    // Show the score according to A4 format (lets say 1000px wide) on
    // small devices. Unfortunately screen width etc is maintained on
    // print so we need to fake it.
    //
    // Try to do this from the print button or before the media query triggers
    // so that page count is not affected by it, but worst-case do it from
    // within the media query so that the score is not rendered very large or
    // very small because it has been rendered according to the screen.
    if (current_page().is('#songinfo') && current_page().data('show-score')) {
        let songdata = current_page().data('song');
        let [abc_score] = (songdata.files || []).filter((file) => file.type == 'abccache');
        load_score_into($('#primary-song'), abc_score.abc, songdata, 1000);
        resized_for_print = true;

        return true;
    }
}

export function render_primary_songxml(songdata?, show_score?) {
    let page = $('#songinfo');
    resized_for_print = false;

    // May be called from a resize or so
    if (!page.is(current_page())) return Promise.reject();

    // re-render
    if (songdata === undefined) songdata = page.data('song');

    // If we had no song data we could still get called at page resize
    if (!songdata) return Promise.reject();

    if (show_score === undefined) show_score = page.data('show-score');
    else page.data('show-score', show_score);

    let pri_song = $('#primary-song');
    let display_lyrics = is_set('setting-display-lyrics');
    let copyright_restrict = 0; //is_copyright(songdata);
    if (copyright_restrict) show_score = false;
    pri_song
        .parents('.ui-content')
        .toggleClass('show-score', !!show_score)
        .toggleClass('show-lyrics', !show_score && display_lyrics)
        .toggleClass('hide-lyrics', !show_score && !display_lyrics)
        .toggleClass('is-copyright', !!copyright_restrict);

    pri_song.find('.sheet-music').data('ABC')?.toggle_playing(false);

    let promise;
    if (show_score) {
        song_feedback('sheet_view', songdata.id);
        let [abc_score] = (songdata.files || []).filter((file) => file.type == 'abccache');
        file_feedback('sheet_view', songdata.id, abc_score.id);

        promise = load_score_into(pri_song, abc_score.abc, songdata);
    } else if (display_lyrics) {
        load_songxml_into(pri_song, songdata);
        promise = Promise.resolve();
    }

    $('#chord_dropdown, #song-capo').toggleClass('hidden', !(show_score || pri_song.find('.songxml').hasClass('showchords')));

    send_dual_present_song();
    update_presentation_view_size(); // This fn is called by all resize events etc so capture it here

    return promise;
}
