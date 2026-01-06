// Minimal module loaded or inlined to show the splash screen while loading the rest of the app
// Doesn't have any of the es5 polfills included but is processed by babel into es5 correctly.

import './splash.scss';

import worship_leader_text_data from '../langpack/worship-leader.json';
import { get_app_languages } from './langdetect.es5';

const worship_leader_text = worship_leader_text_data as Record<string, string>;
const elem = document.getElementById('splash-text');

// Try to load localized version of the splashscreen, otherwise default to english.
const to_try = get_app_languages();
for (const lang of to_try) {
    const text = worship_leader_text[lang];
    if (text && elem) {
        elem.innerHTML = text;
        break;
    }
}
