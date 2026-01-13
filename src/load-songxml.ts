import { get_translation } from './langpack';
import { get_setting, is_set } from './settings';
import { set_direction } from './songlist';
import { format_html_chords, render_chord, songxml_to_divs, split_songxml_chords } from './songxml-util';
import { Transpose } from './transpose';
import { is_rtl } from './util';

export function load_songxml_into(elem, songdata, force_chords_off?) {
    elem.removeClass('showing-score').addClass('showing-songxml');
    _load_songxml_into(elem, songdata, force_chords_off);
}

export function _load_songxml_into(elem, songdata, force_chords_off?) {
    let songxml = elem.find('.songxml');
    songxml.toggleClass('setting-show-fingering', is_set('setting-show-fingering'));
    // No chords in the songs or we don't want them displayed
    let show_chords = !!(!force_chords_off && /<chord>/i.test(songdata.songxml) && is_set('setting-display-chords'));

    let content = songdata.songxml;
    if (show_chords) content = split_songxml_chords(content);

    /*
    if( is_copyright(songdata) ) {
        // Mask copyrighted songs on builds, but not on the web version as we can't
        // get delisted for copyrighted content there.
        content = $('<b>').text( get_translation('copyright_no_show') );
        show_chords = false;
    } else */
    content = songxml_to_divs(content, !show_chords, get_setting('setting-chord-color')) || '<b>' + get_translation('nolyrics') + '</b>';

    songxml.empty().toggleClass('showchords', show_chords).html(content).data('songdata', songdata);

    // Hack to allow the printed form to apply properly
    $('#main-page')
        .toggleClass('song-rtl', is_rtl(songxml.text()))
        .toggleClass('song-vertical', songdata.lang == 'mn-TR');

    set_direction(songxml, songdata.lang, true);
    songxml.find('.chord').each((i, e) =>
        $(e).data(
            'chord',
            $(e)
                .text()
                .replace(/\u202D/g, ''),
        ),
    );
    songxml.find('.chord').parents('.bridge, .chorus, .verse, .prechorus').addClass('has-chords');

    if (!show_chords) return;

    render_chords(elem);
}

let trans = new Transpose();
export function render_chords(elem) {
    let songxml = elem.find('.songxml');
    let details = $('#primary-song').data('keychange') || {};

    songxml.find('.chord').each((i, el) => {
        el = $(el);
        let chord = trans.getNewChord(el.data('chord'), (details.delta || 0) - (details.capo || 0) + (details.song_capo || 0), details.key, details.is_minor);
        el.data('cur_chord', chord); // for fingering to use

        el.text(render_chord(chord));
    });

    // Width of chords may have changed - re-do the space stuff
    format_html_chords(songxml);
}
