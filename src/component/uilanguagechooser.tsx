import { NativeSelect } from '@mui/material';
import LANGPACK_INDEX from '../../langpack/index.json';
import { useAppLang } from '../langpack';
import { LOCALE_SORT } from '../sort-helpers';
import { is_rtl } from '../util';

type LangPackIndex = Record<string, string>;
const LANGPACK: LangPackIndex = LANGPACK_INDEX as LangPackIndex;

export const UILanguageChooser = (props: React.ComponentProps<typeof NativeSelect>) => {
    const { appLang, setLanguage } = useAppLang();
    const languages = Object.keys(LANGPACK);

    return (
        <NativeSelect value={appLang} onChange={(e) => setLanguage(e.target.value)} {...props}>
            {languages
                .sort((a, b) => LOCALE_SORT(LANGPACK[a], LANGPACK[b]))
                .map((code) => (
                    <option key={code} value={code} dir={is_rtl(LANGPACK[code]) ? 'rtl' : 'ltr'}>
                        {LANGPACK[code]}
                    </option>
                ))}
        </NativeSelect>
    );
};
