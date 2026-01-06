import { enter_cast_mode } from '../dual-present';
import { enter_single_presentor_mode } from './songinfo';

export function init_present_dialog() {
    const page = $('#page-present');
    page.on('pageinit', () => {
        page.find('#present-monitor').on('click', () => {
            window.history.back();
            enter_single_presentor_mode();
        });
        page.find('#present-cast').on('click', () => {
            window.history.back();
            setTimeout(enter_cast_mode, 100);
        });
    });
}
