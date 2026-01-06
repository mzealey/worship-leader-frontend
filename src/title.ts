import { get_translation } from './langpack';

export function set_title(title = '') {
    if (title) title += ' - ';

    title += get_translation('worship-leader');
    document.title = title;
}
