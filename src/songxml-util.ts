import GraphemeSplitter from 'grapheme-splitter';
import { is_rtl, is_vertical } from './util';

let splitter = new GraphemeSplitter();

function preprocess_songxml(songxml: string): Document {
    // Handle repeats. Doesn't allow nesting unfortunately
    let last_count = 2;
    songxml = songxml.replace(/<\/?repeat([^>]*)>/gi, (match: string, capture: string) => {
        const is_close = /<\/repeat/.test(match);

        if (!is_close) {
            const [, count] = capture.match(/count=['"]?(\d+)/) || [];
            last_count = count ? parseInt(count, 10) : 2;
        }

        const str = '/'.repeat(last_count);
        return is_close ? ` ${str}` : `${str} `;
    });

    // Fix broken xml
    songxml = songxml.replace(/<br>/gi, '<br />');

    songxml = songxml.replace(/\n/g, '');
    return new window.DOMParser().parseFromString('<songxml>' + songxml + '</songxml>', 'text/xml');
}

export function convert_to_pre(songxml: string, opensong = false, without_chords = false): string {
    let cur_lyrics = '';
    let cur_chords = '';
    let out = '';
    let indent = '';
    const nl = '\n';
    const counter: Record<string, number> = {};

    const fill_char = opensong ? '_' : '-';

    const flush = () => {
        if (!without_chords && /\S/.test(cur_chords)) {
            out += (opensong ? '.' : '') + indent + cur_chords + nl;
            if (!cur_lyrics.length)
                // chords-only line
                cur_lyrics = ' ';
        }
        if (cur_lyrics !== '') out += (opensong ? ' ' : '') + indent + cur_lyrics + nl;

        cur_chords = '';
        cur_lyrics = '';
    };

    const doc = preprocess_songxml(songxml);

    Array.from(doc.querySelectorAll('songxml > *')).forEach((verse) => {
        if (verse.nodeType === Node.TEXT_NODE) return;
        if (opensong) {
            const type = verse.nodeName.toUpperCase().substring(0, 1);
            if (!counter[type]) counter[type] = 1;
            out += '[' + type + counter[type]++ + ']' + nl;
        }

        indent = verse.nodeName.toUpperCase() === 'VERSE' ? '' : '  ';

        Array.from(verse.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                cur_lyrics += child.textContent ?? '';
            } else {
                const element = child as Element;
                const nodeName = element.nodeName.toUpperCase();
                if (nodeName === 'BR') {
                    flush();
                } else if (nodeName === 'INDENT') {
                    cur_chords += '    ';
                    cur_lyrics += '    ';
                } else if (nodeName === 'CHORD' && /\S/.test(element.textContent ?? '') && !without_chords) {
                    const chord = (element.textContent ?? '').replace(/\s+/, ' ');

                    if (cur_lyrics.length) {
                        const length_diff = splitter.splitGraphemes(cur_lyrics).length - cur_chords.length;
                        if (cur_chords.length === 0 || length_diff > 0) {
                            cur_chords += ' '.repeat(length_diff);
                        } else {
                            const fill = /[ ,:.]$/.test(cur_lyrics) ? ' ' : fill_char;
                            const len = -length_diff + 1;
                            const extra_fill = fill === fill_char && len < 2 ? 1 : 0;

                            cur_chords += ' '.repeat(extra_fill + 1);
                            cur_lyrics += fill.repeat(len + extra_fill);
                        }
                    }
                    cur_chords += chord.replace('&', 'b');
                }
            }
        });
        flush();

        out += nl;
    });

    return out.replace(/\n+$/, '');
}

export function convert_to_elvanto(songxml: string, without_chords = false): string {
    let out = '';
    const nl = '\n';
    const counter: Record<string, number> = {};

    const doc = preprocess_songxml(songxml);
    Array.from(doc.querySelectorAll('songxml > *')).forEach((verse) => {
        if (verse.nodeType === Node.TEXT_NODE) return;

        const type = verse.nodeName.toLowerCase();
        if (!counter[type]) counter[type] = 1;
        out += `[${type} ${counter[type]++}]${nl}`;

        Array.from(verse.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                out += child.textContent ?? '';
            } else {
                const element = child as Element;
                const nodeName = element.nodeName.toUpperCase();
                if (nodeName === 'BR') {
                    out += nl;
                } else if (nodeName === 'INDENT') {
                    out += '    ';
                } else if (nodeName === 'CHORD' && /\S/.test(element.textContent ?? '') && !without_chords) {
                    out += '[' + (element.textContent ?? '').replace(/\s+/, ' ').replace('&', 'b') + ']';
                }
            }
        });

        out += nl + nl;
    });

    return out.replace(/\n+$/, '');
}

/**
 * Prevents chord annotations from overlapping when displayed above lyrics.
 *
 * PROBLEM: Chords are styled with `width: 0` and `position: relative; top: -1.2em`
 * so they float above the text without affecting document flow. However, when
 * multiple chords appear close together on the same line, they visually overlap
 * because they occupy no horizontal space in the layout.
 *
 * SOLUTION: This function measures the actual rendered positions of chord elements
 * and injects `<span class="gapfill">` spacer elements with explicit pixel widths
 * when chords would overlap. The spacers push the underlying text apart, creating
 * room for the chords above.
 *
 * The algorithm:
 * 1. Iterate through all chord elements in reading order
 * 2. For each chord on the same line as the previous one, calculate if they overlap
 * 3. If overlap detected, insert a gapfill spacer before the chord
 * 4. Optionally add a visual line (border) to connect the chord to its syllable
 *
 * BROWSER TIMING: Since this requires measuring offsetLeft/offsetTop, it must run
 * after the browser has rendered the DOM. If many chords report position 0 (not
 * yet rendered), the function reschedules itself via setTimeout.
 *
 * WRITING MODES: The function handles LTR, RTL, and vertical (Mongolian) scripts
 * by transforming coordinates—conceptually rotating the layout so the algorithm
 * always processes in a consistent "reading direction".
 *
 * WHY NOT PURE CSS? CSS cannot dynamically measure element overlap and inject
 * spacing. CSS Ruby (https://github.com/mzealey/worship-leader-frontend/pull/14)
 * may be a potential alternative in the future.
 */
function _fixup_chord_rendering(elem: HTMLElement | null): void {
    if (!elem) return;
    const chords = Array.from(elem.getElementsByClassName('chord')) as HTMLElement[];
    if (!chords.length) return;

    let last_offset_top = 0;
    let last_right_pos = 0;
    let zero_chord_position_count = 0;
    const text = elem.textContent || '';
    const rtl = is_rtl(text);
    const vertical = is_vertical(text);

    Array.from(elem.getElementsByClassName('gapfill')).forEach((gapfill) => gapfill.parentElement?.removeChild(gapfill));

    const dimension: 'height' | 'width' = vertical ? 'height' : 'width';

    // Think of the algo as doing ltr standard script and then rotating
    // this for different cases eg vertical or rtl
    for (const chordElem of chords) {
        const offset_top = vertical ? chordElem.offsetLeft : chordElem.offsetTop;
        let offset_left = vertical ? chordElem.offsetTop : chordElem.offsetLeft;

        if (last_offset_top === offset_top) {
            if (offset_left === 0) {
                // probably the browser hasn't rendered the html yet
                zero_chord_position_count++;
            } else {
                // same line - pad by 10px
                const dif = rtl ? last_right_pos - offset_left : offset_left - last_right_pos - 4;

                if (dif < 0) {
                    // things overlap or are too close together
                    let classes = 'gapfill';
                    let needs_line = true;

                    // No need for line on the first chord element - only ones after will affect the spacing
                    if (chordElem.parentElement?.firstChild === chordElem) needs_line = false;

                    let sibling: ChildNode | null = chordElem;
                    while (sibling) {
                        if (sibling.nodeType === Node.TEXT_NODE) break;

                        // non chord node (can be no gapfills as we removed them all above)
                        // classList.contains would be nice but ie doesn't support it.
                        if (sibling.nodeType === Node.ELEMENT_NODE && !/\bchord\b/i.test((sibling as Element).className)) break;

                        sibling = sibling.nextSibling;
                    }

                    // Only chords until the end of the word - just make it a space
                    if (!sibling) needs_line = false;

                    if (needs_line) classes += ' line';

                    chordElem.insertAdjacentHTML('beforebegin', `<span class="${classes}" style="${dimension}: ${-dif}px">&nbsp;</span>`);
                }
            }
        } else {
            // start of new line
            last_offset_top = offset_top;
        }

        // If we gapfill'd it then it needs updating...
        offset_left = vertical ? chordElem.offsetTop : chordElem.offsetLeft;
        let chord_width = vertical ? chordElem.scrollHeight : chordElem.scrollWidth;
        if (chord_width === 0) {
            // For firefox need to have this extra code because of the css elements are 0-width.
            chordElem.style[dimension] = 'auto';
            chord_width = vertical ? chordElem.scrollHeight : chordElem.scrollWidth;
            chordElem.style[dimension] = '0';
        }

        last_right_pos = offset_left + (rtl ? -1 : 1) * chord_width;
    }

    // many of the chords offsets were set to 0 - the browser didn't render
    // the page yet so wait a bit and try again.
    if (zero_chord_position_count > chords.length / 3) setTimeout(() => _fixup_chord_rendering(elem), 20);
    else {
        elem.classList.add('rendered');
    }
}

// Add spacers into the html to ensure chords do not overlap. May need to call
// _fixup_chord_rendering periodically to only do the rendering after browser
// has rendered the page initially.
export function format_html_chords(elem: { 0: HTMLElement } | HTMLElement | null): void {
    if (!elem) return;

    // Handle jQuery objects (which have a numeric index 0)
    const htmlElement = '0' in elem ? elem[0] : elem;

    if (!htmlElement) return;

    htmlElement.classList.remove('rendered'); // only add the invisible large background to chord fingerings after spacing has been done correctly.
    setTimeout(() => _fixup_chord_rendering(htmlElement), 10);
}

// Try to prevent mid-word breaks when there are chords using a zero-width join
// (for joined-up langs such as Arabic). The list of unicode escapes is
// characters in Arabic that don't have a joined up type for the next
// character. In this case if we did zwj's then they would stay the same but
// the following character would appear to be a mid rather than a start form.
//
// NOTE: Update lib/Songs/SongXML.pm code and tinymce chord plugin when changed
export function add_chord_zwjs(songxml: string): string {
    return songxml.replace(
        /([^-\s?!"';.,>\u200D\u0627\u06D5\u062F\u0631\u0632\u0698\u0648\u06C7\u06C6\u06C8\u06CB\u06C5\u06C9\u060C\u0674\u061F\u061B])(<chord[^>]*>[^<]*<\/chord>)([^-\s"';!?.,<\u200D])/gi,
        '$1\u200D$2\u200D$3',
    );
}

// Transpose <verse> etc to <div class="verse"> for IE etc
export function songxml_to_divs(songxml: string | null | undefined, without_chords = false, chord_color?: string): string {
    // Transpose <verse> etc to <div class="verse"> for IE etc
    if (!songxml) return '';

    let result = songxml;

    // If we have chords in a word then wrap it in a span so that the word
    // doesn't get a line-break at the point where there is a chord put in
    if (!without_chords) result = result.replace(/([^\s>]*(<chord[^>]*>[^<]*<\/chord>[^\s<]*)+)/g, "<span class='word-with-chord'>$1</span>");

    result = result
        .replace(/<(verse|bridge|chorus|prechorus)>/gi, '<div class="$1">')
        .replace(/<\/(verse|bridge|chorus|prechorus)>/gi, '</div>')

        .replace(/<(indent)>/gi, '<span class="$1">')
        .replace(/<\/(indent)>/gi, '</span>')

        .replace(/<repeat([^>]*)>/gi, '<span class="repeat" $1>')
        .replace(/<\/repeat>/gi, '</span>');

    if (without_chords) result = result.replace(/<(chord|chordsonly)[^>]*>[^<]*<\/\1>/gi, '');
    else {
        result = add_chord_zwjs(result);

        // Set a U+202D (LEFT-TO-RIGHT OVERRIDE) character within the chord to
        // force it to be the right way around, even though we set the chord
        // itself to be the standard text direction to get it starting at the
        // correct point.
        result = result
            .replace(
                /<chord([^>]*)>/gi,
                '<span class="chord"' + (chord_color ? ` style="color: ${chord_color}"` : '') + '$1><span class="chord-inner">&#x202D;',
            )
            .replace(/<\/chord>/gi, '</span></span>');
    }

    // songxml has tags but no actual text - behave as if none.
    if (!/\S/.test(result.replace(/<[^>]+>/g, ''))) return '';

    return result;
}
