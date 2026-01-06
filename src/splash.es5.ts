// Minimal module loaded or inlined to show the splash screen while loading the rest of the app
// Doesn't have any of the es5 polfills included but is processed by babel into es5 correctly.

import './splash.scss';

import { get_app_languages } from './langdetect.es5';

const img = document.getElementById('splash-img') as HTMLImageElement;

// Try to load localized version of the splashscreen, otherwise default to english.
let splash_imgs = ['en', 'tr', 'ru', 'mn', 'kk', 'ug-CN', 'kk-CN', 'ar', 'kmr', 'sk', 'cs', 'pt', 'az', 'ky', 'bg', 'es', 'de'];
let to_try = get_app_languages();
for (const splash_lang of to_try) {
    if (splash_imgs.indexOf(splash_lang) >= 0) {
        img.src = 'splashscreens/' + splash_lang + '.jpg';
        break;
    }
}

// Fade in image nicely on load
img.onload = () => (img.className += 'img-loaded');
