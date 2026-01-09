// Export key functions for the editor
import { get_host } from './globals';
import { add_chord_zwjs, convert_to_elvanto, convert_to_pre, format_html_chords, songxml_to_divs } from './songxml-util';
import { SORT_TITLE_SORT } from './sort-helpers';
import { unidecode } from './unidecode';
import { format_string, get_youtube_id, is_mobile_browser, is_rtl, is_vertical, prepare_search_string } from './util';

window.prepare_search_string = prepare_search_string;
window.is_mobile_browser = is_mobile_browser;
window.is_rtl = is_rtl;
window.is_vertical = is_vertical;
window.add_chord_zwjs = add_chord_zwjs;
window.songxml_to_divs = songxml_to_divs;
window.format_html_chords = (elem: any) => format_html_chords(elem[0]); // jquery item
window.convert_to_elvanto = convert_to_elvanto;
window.convert_to_pre = convert_to_pre;
window.SORT_TITLE_SORT = SORT_TITLE_SORT;
window.get_youtube_id = get_youtube_id;
window.unidecode = unidecode;

window.HOST = get_host();

// Legacy string formatting hack
(String.prototype as any).format = function (...arg: unknown[]) {
    return format_string(this as unknown as string, ...arg);
};
