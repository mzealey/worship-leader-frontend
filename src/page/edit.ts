import { get_host, get_uuid } from '../globals';
import { get_translation } from '../langpack';
import { convert_to_elvanto, convert_to_pre } from '../songxml-util';
import { fetch_json } from '../util';

function update_edit_songdata() {
    let cont = get_translation('edit_email') + ': \n';

    const input = $('#page-edit-textarea .textarea');
    if (input.data('type') == 'change') {
        let songdata = $('#primary-song .songxml').data('songdata');
        if (songdata) {
            cont += get_translation('edit_song_title') + ': ' + songdata.title + '\n\n';
            cont += get_translation('edit_lyrics') + ':\n\n';
            const type = $('#page-edit-textarea [name=edit-type]:checked').val();
            if (type == 'elvanto') cont += convert_to_elvanto(songdata.songxml);
            else cont += convert_to_pre(songdata.songxml, type == 'opensong');
        }
    } // new song
    else cont += get_translation('edit_song_title') + ': \n\n\n';

    input.html(cont).data({ orig: cont });
}

export function init_edit_page() {
    const page = $('#page-edit-textarea');
    const submit_button = page.find('#edit-submit');

    page.find('[name=edit-type]').change(function () {
        if (page.find('.textarea').data('type') == 'change') update_edit_songdata();
    });
    page.on('pagebeforeshow', () => {
        submit_button.removeAttr('disabled');
        update_edit_songdata();
    });

    // Change any pastes to plain text
    page.find('.textarea').on('paste', (e: any) => {
        let text = '';

        if (e.clipboardData || e.originalEvent.clipboardData) text = (e.originalEvent || e).clipboardData.getData('text/plain');
        else if (window.clipboardData) text = window.clipboardData.getData('Text');

        ['insertText', 'paste'].forEach((fn) => {
            if (document.queryCommandSupported(fn)) {
                try {
                    document.execCommand(fn, false, text);
                    e.preventDefault();
                    return;
                } catch (e) {
                    // old ff has some issue insertText per
                    // https://bugzilla.mozilla.org/show_bug.cgi?format=default&id=1130651
                    // fall through to the paste command if possible
                }
            }
        });

        // Nothing possible, don't preventDefault on the event so hopefully the
        // browser will do it itself
    });

    submit_button.click(function () {
        let song = page.find('.textarea');
        let success = () => {
            page.dialog('close');

            // timeout to allow transitions to finish
            setTimeout(() => $('#edit-submit-success').popup('open', { history: false }), 300);
        };

        let orig = song.data('orig');
        if (orig == song.html())
            // Not changed
            return success();

        let send_data = song.html();
        let orig_title = $('#primary-song .songxml').data('songdata').title;
        if (song.data('type') == 'change') {
            let prepend = 'song_id: ' + $('#songinfo').data('song_id') + '\n' + 'orig_title: ' + orig_title + '\n' + '\n';
            send_data = prepend + send_data;
            orig = prepend + orig;
        } else orig = '';

        submit_button.attr('disabled', 'disabled');

        const formData = new URLSearchParams({
            orig,
            form: send_data,
            format: String($('#page-edit-textarea [name=edit-type]:checked').val()),
            uuid: get_uuid(),
        });

        fetch_json(get_host() + '/api/app/song_upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        })
            .then(success, () => $('#edit-submit-failed').popup('open', { history: false }))
            .finally(() => submit_button.removeAttr('disabled'));
    });
}
