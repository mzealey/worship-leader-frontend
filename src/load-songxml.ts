import { get_translation } from './langpack';
import { get_setting, is_set } from './settings';
import { maybe_convert_solfege } from './solfege-util';
import { set_direction } from './songlist';
import { format_html_chords, songxml_to_divs } from './songxml-util';
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
    if (show_chords) {
        // split into multiple chord blocks so each only has 1 chord in it. We
        // do this simalar to the songxml_to_divs() function, but as that is
        // shared with the editor we don't want to split there to make it
        // easier to edit correctly.
        content = content.replace(/(<chord>)(.*?)(<\/chord>)/gi, (match, start, chord_content, end) => {
            return chord_content
                .replace(/\u202D/g, '') // Hopefully no zwj's in here yet.
                .replace(/^\s+|\s+$/g, '') // kill spacing
                .split(/\s+/)
                .map((chord) => `${start}${chord}${end}`)
                .join('');
        });
    }

    /*
    if( is_copyright(songdata) ) {
        // Mask copyrighted songs on builds, but not on the web version as we can't
        // get delisted for copyrighted content there.
        content = $('<b>').text( get_translation('copyright_no_show') );
        show_chords = false;
    } else */
    content = songxml_to_divs(content, !show_chords, get_setting('setting-chord-color')) || '<b>' + get_translation('nolyrics') + '</b>';

    songxml.empty().toggleClass('showchords', show_chords).html(content).data('songdata', songdata);

    // Hack to allow the printed from to apply properly
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

        // Map # and &/b into sharp/flat symbols
        chord = chord.replace(/[&b]/, '\u266D').replace(/#/, '\u266F');

        // Ensure each chord has 1 and 1 only utf8 ltr forcer
        el.text('\u202D' + maybe_convert_solfege(chord));
    });

    // Width of chords may have changed - re-do the space stuff
    format_html_chords(songxml);
}
