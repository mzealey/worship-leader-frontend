import { spinner } from '../component/spinner';
import { get_main_domain } from '../globals';
import { get_translation } from '../langpack';
import { is_cordova, is_mobile_browser } from '../util';

let share_data;

// Returns a promise which resolves or rejects to indicate whether user shared
// in the end or cancelled, and a 1/0 indicating whether it was done externally
// or via a jqm dialog (if externally then you will need to close any dialogs)
export function handle_share(url, title, subject, file?) {
    if (!/^http/i.test(url)) url = get_main_domain() + '/' + url;

    // SocialSharing-PhoneGap-Plugin
    if (is_cordova() && window.plugins.socialsharing) {
        let options: Record<string, any> = {
            message: `${subject}: ${url}`,
            url,
            subject,
            chooserTitle: title,
        };

        // Note that on android at least, socialsharing downloads these files
        // locally and then sends them rather than just sharing as a link
        // attachement. See my issue at
        // https://github.com/EddyVerbruggen/SocialSharing-PhoneGap-Plugin/issues/1006
        // for notes about why we need to decodeURI this.
        if (file) options.files = [window.decodeURI(file)];

        // TODO: Catch rejects and/or only log share feedback on success?
        return spinner(
            new Promise((resolve, reject) =>
                window.plugins.socialsharing.shareWithOptions(
                    options,
                    () => resolve(1),
                    () => reject(1),
                ),
            ),
        );
    }

    const show_sharer_page = () => {
        // Share within the page itself
        share_data = { url, title, subject, file };
        $.mobile.changePage('#page-sharer');
        return Promise.resolve(0);
    };

    if (BUILD_TYPE != 'www' && 'share' in window.navigator) {
        let options = { title, url, text: subject };
        if (file) {
            options.text += ` ${url}`;
            options.url = file;
        }

        // https://wicg.github.io/web-share/ (only works on https)
        // Fallback to jqm if sharing failed for some reason
        return window.navigator.share(options).catch(() => show_sharer_page());
    }

    return show_sharer_page();
}

export function init_sharer() {
    const page = $('#page-sharer');
    page.on('pageinit', () => {
        // Should get a custom url filled in below as well to actually execute the task
        page.on('click', '.ui-content a', () => window.history.back());

        $('#share-link').click(function () {
            $(this).select();
        });

        if (!is_mobile_browser()) {
            $('#share-sms').remove();
            $('#share-whatsapp').remove();
        }
    });
    page.on('pageshow', () => {
        if (!share_data) return $.mobile.changePage('#songinfo');

        if (share_data.file) {
            share_data.subject += ` ${share_data.url}`;
            share_data.url = share_data.file;
        }

        let url_and_msg = `${share_data.subject}: ${share_data.url}`;

        // mailto doesn't seem to like uri-encoded stuff in kmail but tbird etc work ok
        $('#share-email').attr('href', 'mailto:?' + $.param({ subject: share_data.subject, body: share_data.url }));

        $('#share-sms').attr('href', 'sms:?' + $.param({ body: url_and_msg }));
        $('#share-whatsapp').attr('href', 'whatsapp://send?' + $.param({ text: url_and_msg }));

        // needs an app id
        //$('#share-facebook').attr('href', 'https://www.facebook.com/dialog/share?' + $.param({ display: 'popup', href: share_data.url }) );
        $('#share-facebook').attr(
            'href',
            'https://www.facebook.com/sharer/sharer.php?' + $.param({ u: share_data.url, caption: get_translation('worship-leader') }),
        );

        $('#share-vk').attr('href', 'https://vk.com/share.php?' + $.param({ url: share_data.url, title: share_data.subject }));
        $('#share-link').val(share_data.url);
    });
}
