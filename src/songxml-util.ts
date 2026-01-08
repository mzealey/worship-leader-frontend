import GraphemeSplitter from 'grapheme-splitter';

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
 * Legacy function that was used to prevent chord annotations from overlapping.
 * With CSS Ruby annotations, the browser now handles spacing automatically.
 * This function is retained for compatibility but simply marks the element as rendered.
 */
function _fixup_chord_rendering(elem: HTMLElement | null): void {
    if (!elem) return;
    elem.classList.add('rendered');
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

        // Convert <chord>X</chord>followingText to <ruby class="chord">followingText<rt>X</rt></ruby>
        // This uses CSS Ruby for automatic annotation positioning above text.
        // The regex captures: chord content, then following non-whitespace/non-tag characters
        const colorStyle = chord_color ? ` style="color: ${chord_color}"` : '';
        result = result.replace(/<chord([^>]*)>([^<]*)<\/chord>([^\s<]*)/gi, (_match, attrs, chordText, followingText) => {
            // U+202D (LEFT-TO-RIGHT OVERRIDE) forces chord to display LTR even in RTL context
            const rtContent = `&#x202D;${chordText}`;
            if (followingText) {
                // Normal case: chord has following text to annotate
                return `<ruby class="chord"${colorStyle}${attrs}>${followingText}<rt>${rtContent}</rt></ruby>`;
            } else {
                // Edge case: chord at end of word with no following text
                // Use zero-width space as base to position the annotation
                return `<ruby class="chord"${colorStyle}${attrs}>&#x200B;<rt>${rtContent}</rt></ruby>`;
            }
        });
    }

    // songxml has tags but no actual text - behave as if none.
    if (!/\S/.test(result.replace(/<[^>]+>/g, ''))) return '';

    return result;
}
