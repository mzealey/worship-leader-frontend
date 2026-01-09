import { can_do_worker } from '../abc2svg';
import { Chord } from '../chord';
import { create_audio_player } from '../component/audio-player';
import { load_score_into } from '../component/score';
import { hide_spinner, show_spinner, spinner } from '../component/spinner';
import { statusbar } from '../cordova-utils';
import { DB, on_db_change } from '../db';
import { OfflineDBCommon } from '../db/offline-common';
import { exit_cast_mode, has_cast_device, is_casting } from '../dual-present';
import { eventSocket } from '../event-socket';
import { FAVOURITE_DB } from '../favourite-db';
import { file_feedback, song_feedback } from '../feedback';
import { try_window_open_download } from '../file-download-utils';
import { set_filter_source } from '../filter-sources';
import { API_HOST } from '../globals';
import { current_page } from '../jqm-util';
import { app_lang, get_translation, lang_name } from '../langpack';
import { load_songxml_into, render_chords } from '../load-songxml';
import { get_meta_db } from '../meta-db';
import { render_primary_songxml, resize_for_print } from '../render-songxml';
import { set_search_text } from '../search';
import { on_set_db_update, SET_DB } from '../set-db';
import { get_setting, is_set, update_setting } from '../settings';
import { maybe_convert_solfege } from '../solfege-util';
import { get_full_title, get_text_title, is_copyright, set_direction, setup_list_link, try_highlight_songid } from '../songlist';
import { LOCALE_SORT } from '../sort-helpers';
import { is_setup } from '../startup-promises';
import { filter_tags, refresh_tag_button_status, update_filter_tag_btn } from '../tag';
import { set_title } from '../title';
import { Transpose } from '../transpose';
import { fetch_json, format_string, is_cordova, try_to_run_fn } from '../util';
import { force_song_list_page, get_song_list_page } from './search-helpers';
import { handle_share } from './sharer';

const rating_event = eventSocket.add_queue('rating', 500);

let prefer_score;

let load_sec_song = () => {
    return DB.then((db) => db.get_song($('#sec-selector').val() as number)).then((res) => load_songxml_into($('#secondary-song'), res));
};

let trans = new Transpose();
function reload_song() {
    load_song($('#songinfo').data('song'));
}

function transposeSong(key?: string, capo?: number | string) {
    let pri = $('#primary-song'); // fix this...
    let details = pri.data('keychange');
    if (!details)
        // Not sure why this may be the case but is on occasion
        return;

    //console.log('transpose song ' + key + "; capo: " + capo);

    // Only update when the given value is passed
    if (key != undefined) {
        if (details.startKey) {
            details.key = trans.getKeyByName(key);
            details.delta = details.key.value - details.startKey.value;
        } else {
            details.delta = key;
        }
    }

    if (capo !== undefined) details.capo = capo;

    pri.data('keychange', details);

    $('.songcontainer').each((i, origE) => {
        const elem = $(origE);
        if (elem.hasClass('showing-songxml')) render_chords(elem);
        else transpose_song_score(elem);
    });
}

function transpose_song_score(elem) {
    let abc = elem.data('abc');
    if (!abc) return;

    return load_score_into(elem, abc, elem.data('songdata'));
}

function setup_transpose_details(songdata, elem) {
    let transpose_details: Record<string, any> = {
        delta: 0,
    };
    transpose_details.capo = transpose_details.song_capo = parseInt(songdata.capo || 0);

    let startKey = songdata.songkey;
    if (startKey) {
        if (startKey.charAt(startKey.length - 1) == 'm') {
            transpose_details.is_minor = 1;
            startKey = startKey.substring(0, startKey.length - 1);
        }

        transpose_details.key = transpose_details.startKey = trans.getKeyByName(startKey);
        transpose_details.startKeyName = startKey; // without the m on it
    }

    elem.data('keychange', transpose_details);
}

function load_song(songdata?) {
    let pending_promises: Promise<unknown>[] = [];
    let page = $('#songinfo');
    page.data('song', songdata); // cache currently loaded song

    $('#main-page').toggleClass('song-not-found', !songdata);

    let alttitles = $('.songalttitles');
    alttitles.hide();

    if (!songdata) {
        let requested_id = page.data('song_id');
        if (requested_id) {
            // not found - perhaps was removed from the db but more likely user
            // is offline and using offlinedb that doesn't have this language
            // in it
            let trans = get_translation('unknown-song') + ` (i${requested_id})`;
            $('.songtitle').text(trans);
            page.find('.songnotfound p').text(trans);
            set_title(trans);
        } else {
            // just #songinfo with no request perhaps
            $('.songtitle').text(get_translation('worship-leader'));
            set_direction($('.songtitle'), app_lang());
            page.find('.songnotfound p').text('');
            set_title();
        }
        set_direction($('.songtitle'), app_lang());
        return Promise.reject();
    }

    $('#favourite-btn').toggleClass('ui-btn-active', FAVOURITE_DB.get_favourite(songdata.id));

    if (songdata.rating) {
        $('.avg-rating')
            .removeClass('hidden')
            .find('.rtng')
            .html(String(songdata.rating / 10));
    } else $('.avg-rating').addClass('hidden');

    $('.songtitle').text(songdata.title);
    set_direction($('.songtitle'), songdata.lang);
    set_title(songdata.title);

    // Currenly we just hack the abc into the files list and use that. We could
    // potentially put it into a separate (optional) table, but not sure that
    // there will be too much additional data with the scores.
    const abc_score = (songdata.files || []).filter((file) => file.type == 'abccache')[0];
    const has_score = !!abc_score;
    const show_score = is_set('setting-display-lyrics') && has_score && prefer_score && can_do_worker();
    const display_lyrics = is_set('setting-display-lyrics');
    const setup_chord_boxes = display_lyrics && songdata.songxml && (has_score || /<chord>/i.test(songdata.songxml));

    $('#song-switch-score').toggleClass('hidden', !(has_score && can_do_worker()));

    const pri_song = $('#primary-song');

    setup_transpose_details(songdata, pri_song);
    const render_promise = render_primary_songxml(songdata, show_score);
    pending_promises.push(render_promise);
    $('html, body, #songinfo').animate({ scrollTop: 0 }); // #songinfo for presentation mode

    let cont_pri = pri_song.parents('.ui-content');
    cont_pri.removeClass('sidebyside-display').addClass('normal-display');

    if (songdata.alternative_titles && songdata.alternative_titles.length) {
        alttitles.empty().show();
        let a = songdata.alternative_titles;
        set_direction(alttitles.append(a.map((title, idx) => $('<span class="subtitle">').text(title + (idx != a.length - 1 ? ', ' : '')))), songdata.lang);
    }

    let links = $('#songlinks').empty();
    const use_sidebyside = is_set('setting-sidebyside') && display_lyrics && !show_score;
    if (songdata.related_songs && (use_sidebyside || !page.data('set_id'))) {
        pending_promises.push(
            DB.then((db) => db.get_songs(songdata.related_songs.map((e) => e.id))).then(function (songs) {
                if (!songs.length) return;

                // Sort according to language names but with original at the top
                const songsWithLang = songs.map((res) => ({
                    ...res,
                    _lang_txt: lang_name(res.lang),
                }));
                songsWithLang.sort((a, b) => (b.is_original || 0) - (a.is_original || 0) || LOCALE_SORT(a._lang_txt, b._lang_txt));

                if (use_sidebyside) {
                    cont_pri.removeClass('normal-display').addClass('sidebyside-display');

                    let sidebyside_select = $('#sec-selector').empty();

                    sidebyside_select.append(
                        songsWithLang.map((song) =>
                            $('<option>')
                                .val(song.id)
                                .text(lang_name(song.lang) + ': ' + get_text_title(song)),
                        ),
                    );

                    let wanted_id = page.data('sec_id');
                    if (wanted_id && songsWithLang.filter((s) => wanted_id == s.id).length) sidebyside_select.val(wanted_id);

                    sidebyside_select.selectmenu('refresh');

                    // continue the promise chain to block displaying main page until this has completed
                    return load_sec_song();
                } else {
                    // Mask with a clickbox when we have loads of related songs
                    let display_songs = songsWithLang;
                    if (songsWithLang.length > 2) {
                        display_songs = songsWithLang.filter((s) => s.is_original || s.lang == songdata.lang);
                        if (!display_songs.length) display_songs = [songsWithLang[0]];
                    }

                    // If there is only one item not displayed then don't bother with showing the box
                    if (display_songs.length + 1 >= songsWithLang.length) display_songs = songsWithLang;

                    display_songs.forEach((res) => {
                        setup_list_link(links, res, res._lang_txt + ': ');
                    });

                    if (display_songs.length != songsWithLang.length) {
                        let show_all_links = function () {
                            links.empty();
                            songsWithLang.forEach((res) => {
                                setup_list_link(links, res, res._lang_txt + ': ');
                            });
                            links.listview('refresh');
                        };
                        let expand_list = $('<a href="#" class="mini" />')
                            .append($('<h3 />').text(format_string(get_translation('show_all_related_songs'), songs.length)))
                            .click(show_all_links);
                        links.append($('<li />').append(expand_list));
                    }

                    links.listview('refresh');
                }
            }),
        );
    }

    // Render a section including title etc
    function _render_section(e) {
        let content_count = e.find('.entries').children().length;
        e.toggle(!!content_count);
        if (content_count) {
            let title = e.data('localize-title');
            if (title)
                e.find('h3')
                    .empty()
                    .text(get_translation(title))
                    .append($('<span class="count" />').text(` (${content_count})`));
        }
    }

    let info_top = $('#song-info-top').empty();
    $('#song-right .entries').empty();
    let info = $('#song-info > .entries');

    (songdata.sources || []).forEach((source) => {
        // Don't include random sources that are not proper songbooks
        if (source.number || source.abbreviation) {
            let text = $('<a class="search-link">')
                .click(() => set_filter_source(source.id))
                .text(source.name || '');

            if (source.number) text = $('<span>').append(text, ' ' + source.number);

            info.append(
                $('<div>')
                    .text(get_translation('source') + ': ')
                    .append(set_direction(text, songdata.lang)),
            );
        }
    });

    (songdata.info || []).forEach((d) => {
        let info_area = info;
        if (d.type == 'tempo' || d.type == 'timesignature') info_area = info_top;

        let value = set_direction($('<span>').text(d.value), songdata.lang);

        // In certain types add it as a link to search for this
        if (d.type == 'words' || d.type == 'music' || d.type == 'wordsandmusic' || d.type == 'translator' || d.type == 'arrangedby') {
            value = $('<a class="search-link">').append(value).data('searchtext', d.value);
        }

        info_area.append(
            $('<div>')
                .text(get_translation(d.type) + ': ')
                .append(value),
        );
    });

    if (songdata.year) info.append($('<div>').text(get_translation('year_written') + ': ' + songdata.year));

    if (songdata.lang) info.append($('<div>').text(get_translation('language') + ': ' + lang_name(songdata.lang)));

    if (songdata.tags && songdata.tags.length) {
        let tags_elem = $('#tags');
        pending_promises.push(
            get_meta_db().then(function (meta_db) {
                let translated_tags: Array<{ t: string; id: number; code: string }> = [];
                songdata.tags.forEach((tag_id) => {
                    let tag_code = (meta_db.tag_mappings[tag_id] || {}).tag_code;
                    if (tag_code)
                        translated_tags.push({
                            t: (meta_db.tags[tag_code] || {})[app_lang()] || tag_code,
                            id: tag_id,
                            code: tag_code,
                        });
                });
                translated_tags.sort((a, b) => LOCALE_SORT(a.t, b.t));
                tags_elem
                    .find('.entries')
                    .append(
                        translated_tags.map((tag) =>
                            $('<button class="ui-btn ui-btn-inline ui-mini ui-extra-icon ui-icon-tag ui-btn-icon-left tag-btn">')
                                .data('tag_id', tag.id)
                                .text(tag.t),
                        ),
                    );

                if (!translated_tags.length) return;

                refresh_tag_button_status();
                _render_section(tags_elem);
            }),
        );
    }

    if (songdata.albums && songdata.albums.length) {
        const album_entries = $('#albums .entries');

        songdata.albums
            .filter((a) => a.album)
            .forEach((album_song) => {
                let entry = $('<div class="album-entry clearfix">');
                if (album_song.album.image_path)
                    entry.addClass('has-img').append(
                        $(`<img class="album">`).attr({
                            alt: get_translation('albums'),
                            src: album_song.album.image_path,
                        }),
                    );

                let name = album_song.album.title;
                if (album_song.track > 0) name += ` (${get_translation('track')} ${album_song.track})`;
                entry.append(set_direction($('<span>').html(name), songdata.lang));

                if (album_song.album.purchase_path) entry.wrapInner($('<a target="_blank" />').attr({ href: album_song.album.purchase_path }));
                else entry.wrapInner($('<a class="search-link" />').data('searchtext', 'album_id=' + album_song.album.id));

                album_entries.append(entry);
            });

        _render_section($('#albums'));
    }

    let links_done = {};
    (songdata.files || []).forEach((d) => {
        // In 99% of cases, replace the file path with whatever our main host
        // is set to to allow using cdn to work around network restrictions.
        // For web (esp http/2) this should also speed up content fetching as
        // not required to negotiate a new connection.
        const change_domain = (path) => (path || '').replace(/^https?:\/\/songs.(yasamkilisesi|worshipleaderapp).com/i, API_HOST);
        d.path = change_domain(d.path);

        if (d.type == 'mp3' || d.type == 'promomp3' || d.type == 'instmp3' || d.type == 'backmp3') {
            // Don't display MP3 player on copyright restricted songs to avoid
            // getting blocked from the store
            if (is_copyright(songdata)) return;

            const player = create_audio_player(songdata, d);
            if (player) {
                $(d.type == 'instmp3' ? '#mp3-instrumentals' : '#mp3-words')
                    .find('.entries')
                    .append(player);
            }
        } else if (d.type == 'sheetpdf') {
            if (!d.download_path || d.download_path != 'none') {
                const dl_href = change_domain(d.download_path || d.path);

                if (dl_href in links_done) return;
                links_done[dl_href] = 1;

                let download_link = $('<button class="ui-btn ui-btn-inline ui-mini ui-extra-icon ui-icon-download ui-btn-icon-left">')
                    .text(get_translation('download_link'))
                    .click(() => {
                        file_feedback('download', songdata.id, d.id);
                        try_window_open_download(dl_href);
                    });
                $('#sheet-music .entries').append(download_link);
            }
        } else if (d.type == 'video') {
            let url = d.path,
                icon = 'video',
                text = 'watch_video';

            let v = d.video_details; // broken down into canonicalized details by the server
            if (v) {
                if (v.type == 'youtube') {
                    // Custom setup for youtube as previously
                    text = 'youtube_link';
                    icon = 'youtube';
                    url = `https://youtube.com/watch?v=${v.id}`;
                } else if (v.type == 'vimeo') {
                    url = `https://vimeo.com/${v.id}`;
                }
                // TODO: Handle other video path canonicalization here
            }

            let row = $(`<a class="ui-btn ui-btn-inline ui-mini ui-extra-icon ui-icon-${icon} ui-btn-icon-left" data-ajax="false" target="_blank">`)
                .text(get_translation(text))
                .click(() => file_feedback('watch', songdata.id, d.id)) // change this stat when we have inline watching
                .attr({ href: url, title: get_translation(text) });
            $('#videos .entries').append(row);
            d.download_path = 'none';
        }
    });

    // Render all sections now, but some others may be in-flight and need redoing later
    $('.entry-section').each((i, e) => _render_section($(e)));

    // Probably not amazing efficient - should do this only whenever the setting is changed.
    $('.songxml')
        .removeClass('zoom-vsmall zoom-small zoom-medium zoom-large zoom-xlarge zoom-xxlarge')
        .addClass('zoom-' + get_setting('setting-song-zoom'));

    // Don't bother with changing the key/capo selection boxes if we wont be showing chords/music
    if (setup_chord_boxes) {
        let transpose_details = pri_song.data('keychange');

        $('#capo-select').val(transpose_details.song_capo).selectmenu('refresh');
        $('#song-capo').attr('data-value', transpose_details.song_capo); // for masking with css during prints

        let select = $('#chord_select').empty();

        const startKey = transpose_details.startKeyName;
        if (startKey) {
            trans.keys
                // Show whatever key the song claims it is, and all the keys that are sensible to show as well
                .filter((item) => item.name == startKey || (!item.hidden && (transpose_details.is_minor ? 'minor' : 'major') in item))
                .map((item) => item.name)
                .forEach((val) => {
                    let opttext = maybe_convert_solfege(val) + (transpose_details.is_minor ? 'm' : '');

                    select.append($(`<option value="${val}">`).html(opttext + (val == startKey ? ' ' + get_translation('original_key') : '')));
                });
            select.val(startKey);
        } else {
            for (let i = -11; i < 12; i++) select.append($('<option>').text(i).val(i));
            select.val(0);
        }

        let text = get_translation(startKey ? 'key_text' : 'semitone_text');
        $('#chord_dropdown label').text(text);
        select.attr('title', text);

        select.selectmenu('refresh');
    }

    // TODO: Add a watcher for live sets in the songs:set_update section above...?
    if (SET_DB && setup_chord_boxes) {
        // Is there a database value to load for transposition? Ensure the song is loaded and then handle the transposition for it
        const update_key_from_set = render_promise
            .then(() => SET_DB.get_song_set_details($('#songinfo').data('set_id'), $('#songinfo').data('song_id')))
            .then((details) => {
                if (!details) return;

                let select = $('#chord_select');
                if ('song_key' in details) {
                    console.log('song key loaded: ', details.song_key);
                    select.val(details.song_key);
                    select.trigger('change');
                }
                if ('capo' in details) {
                    $('#capo-select').val(details.capo).trigger('change');
                }
            });
        pending_promises.push(update_key_from_set);
    }

    return Promise.all(pending_promises);
}

function update_set_next_prev(set_id, song_id) {
    const page = $('#songinfo');
    let next = page.find('.set-next').addClass('hidden');
    let prev = page.find('.set-prev').addClass('hidden');
    let promises: Promise<unknown>[] = [];
    if (set_id) {
        // displaying songs from a set
        promises.push(
            SET_DB.find_adjacent_songids_in_set(set_id, song_id).then((data) => {
                if (data.next_id) next.removeClass('hidden').data('song_id', data.next_id);

                if (data.prev_id) prev.removeClass('hidden').data('song_id', data.prev_id);
            }),
            SET_DB.get_set_title(set_id).then((title) => {
                // TODO: Not sure this happens but sometimes we cannot find the song in the set.
                let details = SET_DB.find_song_position_in_set(set_id, song_id) || { position: 0 };
                page.find('.prevnext h1').text(format_string(get_translation('set_title') + ': {0} ({1})', title, details.position + 1));
            }),
        );

        page.addClass('setview').removeClass('listview');
    } else {
        page.removeData('set_id');
        page.addClass('listview').removeClass('setview');
    }
    return Promise.all(promises);
}

export function load_songinfo_page(opts) {
    const page = $('#songinfo');
    if (!opts.song_id)
        // see if there was a preexisting song_id available
        opts.song_id = page.data('song_id');

    // Strip bad parts of urls like song_id=123. or whatever.
    if (opts.song_id) opts.song_id = opts.song_id.toString().replace(/[^0-9]+/g, '');

    let promises: Array<Promise<unknown> | void> = [];
    if (opts.song_id) {
        // save page.data song_id and set_id if there are
        page.data(opts);

        promises.push(display_songid(opts.song_id));

        try_highlight_songid(page, opts.song_id, true);

        // load rating from local storage (if there was any)
        console.log('rating for song ', opts.song_id, FAVOURITE_DB.get_rating(opts.song_id));
        page.find('.rating').raty('score', FAVOURITE_DB.get_rating(opts.song_id));
    } else load_song(); // display the not found page

    promises.push(update_set_next_prev(opts.set_id, opts.song_id));

    if (promises.length) spinner(Promise.all(promises));
}

function switch_song_page(args) {
    let path = '#songinfo?' + $.param(args);

    // Don't display a transition if it's a switch between the songinfo page
    if ($.mobile.activePage[0].id == 'songinfo') {
        // Not using jqm change page makes the change page process significantly faster
        load_songinfo_page(args);
        $.mobile.navigate.navigator.preventHashAssignPopState = true;
        window.location.hash = path;
        $.mobile.navigate.navigator.preventHashAssignPopState = false;
    } // transition the page using the (slow) jqm process
    else $.mobile.changePage(path, { allowSamePageTransition: true });
}

function song_link_click(this: HTMLElement) {
    let li = $(this).parents('li');
    let ul = li.parents('ul');
    let song_id = li.data('song_id');
    if (song_id) switch_song_page({ song_id, set_id: ul.data('set_id') });
}

function setup_hide_cursor() {
    let last_mouse_move = Date.now();
    $('#songinfo').on('mousemove', () => {
        last_mouse_move = Date.now();
        $('#songinfo').removeClass('hide-mouse');
    });

    setInterval(() => {
        // Hide the mouse after a certain time of no movement. Some devices such as apple don't do this automatically
        if (Date.now() - last_mouse_move > 2000) $('#songinfo').addClass('hide-mouse');
    }, 1000);
}

let _cur_refresh_handler;
function update_refresh_button_visibility() {
    const page = $('#songinfo');
    const btn = page.find('#refreshbtn');
    if (_cur_refresh_handler) {
        btn.off('click', _cur_refresh_handler);
        _cur_refresh_handler = undefined;
    }
    DB.then((db) => {
        if (db instanceof OfflineDBCommon) {
            _cur_refresh_handler = () => {
                let current = page.data('song');
                if (current && current.id)
                    db.refresh_song_from_db(current.id).then((song) => {
                        page.data('song', song);
                        reload_song();
                    });
            };
            btn.on('click', _cur_refresh_handler).show();
        } else btn.hide();
    });
}

export function init_songinfo() {
    let body = $(document.body);
    const page = $('#songinfo');
    setup_hide_cursor();
    body.on('click', '.song-link-click', song_link_click);
    body.on('click', 'a.search-link, a.list-search-link', function () {
        let searchtext = $(this).data('searchtext');
        if (searchtext) set_search_text(searchtext);
    });
    body.on('click', 'a.ui-icon-youtube, a.ui-icon-download', () => song_feedback('download', page.data('song_id')));

    on_set_db_update.subscribe(() => {
        if (page.is('.ui-page-active')) update_set_next_prev(page.data('set_id'), page.data('song_id'));
    });

    // Simplify the canvas renderer
    Chord.renderers.canvas.diagram = function () {
        return this.canvas;
    };

    // Disable name at top
    Chord.sizes.nameFontSize = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    //Chord.prototype.sizes.nameFontPaddingBottom = [0,0,0,0,0,0,0,0,0,0];

    // For some reason since adding the nested sidebar page this gets called multiple times...
    page.one('pageinit', () => {
        page.find('.toggle-sidebar').click(() => {
            page.toggleClass('show-sidebar').toggleClass('hide-sidebar');
            update_setting('hide-sidebar', is_set('hide-sidebar') ? 'false' : 'true');
            $('#sidebar .ui-header.ui-header-fixed').toolbar('updatePagePadding');
            render_primary_songxml();
        });
        page.toggleClass('show-sidebar', !is_set('hide-sidebar')).toggleClass('hide-sidebar', is_set('hide-sidebar'));

        page.find('#song-switch-songxml').click(() => {
            prefer_score = false;
            wrap_song_loading(() => render_primary_songxml(undefined, false), true);
        });
        page.find('#song-switch-score').click(() => {
            prefer_score = true;
            wrap_song_loading(() => render_primary_songxml(undefined, true), true);
            $('html, body').animate({ scrollTop: 0 });
        });

        page.find('#favourite-btn').click(() => {
            const song_id = page.data('song_id');
            const song = page.data('song');
            if (song && song_id) {
                FAVOURITE_DB.set_favourite(song_id, !FAVOURITE_DB.get_favourite(song_id));
                $(`.songid-${song_id}`).find('h3').empty().append(get_full_title(song));
                page.find('#favourite-btn').toggleClass('ui-btn-active');

                song_feedback('favourite', song_id);
            }
        });

        page.on('click', '.to-set-list', () => {
            $.mobile.changePage('#page-set-view?set_id=' + page.data('set_id'));
        });
        page.on('click', '.set-next, .set-prev', function () {
            switch_song_page({ song_id: $(this).data('song_id'), set_id: page.data('set_id') });
        });

        update_refresh_button_visibility();
        on_db_change.subscribe(() => update_refresh_button_visibility());

        page.find('#sharebtn').on('click', () => {
            song_feedback('share', page.data('song_id'));

            let song_id = page.data('song_id');
            handle_share(`song.html?song_id=${song_id}`, get_translation('share_title'), get_translation('share_subject'));
        });

        let handle_print = () => {
            // Desktop browsers, safari (mobile) all support the standard
            // window.print. These days even android chrome seems to support it
            // well - woohoo!
            try {
                window.print(); // note this is synchronus
                onprinthandler();
            } catch (e) {
                // Rarely browsers (edge, perhaps IE with no printer drivers) do an err if print was cancelled
            }
        };

        if (is_cordova() && cordova.plugins && cordova.plugins.printer) {
            // Cordova webviews doesn't support printing natively so we need to use a plugin
            handle_print = () => {
                cordova.plugins.printer.print('', {}, (res) => {
                    if (res) onprinthandler();
                });
            };
        }

        page.find('#print-btn').click(() => {
            // For some reason we need to do this to allow page layout to complete
            // in eg mobile chrome. However on safari it prompts to see if you are
            // sure about printing the webpage so only do it if we had to reflow
            // the view.
            if (resize_for_print()) setTimeout(handle_print, 0);
            else handle_print();
        });

        page.find('#present-btn').click(() => {
            if (is_casting()) exit_cast_mode();
            else if (has_cast_device()) $.mobile.changePage('#page-present');
            else enter_single_presentor_mode();
        });
        page.find('#close-presentation').click(exit_single_presentor_mode);

        // Escape is not passed in chrome at least when exiting full screen mode so we need to catch it here
        $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', () => {
            let fullscreenElement =
                document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
            if (!fullscreenElement) exit_single_presentor_mode();
        });

        $('#newbtn').click(() => $('#page-edit-textarea .textarea').data({ type: 'new' }));
        $('#editbtn').click(() => $('#page-edit-textarea .textarea').data({ type: 'change' }));

        page.find('.rating').raty({
            starType: 'i',
            click: (score) => {
                let song_id = page.data('song_id');
                FAVOURITE_DB.set_rating(song_id, score);
                rating_event([song_id, score], song_id);
            },
        });

        // We don't use a native popover because it messes with the enter/leave things
        let last_chord, last_chord_close;
        let chord_popup = $('#chord-display-popup');

        page.on('mouseleave', '.songxml .chord, #chord-display-popup', () => {
            // Set a small timeout in case it is just flipping between the popup and the chord
            last_chord_close = setTimeout(() => chord_popup.css('display', 'none'), 200);
        });
        page.find('#chord-display-popup').on('mouseenter', () => clearTimeout(last_chord_close));

        let chord_idx;
        let _chord_data; // just load fingerings in the background when first requested

        function render_chord_fingerings(element, idx = 0) {
            let chord = $(element).data('cur_chord');
            if (!chord)
                // should never happen but sometimes does, not sure why.
                return Promise.reject();

            chord = chord
                .toLowerCase()
                .replace(/h/g, 'b')
                .replace(/&/g, 'b') // flats
                .replace(/min?/, 'm') // Eg Amin or Ami are the same as Am
                .replace(/[()\s.]/g, ''); // kill useless chars too

            let display = $('#chord-display').empty();

            if (!_chord_data) _chord_data = fetch_json('chords.json');

            return _chord_data.then((chords) => {
                let fingerings = chords[chord];
                if (!fingerings) {
                    console.log('could not find fingering for chord "' + chord + '"');
                    return Promise.reject();
                }

                page.find('#chord-next, #chord-prev').toggle(fingerings.length > 1);

                if (idx < 0) idx += fingerings.length;
                let diagram = new Chord('', fingerings[idx % fingerings.length]).getDiagram(3);
                if (diagram) {
                    display.append($('<h4>').text($(element).text()), diagram);
                    chord_idx = idx;
                }
            });
        }
        page.find('#chord-next').on('click', () => render_chord_fingerings(last_chord, chord_idx + 1));
        page.find('#chord-prev').on('click', () => render_chord_fingerings(last_chord, chord_idx - 1));

        page.on('mouseenter', '.songxml .chord', function (e) {
            if (!is_set('setting-show-fingering')) return;

            clearTimeout(last_chord_close);

            const should_update_position = chord_popup.css('display') != 'block';

            const display_popup = (e) => {
                const width = chord_popup.width();
                chord_popup.css({
                    display: 'block',
                    left: Math.max(e.pageX - (width || 0) / 2, 0),
                    top: e.pageY + 2,
                });
                last_chord = e.currentTarget;
            };

            if (last_chord != e.currentTarget) {
                render_chord_fingerings(e.currentTarget).then(
                    () => display_popup(e),
                    () => {
                        // no fingering found or load error
                        chord_popup.css('display', 'none');
                        last_chord = undefined;
                    },
                );
            } else if (should_update_position) display_popup(e);

            e.preventDefault();
        });

        page.on('click', '.tag-btn', function () {
            let tag_id = $(this).data('tag_id');

            // No negation here
            if (filter_tags[tag_id]) delete filter_tags[tag_id];
            else {
                filter_tags[tag_id] = 1;
                force_song_list_page();
            }
            get_song_list_page().trigger('do_new_search');
            refresh_tag_button_status();
            update_filter_tag_btn();
        });

        function refresh_collapsed(section) {
            let btn = section.find('.collapse-widget');

            if (is_set('collapsed-' + section.attr('id'))) {
                section.addClass('collapsed');
                btn.removeClass('ui-icon-carat-u').addClass('ui-icon-carat-d');
            } else {
                section.removeClass('collapsed');
                btn.removeClass('ui-icon-carat-d').addClass('ui-icon-carat-u');
            }
        }
        page.on('click', '.collapsable-section h3, .collapsable-section .collapse-widget', function () {
            let section = $(this).parents('.collapsable-section');
            update_setting('collapsed-' + section.attr('id'), section.hasClass('collapsed') ? 'false' : 'true');
            refresh_collapsed(section);
        });
        page.find('.collapsable-section').each((i, e) => refresh_collapsed($(e)));

        $('#sec-pri-switch').click(() => {
            switch_song_page({
                song_id: $('#sec-selector').val(),
                sec_id: page.data('song_id'),
                // we don't show related songs if it's in a set view
                //set_id: page.data('set_id'),
            });
        });

        $('#sec-selector').change(load_sec_song);
    });

    $('#chord_select').on('change', function () {
        if (SET_DB) SET_DB.update_song_in_set(page.data('set_id'), page.data('song_id'), $(this).val() as string);
        transposeSong($(this).val() as string);
    });
    $('#capo-select').on('change', function () {
        let value = $(this).val() as number;
        $('#song-capo').attr('data-value', value); // for masking with css during prints
        if (SET_DB) SET_DB.update_song_in_set(page.data('set_id'), page.data('song_id'), undefined, value);
        transposeSong(undefined, value);
    });

    // when moving away from the song, pause the media players
    page.on('pagebeforehide', () => page.find('audio').each((i, e) => e.pause()));

    page.on('pageshow', () => {
        $('#sidebar .ui-header.ui-header-fixed').toolbar('updatePagePadding');
    });

    $('body').on('keydown', presentor_key_event);
}

// Handle key events from within a presentation
function presentor_key_event(e) {
    let in_presentation = $('html').hasClass('presentation');
    let is_input = $(e.target).is('input, textarea, [contenteditable]');
    if (!is_input && !e.altKey && e.keyCode == 37) {
        // left
        e.preventDefault();
        $('#songinfo .set-prev:visible').first().click();
        $('#songinfo').focus();
    } else if (!is_input && !e.altKey && e.keyCode == 39) {
        // right
        e.preventDefault();
        $('#songinfo .set-next:visible').first().click();
        $('#songinfo').focus();
    } else if (e.keyCode == 122) {
        // F11
        if (in_presentation) exit_single_presentor_mode();
        else enter_single_presentor_mode();
        e.preventDefault();
    } else if (in_presentation && e.keyCode == 27) {
        // escape
        e.preventDefault();
        exit_single_presentor_mode();
    }
}

export function enter_single_presentor_mode() {
    $('html, body').scrollTop(0);
    $('html').addClass('presentation');
    const page = $('#songinfo');
    page.focus();
    song_feedback('present', page.data('song_id'));

    // Try to get fullscreen through all browser prefixes
    try_to_run_fn(page[0], ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen', 'mozRequestFullScreen', 'msRequestFullscreen']);
    statusbar('hide');
}

function exit_single_presentor_mode() {
    statusbar('show');

    // exit the full screen mode whatever called us (chrome 71+ throw error per https://github.com/jpilfold/ngx-image-viewer/issues/23)
    if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement)
        try_to_run_fn(document, ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen', 'mozCancelFullScreen', 'msExitFullscreen']);
    $('html').removeClass('presentation');
    $('#main-page .ui-header.ui-header-fixed').toolbar('updatePagePadding');
}

export function setup_track_prints() {
    // Track song prints. From https://www.tjvantoll.com/2012/06/15/detecting-print-requests-with-javascript/
    if (window.matchMedia && window.matchMedia('print').addListener) {
        // ie9 doesnt have this
        window.matchMedia('print').addListener(function (mql) {
            if (mql.matches) {
                // before print
                onprinthandler();
            } else {
                // after print
                render_primary_songxml(); // render it back again
            }
        });
    } else if (window.onbeforeprint) {
        window.onbeforeprint = onprinthandler;
    }
}

let song_load_count = 0;
function wrap_song_loading(cb, keep_title_shown) {
    song_load_count++;

    // Don't show the spinner if the database has not been loaded
    const use_spinner = is_setup();

    if (use_spinner) show_spinner();

    // Hide page while rendering
    $('#main-page').addClass(keep_title_shown ? 'same-song-loading' : 'song-loading');

    let reveal = () => {
        if (song_load_count > 0) song_load_count--;

        if (use_spinner) hide_spinner();
        if (song_load_count == 0) {
            $('#main-page').removeClass('song-loading same-song-loading');
            $('#main-page .ui-header.ui-header-fixed').toolbar('updatePagePadding');
        }
    };

    let promise = cb();
    if (promise) promise.finally(reveal);
    else reveal();
}

let last_req_id = 0;
export function display_songid(song_id) {
    // Cannot use .data('song_id') as that has just changed
    const keep_shown = song_id == ($('#songinfo').data('song') || {}).id;

    wrap_song_loading(() => {
        // Track an ID so that we know which is the last request made and drop any others coming back
        let my_req_id = ++last_req_id;

        // A success from the promise chain means that the last song has
        // loaded; rejection means that one we didn't want to unmask has loaded
        return DB.then((db) => db.get_song(song_id, true)).then(
            (res) => {
                if (my_req_id == last_req_id) {
                    song_feedback('view', song_id);
                    if ($('html').hasClass('presentation')) song_feedback('present', song_id);

                    return load_song(res);
                }
                return Promise.reject();
            },
            () => {
                if (my_req_id == last_req_id) return load_song(); // TODO: display a connection failed type error?

                return Promise.reject();
            },
        );
    }, keep_shown);
}

function onprinthandler() {
    // Is probably called multiple times per print request and we don't know
    // how many sheets it output anyway so just send 1 per song id.
    let cur_page = current_page();
    if (!cur_page) return;

    let song_id = cur_page.data('song_id');
    if (song_id) song_feedback('print', song_id);
}
