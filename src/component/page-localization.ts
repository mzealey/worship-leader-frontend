import LANGPACK_INDEX from '../../langpack/index.json';
import { DEBUG } from '../globals';
import { get_app_languages } from '../langdetect.es5';
import { get_translation, lang_setup, relocalize_page } from '../langpack';
import { jqm_setup_completed } from '../startup-promises';
import { set_title } from '../title';

export function init_page_localization() {
    // This exec's after the dom has been modified by jqm
    $(document).on('pageinit', (e) => {
        relocalize_page($(e.target));
    });

    // This should only exec once on a given page
    $(document).on('pagebeforecreate', (e) => {
        // Langpack may not have been loaded so shove XXX values into each item
        // that should have them otherwise jqm will think they are meant to be
        // blank
        $(e.target)
            .find('[data-localize]')
            .each((_, origE) => {
                const e = $(origE);
                if (!e.html()) e.html(DEBUG ? 'XXX' : '&nbsp;');
            });
    });

    $(document).one('pageinit', () => {
        let [valid_packs] = get_app_languages().filter((lang) => lang in LANGPACK_INDEX);

        lang_setup(valid_packs).finally(() => jqm_setup_completed());
    });

    $(document).on('pagebeforeshow', function (e) {
        let page = $(e.target);

        // Hack rather than use jqm data-title as it doesnt work well with translations
        set_title(get_translation(page.attr('data-localize-title') || 'worship-leader', page));
    });
}
