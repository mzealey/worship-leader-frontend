import { convert_to_pre } from '../songxml-util';

function update_copy_songdata() {
    let cont = '';
    let songdata = $('#primary-song .songxml').data('songdata');
    if (songdata) {
        const type = $('#page-copy-textarea [name=copy-type]:checked').val();
        cont += convert_to_pre(songdata.songxml, type == 'opensong', true);
    }
    $('#page-copy-textarea .textarea').html(cont);
}

export function init_copy_page() {
    const page = $('#page-copy-textarea');
    page.find('[name=copy-type]').change(update_copy_songdata);
    page.on('pagebeforeshow', update_copy_songdata);
}
