import { get_presentation, is_casting, setup_presentation } from '../dual-present';
import { persistentStorage } from '../persistent-storage.es5';
import { set_direction } from '../songlist';
import { songxml_to_divs } from '../songxml-util';
import { is_vertical_lang } from '../util';

let blanked = false;

export function send_dual_present_song() {
    if (!is_casting()) return;

    const songinfo = $('#songinfo').data('song') || {};

    let html = '';
    if (!blanked) {
        // Note this wraps all the songxml details in a <div> rather than
        // updating the parent song details itself, but doesn't seem to affect
        // the general rendering of it
        let content = $('<div>').html(songxml_to_divs(songinfo.songxml, true));
        set_direction(content, songinfo.lang);
        html = content[0].outerHTML; // no jq support
    }
    const is_vertical = !!is_vertical_lang(songinfo.lang);
    send_message_all_displays({
        scrollX: 0,
        scrollY: 0,
        html,
        vertical: is_vertical,
        zoom: persistentStorage.getObj('dual-zoom', 0),
    });

    // Reset iframe approprately
    const iframe_container = $('.presenter-view .iframe-container')[0];
    iframe_container.scrollTop = 0;
    iframe_container.scrollLeft = 0;
    $('.presenter-view').toggleClass('vertical-lang', is_vertical);
    update_presentation_view_size();
}

function send_message_all_displays(data) {
    if (!is_casting()) return;

    const iframe = $('.presenter-view iframe')[0] as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify(data), '*');

    get_presentation()?.send_msg(data);
}

function toggle_blanked() {
    blanked = !blanked;

    send_dual_present_song();

    $('#present-blank').toggleClass('ui-icon-delete', !blanked).toggleClass('ui-icon-video ui-btn-active', blanked);
}

function set_presentation_size(width: number, height: number) {
    $('.presenter-view').data({ width, height });

    update_presentation_view_size();
}

export function update_presentation_view_size() {
    if (!is_casting()) return;

    $('.presenter-view').each((i, origP) => {
        const p = $(origP);
        const width = p.data('width');
        const height = p.data('height');
        const iframe = p.find('.iframe-container');
        const is_vertical = p.is('.vertical-lang');

        const pwidth = iframe[0].clientWidth; // client is size without scrollbars
        const scale = pwidth / width;
        p.data({ scale });

        let container_height = scale * height;

        // If vertical then the height of the scroll bar is not factored in,
        // but we want the width calculation based on the amount of horizontal
        // space allocated to this component.
        if (is_vertical) container_height += iframe[0].offsetHeight - iframe[0].clientHeight;
        iframe.css({ height: container_height });

        const scale_str = `scale(${scale})`;

        // Set iframe dimension according to monitor size
        iframe.find('iframe').css(is_vertical ? { height } : { width });

        iframe.find('iframe').css({
            '-webkit-transform': scale_str,
            '-moz-transform': scale_str,
            '-ms-transform': scale_str,
            transform: scale_str,
        });
    });
}

function send_scroll_event() {
    if (get_presentation()) {
        const iframe_container = $('.presenter-view .iframe-container')[0];
        const scale = $('.presenter-view').data('scale');
        get_presentation()!.send_msg({
            scrollX: iframe_container.scrollLeft / scale,
            scrollY: iframe_container.scrollTop / scale,
        });
    }
}

function scroll_delta(deltaX: number, deltaY: number) {
    // delta is in terms of the presented display so we scale the messages accordingly

    const scale = $('.presenter-view').data('scale');
    const iframe_container = $('.presenter-view .iframe-container')[0];
    iframe_container.scrollTop += deltaY * scale;
    iframe_container.scrollLeft += deltaX * scale;
    send_scroll_event();
}

export function init_casting() {
    setup_presentation();

    if (get_presentation()) {
        //$('.presenter-view').show();

        // Setup for jquery stuff
        $('html').addClass('cast-supported');

        $('#present-up').click(() => scroll_delta(0, -200));
        $('#present-down').click(() => scroll_delta(0, 200));
        $('#present-left').click(() => scroll_delta(-200, 0));
        $('#present-right').click(() => scroll_delta(200, 0));
        $('#present-blank').click(() => toggle_blanked());

        $('#present-in').click(() => zoom(1));
        $('#present-out').click(() => zoom(-1));

        // Listen for iframe events
        window.addEventListener('message', (event) => {
            const iframe = $('.presenter-view iframe')[0] as HTMLIFrameElement;
            if (!iframe || event.source !== iframe.contentWindow) return;

            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                return; // sometimes get other messages coming in
            }
            console.log('iframe msg', data);
            if ('height' in data || 'width' in data) {
                const is_vertical = $('.presenter-view').is('.vertical-lang');
                $(iframe).css(is_vertical ? { width: data.width } : { height: data.height });
                update_presentation_view_size();
            } else get_presentation()!.send_msg(data);
        });

        // As safari makes all iframes 100% we will do this on all platforms and
        // then capture any click events (by setting iframe pointer-events to none)
        // in order to allow scroll by dragging the iframe or wheeling over it.
        const iframe_container = $('.presenter-view .iframe-container');

        let cur_pos;
        iframe_container.on('scroll', send_scroll_event);
        iframe_container.on('mousedown', (e) => (cur_pos = { x: e.clientX, y: e.clientY }));

        // Do these two on body so that they stop even if mouse overscrolls the area
        $('body').on('mouseup', () => (cur_pos = null));
        $('body').on('mousemove', (e) => {
            if (!cur_pos) return;

            iframe_container[0].scrollLeft -= e.clientX - cur_pos.x;
            iframe_container[0].scrollTop -= e.clientY - cur_pos.y;
            cur_pos.x = e.clientX;
            cur_pos.y = e.clientY;
            send_scroll_event();
        });

        setTimeout(() => set_presentation_size(1200, 800), 1000);

        get_presentation()!.subject.subscribe((state) => {
            if (state.cast_available !== undefined) {
                $('html').toggleClass('cast-available', state.cast_available);
            }
            if (state.cast_active !== undefined) {
                $('html').toggleClass('cast-active', state.cast_active);
            }
            if (state.songxml_request) {
                send_dual_present_song();
            }
            if (state.cast_size) {
                set_presentation_size(state.cast_size.width, state.cast_size.height);
            }
        });
    }
}

const ZOOM_MAX = 5;
const ZOOM_MIN = -2;
function zoom(delta: number) {
    let new_zoom = persistentStorage.getObj('dual-zoom', 0) + delta;

    // Limit range of zoom
    new_zoom = Math.min(new_zoom, ZOOM_MAX);
    new_zoom = Math.max(new_zoom, ZOOM_MIN);
    $('#present-in').toggleClass('ui-state-disabled', new_zoom >= ZOOM_MAX);
    $('#present-out').toggleClass('ui-state-disabled', new_zoom <= ZOOM_MIN);

    persistentStorage.setObj('dual-zoom', new_zoom);

    send_message_all_displays({ zoom: new_zoom });
}
