import { persistentStorage } from './persistent-storage.es5';

interface PromptConfig {
    href?: string;
    target?: string;
    component?: string;
    onClick?: () => void;
}

export const get_app_dl_link = (): PromptConfig | undefined => {
    const ua = navigator.userAgent;

    if (/IEMobile/i.test(ua)) {
        // IE fakes ios/android so skip that
        return undefined;
    }

    if (/iPhone|iPad|iPod/i.test(ua)) {
        return { href: 'https://itunes.apple.com/us/app/worship-leader-world-language/id574971903' };
    } else if (/Android/i.test(ua)) {
        return { href: 'https://play.google.com/store/apps/details?id=com.mzealey.worship.leader' };
    }

    // Chrome browser supporting extensions
    if (typeof window.chrome?.runtime?.sendMessage === 'function') {
        return { href: 'https://chrome.google.com/webstore/detail/worship-leader/mjklaaodihaohclhbebonimanionolac', target: '_blank' };
    }

    return undefined;
};

export const should_show_prompt = (): boolean => {
    const APP_PROMPT_KEY = 'last-app-prompt';
    let PROMPT_FREQUENCY = 25 * 24 * 60 * 60 * 1000; // prompt once a month, but only after the first few uses.
    //PROMPT_FREQUENCY = 0;     // for dev
    const uses = persistentStorage.getObj<number>('uses', 0);
    if (uses < 5) {
        return false;
    }

    const now = Date.now();
    const last_prompt = persistentStorage.getObj<number>(APP_PROMPT_KEY, 0);
    if (last_prompt) {
        if (now - last_prompt < PROMPT_FREQUENCY) {
            return false;
        }
    }

    persistentStorage.setObj(APP_PROMPT_KEY, now);
    return true;
};
