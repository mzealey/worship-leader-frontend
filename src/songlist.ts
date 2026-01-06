import unknown_album_icon from '../img/unknown_album_icon.png';
import { FAVOURITE_DB } from './favourite-db';
import { set_filter_source } from './filter-sources';
import { listview_refresh } from './jqm-util';
import { app_lang, get_translation } from './langpack';
import { is_set } from './settings';
import { ensure_visible, is_rtl, is_vertical_lang } from './util';

export function is_copyright(song) {
    return song.copyright_restricted && is_set('observe-copyright');
}

export function set_direction(elem, lang, is_main_block?) {
    let dir = is_rtl(elem.text()) ? 'rtl' : 'ltr';

    // Set the vertical-lr class if mongolian (traditional) and is the song block
    elem.attr({ lang, dir }).toggleClass('vertical-lr vertical-lr-scroll', !!(is_main_block && is_vertical_lang(lang)));

    return elem;
}

export function setup_meta_link(list, info) {
    let item = $('<a href="#" class="list-search-link">').addClass(`type-${info._type}`);
    let text = '';
    switch (info._type) {
        case 'album':
            item.append($('<img>').attr('src', info.image_path || unknown_album_icon));
            item.append(set_direction($('<h2>').text(info.title), info.lang));
            item.data('searchtext', `album_id=${info.id}`);
            break;

        case 'song_source':
            item.addClass('mini');
            text = info.name;
            if (info.abbreviation) text += ' (' + info.abbreviation + ')';
            item.append(set_direction($('<h2>').text(text), info.lang));
            item.click(() => set_filter_source(info.id));
            break;
    }
    list.append($('<li>').append(item));
}

export function get_text_title(song) {
    let title = song.title;
    if (song.source_title) title += ` (${song.source_title})`;
    return title;
}

export function get_full_title(song, prefix?) {
    let title = get_text_title(song);

    let ret = $('<span>');
    title = set_direction($('<span>').text(title).attr('title', title), song.lang);

    // If prefix is set we'll hide the actual title and direction under a
    // different span. Unfortunately this means that if the UI direction and
    // the song direction are different the UI direction will be preferred so
    // by default we'll not do this.
    if (prefix) title = $('<span>').append(prefix, title);
    title.addClass('title');

    ret.append(title);

    let extra: string[] = [];
    if (FAVOURITE_DB.get_favourite(song.id)) extra.push(' &#x2665;');

    if (song.is_original) extra.push('&#x2605;');

    /*if( is_copyright(song) ) {
        extra.push( ' &times;' );
    } else { */
    if (song.has_chord && is_set('setting-display-chords')) extra.push(' &#x266F;&#x266D;');

    if (song.has_mp3) extra.push(' &#x266B;');

    if (song.has_sheet) extra.push('&#xF0F6;');
    //}

    if (extra.length) ret.append("<span class='symbols'>" + extra.join(' ') + '</span>');

    return ret;
}

export function setup_list_link(list, song, prefix?) {
    let item = $('<h3>');
    if (song.not_loaded) {
        item.append(get_translation('unknown-song') + ` (i${song.id})`);
        item = set_direction(item, app_lang());
    } else {
        item.append(get_full_title(song, prefix));

        // If its in the main menu (ie no language-related prefix) then wrap the whole thing
        if (!prefix) item = set_direction(item, song.lang);
    }

    item = $('<li />')
        .append($('<a href="#" class="mini song-link-click">').append(item))
        .addClass('songid-' + song.id);

    // On the links don't create clickable link if target song is copyrighted
    //if( !prefix || !is_copyright(song) )
    item.data('song_id', song.id);

    if (!song.not_loaded) {
        if (song.alternative_titles && song.alternative_titles.length) {
            item.find('a').append(set_direction($('<p class="wrappable">').text(song.alternative_titles.join(', ')), song.lang));
        }

        if (is_set('setting-show-key-in-list')) {
            let key_items: string[] = [];
            if (song.songkey) key_items.push(get_translation('songkey') + ': ' + song.songkey);

            if (song.info) {
                let timesig = song.info.filter((d) => d.type == 'timesignature')[0];
                if (timesig) key_items.push(timesig.value);

                let tempo = song.info.filter((d) => d.type == 'tempo')[0];
                if (tempo) key_items.push(get_translation('tempo') + ': ' + tempo.value);
            }

            if (key_items.length) item.find('a').append($('<p>').text(key_items.join(', ')));
        }
    }

    list.append(item);
}

export function update_song_list(page, items, requested_items) {
    const list = page.find('.songlist');
    if (!requested_items.infinite_scroll || requested_items.start == 0) {
        if (items.length) {
            $('.noresults').hide();
            list.empty().show();
        } else {
            $('.noresults').show();
            list.hide();
        }

        // Ensure we are scolled to the top of the page. This happens on my desktop
        // chrome by default, but on android chrome it doesn't seem to render so
        // quickly so needs a manual scroll (?)
        let scroll_elem = list.parents('.sidebar-container');
        if (!scroll_elem.length) scroll_elem = $(document);
        scroll_elem.scrollTop(0);
    }

    // Appending items through infinate scroll?
    if (items.length) {
        items.forEach((item, i) => {
            if ('_type' in item) setup_meta_link(list, item);
            else setup_list_link(list, item);

            // call more frequently to make responsive on older phones
            if (i % 10 == 9) listview_refresh(list);
        });

        listview_refresh(list);
    }

    // Don't try scrolling to this as it may affect the position of the pager
    // buttons that the user expects...
    let current_song_id = page.data('song_id');
    if (current_song_id) try_highlight_songid(page, current_song_id);
}

export function try_highlight_songid(page, song_id, scroll_to = false) {
    // Update highlighting to see which song has been selected
    let ul = page.find('.songlist');
    ul.find('li .ui-btn-active').removeClass('ui-btn-active');

    let to_highlight = ul
        .children('.songid-' + song_id)
        .find('.ui-btn')
        .addClass('ui-btn-active');

    // Animate scroll to that song if out of view range
    if (scroll_to && to_highlight.length) ensure_visible(to_highlight, to_highlight.parents('.sidebar-container'), 400);
}
