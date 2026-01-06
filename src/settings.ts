import { relocalize_page } from './langpack';
import { persistentStorage } from './persistent-storage.es5';
import { get_setting, is_set } from './splash-util.es5';
import { is_cordova } from './util';

export function update_setting(setting, value) {
    persistentStorage.set(setting, value);
    if (setting == 'setting-poweron') update_poweron();
    else if (setting == 'setting-show-help') update_setting('setting-show-help-changed', 'true');
    else if (setting == 'setting-lang') relocalize_page($('body')); // Relocalize the whole app
}

export function update_poweron() {
    if (is_cordova() && window.plugins && window.plugins.insomnia) {
        if (is_set('setting-poweron')) window.plugins.insomnia.keepAwake();
        else window.plugins.insomnia.allowSleepAgain();
    }
}

export { get_setting, is_set };
