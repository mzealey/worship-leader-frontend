import { delete_downloaded_file, download_file, DownloadState, get_downloaded_file, get_downloaded_files, get_file, remove_file } from '../file-download-utils';
import { get_translation } from '../langpack';

export function setup_download_btn(song, file, file_key, set_src) {
    let btn = $('<div class="btn ui-btn-icon-right">')
        .addClass(file.download_path ? 'ui-icon-forward' : 'ui-icon-download')
        .attr('title', get_translation('download_link'))
        .click(() => {
            // Special-case to cache audio files locally
            if (btn.hasClass('active')) {
                // Remove file
                remove_file(get_downloaded_file(file_key)!).then(() => {
                    download_set_class({ loading: 0, active: 0 });
                    delete_downloaded_file(file_key);
                    set_src(file.path);
                });
            } else download_file(song.id, file, song.title, download_set_class, set_src);
        });

    function download_set_class({ loading, active }: DownloadState) {
        btn.toggleClass('active', !!active);
        btn.toggleClass('loading', !!loading);
    }

    // Toggle link based on whether file actually exists or not if it
    // was previously downloaded.
    //
    // TODO: Compare to see if the server's modtime is greater than our
    // timestamp and if so then mark it as not downloaded & remove.
    if (file_key in get_downloaded_files()) {
        get_file(get_downloaded_file(file_key)!).then(
            () => {
                download_set_class({ loading: 0, active: 1 });
            },
            () => {
                delete_downloaded_file(file_key);

                // Revert to the original what it should have been
                set_src(file.path);
            },
        );
    }

    return btn;
}
