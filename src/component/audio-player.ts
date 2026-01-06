import { file_feedback } from '../feedback';
import { get_downloaded_file, is_local_url_allowed } from '../file-download-utils';
import { get_translation } from '../langpack';
import { handle_share } from '../page/sharer';
import { setup_download_btn } from './file-download';

function parseTime(seconds: number) {
    let mins = Math.floor((seconds % 3600) / 60)
        .toFixed(0)
        .toString();
    let secs = Math.floor(seconds % 60)
        .toFixed(0)
        .toString();
    if (Number(secs) < 10) secs = `0${secs}`;
    return `${mins}:${secs}`;
}

// This may happen on ie sometimes - https://stackoverflow.com/questions/20061959/js-audio-method-not-implemented-in-ie-10-of-server-2008-r2
//send_error_report('mejs-init', e);

// Correct way for reading the file locally (when the file://
// url doesnt work as per wkwebview, although not sure if this
// reads it all into memory first or somesuch..
/*
r = new FileReader();
r.onloadend = function() {
    url = window.URL.createObjectURL( new Blob([new Uint8Array(this.result)], { type: "audio/mp3" }) );
    mejs.setSrc( url );
};
r.readAsArrayBuffer(file);
*/

function largest_load_timestamp(audio_elem) {
    let b = audio_elem.buffered;
    let max = 0;
    // Don't bother about the range intracies just get the furthest along that was buffered
    for (let i = 0; i < b.length; i++) {
        if (max < b.end(i)) max = b.end(i);
    }
    return max;
}

function handle_sticky_scrolling() {
    let active_audio = $('.audio-player.active');
    if (!active_audio.length) return $('.audio-player').removeClass('sticky');

    let is_sticky = active_audio.hasClass('sticky');
    if (!is_sticky) {
        const offset = active_audio.offset();
        if (offset) active_audio.data('sticky_threshold', offset.top);
    }

    active_audio.toggleClass('sticky', window.scrollY + window.innerHeight < active_audio.data('sticky_threshold'));
}

export function setup_audio_player() {
    // Download progress
    function progress_update(e) {
        let audio_elem = e.target;
        let player = $(audio_elem).parent();
        if (!player.hasClass('audio-player')) return;

        if (audio_elem.readyState && audio_elem._start_position) {
            audio_elem.currentTime = audio_elem._start_position;
            delete audio_elem._start_position;
        }

        let duration = audio_elem.duration || player.data('audio').file.duration || null;
        player.find('.buffered').css('width', ((largest_load_timestamp(audio_elem) / duration) * 100).toFixed(2) + '%');
    }

    // TODO: how to figure when it has finished loading all the data?
    document.addEventListener('progress', progress_update, true);
    document.addEventListener('canplaythrough', progress_update, true);

    let body = $(document.body);
    body.on('click', '.audio-player > .share', function () {
        let data = $(this).parent().data('audio');
        file_feedback('share', data.song.id, data.file.id);
        handle_share(`song.html?song_id=${data.song.id}`, get_translation('share_title'), get_translation('share_subject'), data.file.path);
    });

    $(document).on('resize scroll', handle_sticky_scrolling);
}

export function create_audio_player(song, file) {
    const down_file_key = song.id + '-' + file.id; // silly js not auto-vivifying entries

    // TODO: Add aria-label to all of these elements to help screen reader support?
    let player = $(
        '<div class="audio-player">' +
            '<audio preload="none"></audio>' +
            '<div class="btn play-btn"></div>' +
            '<div class="progress text"></div>' +
            '<div class="track">' +
            '<div class="buffered"></div>' +
            '<div class="indicator"></div>' +
            '</div>' +
            '<div class="duration text"></div>' +
            '</div>',
    );
    player.data('audio', { song, file, down_file_key });

    let audio = player.find('audio');
    let audio_elem = audio.get(0) as (HTMLAudioElement & { _start_position?: number }) | undefined;
    if (!audio_elem || !audio_elem.play || !audio_elem.pause)
        // some browsers/crawlers that dont support playback
        return;

    let play_btn = player.find('.play-btn');
    let track = player.find('.track');

    // TODO: Try to move these event closures down to bubble events to avoid wasting space
    let playing;
    let progress;
    let duration;

    const maybe_show_buffering = () => {
        if (playing && largest_load_timestamp(audio_elem) <= audio_elem.currentTime) track.addClass('buffering');
    };

    const _toggle_play = (state) => {
        playing = state;
        player.toggleClass('playing', !!playing);

        try {
            if (playing) {
                $('.audio-player').not(player).removeClass('active');
                player.addClass('active');
                audio_elem.play();
                maybe_show_buffering();
            } else audio_elem.pause();
        } catch (e) {
            // sometimes ie10 server edition throws a 'Not implemented' issue here
        }

        handle_sticky_scrolling();
    };
    player.on('pause_all', () => _toggle_play(0));
    const toggle_play = (state = !playing, send_feedback = true) => {
        _toggle_play(state);

        // Pause all other audio elements if need be. Do via custom events to
        // avoid potential memory leaks by exposing API functions on other
        // players DOM.
        if (playing) $('.audio-player').not(player).trigger('pause_all');

        if (send_feedback) file_feedback(playing ? 'play' : 'pause', song.id, file.id);
    };
    const update_widgets = () => {
        if (isNaN(duration))
            // eg if file was just loaded
            duration = file.duration || 0;

        player.find('.progress').text(parseTime(progress));
        player.find('.duration').text(parseTime(duration));
        player.find('.indicator').css('width', ((progress / duration) * 100).toFixed(2) + '%');
    };

    play_btn.click(() => toggle_play());
    audio.on('timeupdate', () => {
        track.removeClass('buffering');

        progress = audio_elem.currentTime;
        duration = audio_elem.duration;

        if (progress >= duration) {
            toggle_play(false, false);
            progress = 0;
        }

        update_widgets();
    });
    track.on('mousedown mousemove touchstart touchmove', (e: JQuery.MouseDownEvent | any) => {
        if (e.buttons || /^touch/.test(e.type)) {
            let pos = e.pageX;
            if (!pos && e.originalEvent.targetTouches && e.originalEvent.targetTouches[0]) pos = e.originalEvent.targetTouches[0].pageX;

            const offset = track.offset();
            let click_pos = pos - (offset?.left || 0);
            let perc = click_pos / (track.width() || 1);
            if (perc < 0) perc = 0;
            else if (perc > 1) perc = 1;

            progress = perc * duration;
            if (audio_elem.readyState) audio_elem.currentTime = progress;
            else audio_elem._start_position = progress;
            maybe_show_buffering();
            update_widgets();
        }
        e.preventDefault();
    });

    const set_src = (src) => {
        try {
            audio_elem.src = src;
        } catch (e) {
            // ie10 with sound disabled
            return;
        }

        // Reset everything in the player
        progress = 0;
        toggle_play(false, false);
        update_widgets();
        player.find('.buffered').css('width', 0);
    };

    if (!file.download_path || file.download_path != 'none') {
        player.append(
            $('<div class="btn ui-btn-icon-right ui-extra-icon ui-icon-rss share">').attr('title', get_translation('sharebtn')),
            setup_download_btn(song, file, down_file_key, set_src),
        );
    }

    is_local_url_allowed().then((allowed) => {
        const downloadedFile = get_downloaded_file(down_file_key);
        set_src(allowed && downloadedFile ? downloadedFile.local_url : file.path || '');
    });

    return player;
}

/*
function mp3_no_internet() {
    //$('#songinfo .mp3nonetwork').popup('open');
    // XXX Can't find a way to make this work properly...
};
file_entries.find('audio')
    .on('waiting', function() {
        console.log('waiting');
        // when play is first clicked, do a 2 second timeout & display
        // no network if at the end we get navigator.onLine as false.
        mp3waiting = setTimeout(function(){
            if( ! navigator.onLine )
                mp3_no_internet();
        }, 2000);
    })
    .on('error loadstart playing suspended', function(e) {
        let obj = e.currentTarget;
        //console.log(e.type + ' net state ' + obj.networkState + ' no source ' + obj.NETWORK_NO_SOURCE);

        // Chrome does this on page load
        if( !mp3waiting && e.type == 'loadstart' )
            return;

        if( mp3waiting ) {
            clearTimeout(mp3waiting);
            mp3waiting = null;
        }

        // some browsers (andrdoid) throw a playing even when there is
        // no network connectivity however the network state below is
        // set correctly to no source.
        if(obj.networkState == 3)   // android 2 does this (but NETWORK_NO_SOURCE is set to 4)
            mp3_no_internet();
        if( ! navigator.onLine )    // android 3/4?
            mp3_no_internet();
    });
    */
