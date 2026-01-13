import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    Grid,
    LinearProgress,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    TextField,
    Typography,
} from '@mui/material';
import { Suspense, use, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DialogTitleWithClose, ListCheckbox, ThinPage } from '../component/basic';
import { send_ui_notification } from '../component/notification';
import { TopBar } from '../component/top-bar';
import { DB_AVAILABLE } from '../db';
import { DbLangEntry, getDbLangs } from '../db-language-utils';
import { save_db_chosen_langs } from '../db/common';
import { useTranslation } from '../langpack';
import { useDialog } from '../preact-helpers';
import { LOCALE_SORT } from '../sort-helpers';
import { unidecode } from '../unidecode';

interface LangSelectorProps {
    code: string;
    content: string;
    count: number;
    defaultValue: boolean;
    onChange: (code: string, selected: boolean) => void;
}

const LangSelector = ({ code, content, count, defaultValue, onChange }: LangSelectorProps) => {
    const [selected, setSelected] = useState(false);

    useEffect(() => {
        setSelected(defaultValue);
    }, [defaultValue]);

    const toggleLang = () => {
        const newSelected = !selected;
        setSelected(newSelected);
        onChange(code, newSelected);
    };

    return (
        <ListItem disablePadding secondaryAction={count}>
            <ListItemButton onClick={toggleLang}>
                <ListItemIcon>
                    <ListCheckbox checked={!!selected} />
                </ListItemIcon>
                <ListItemText primary={content} />
            </ListItemButton>
        </ListItem>
    );
};

function LanguageSelectorGroup({
    entries,
    selectedLangs,
    onChange,
}: {
    entries: DbLangEntry[];
    selectedLangs: Set<string>;
    onChange: (code: string, selected: boolean) => void;
}) {
    const { lang_name } = useTranslation();
    return (
        <>
            {entries.map((l) => (
                <LangSelector
                    key={l.code}
                    code={l.code}
                    content={lang_name(l.code)}
                    count={l.count}
                    defaultValue={selectedLangs.has(l.code)}
                    onChange={onChange}
                />
            ))}
        </>
    );
}

const DbLanguageSelectorInner = ({
    dbLangPromise,
    selectedLangs,
    setSelectedLangs,
}: {
    dbLangPromise: Promise<DbLangEntry[] | undefined>;
    selectedLangs: Set<string>;
    setSelectedLangs: (selectedLangs: Set<string>) => void;
}) => {
    const { t, lang_name } = useTranslation();

    const [filterText, setFilterText] = useState('');
    // Use deferred value to debounce the filter and avoid blocking typing
    const deferredFilterText = useDeferredValue(filterText);

    const all_langs = use(dbLangPromise);
    if (!all_langs || !all_langs.length) {
        // TODO: If error returned then show the retry button
        // <Alert message={t('db-langs-download-error')} onClose={() => setDownloadError(false)} />
        return null;
    }
    useEffect(() => setSelectedLangs(new Set(all_langs.filter((e) => e.selected).map((e) => e.code))), [all_langs]);

    const updateSelectedLangs = (code: string, val: boolean) => {
        const newSelectedLangs = new Set(selectedLangs);
        if (val) newSelectedLangs.add(code);
        else newSelectedLangs.delete(code);
        setSelectedLangs(newSelectedLangs);
    };

    // Memoize sorted languages to avoid re-sorting on every render
    const sortedLangs = useMemo(() => {
        const sorted = [...all_langs];
        sorted.sort((a, b) => LOCALE_SORT(lang_name(a.code), lang_name(b.code)));
        return sorted;
    }, [all_langs, lang_name]);

    // Memoize split of top/bottom languages
    const { topLangs, bottomLangs } = useMemo(() => {
        const top = sortedLangs.filter((e) => e.position === 'top');
        const bottom = sortedLangs.filter((e) => e.position === 'bottom');
        return { topLangs: top, bottomLangs: bottom };
    }, [sortedLangs]);

    // Memoize filtered bottom languages using deferred filter text
    const filteredBottomLangs = useMemo(() => {
        if (!deferredFilterText) return bottomLangs;
        return bottomLangs.filter((e) => e.unidecoded.includes(deferredFilterText) || selectedLangs.has(e.code));
    }, [bottomLangs, deferredFilterText, selectedLangs]);

    return (
        <Box width="100%">
            <p>{t('db-langs-intro')}</p>

            <List dense>
                <ListSubheader disableSticky>Top languages in your area</ListSubheader> {/* TODO: Trans */}
                <LanguageSelectorGroup entries={topLangs} selectedLangs={selectedLangs} onChange={updateSelectedLangs} />
            </List>

            <List dense>
                <ListSubheader disableSticky>Other languages</ListSubheader> {/* TODO: Trans */}
                <ListItem disablePadding>
                    <TextField
                        label={t('choose_language')}
                        fullWidth
                        type="search"
                        onChange={(e) => {
                            const value = e.target.value.toLowerCase();
                            // Call unidecode but don't await it - just update when it resolves
                            unidecode(value).then(setFilterText);
                        }}
                    />
                </ListItem>
                <LanguageSelectorGroup entries={filteredBottomLangs} selectedLangs={selectedLangs} onChange={updateSelectedLangs} />
            </List>
        </Box>
    );
};

function DbLanguageSelector({
    alreadySetup,
    selectedLangs,
    setSelectedLangs,
}: {
    alreadySetup: boolean;
    selectedLangs: Set<string>;
    setSelectedLangs: (selectedLangs: Set<string>) => void;
}) {
    const { lang_name } = useTranslation();
    const [dbLangPromise] = useState(getDbLangs({ alreadySetup, lang_name }));

    return (
        <Suspense
            fallback={
                <Grid container spacing={0} direction="row" alignItems="center" justifyContent="center" style={{ minHeight: '50vh', flexGrow: 1 }}>
                    <CircularProgress />
                </Grid>
            }
        >
            <DbLanguageSelectorInner dbLangPromise={dbLangPromise} selectedLangs={selectedLangs} setSelectedLangs={setSelectedLangs} />
        </Suspense>
    );
}

function DbUpdateButton({ onClose, selectedLangs }: { onClose?: () => void; selectedLangs: Set<string> }) {
    const { t } = useTranslation();
    const [inProgress, setInProgress] = useState(false);
    const [progressPerc, setProgressPerc] = useState(0);
    const [_downloadError, setDownloadError] = useState(false);

    const updateDbLangs = async () => {
        if (!selectedLangs.size) return;

        setInProgress(true);
        setProgressPerc(0);
        save_db_chosen_langs(Array.from(selectedLangs));

        try {
            const db = await DB_AVAILABLE;
            await db.refresh_languages(false, false, (progress_perc) => setProgressPerc(progress_perc));

            if (onClose) onClose();

            send_ui_notification({ message_code: 'db-langs-update-succeeded' });
        } catch (e) {
            setDownloadError(true);
            setInProgress(false);
        }
    };

    if (inProgress) {
        return (
            <div style={{ flexGrow: 1, backgroundColor: 'white', padding: '20px 20px' }}>
                <LinearProgress variant="determinate" value={progressPerc * 100} />
                <Typography align="center">{Math.floor(progressPerc * 100)}%</Typography>
            </div>
        );
    }
    /* TODO: Handle retries
    if (needRetry)
        return (
            <Button color="primary" variant="contained" fullWidth size="large" onClick={langsTryLoad}>
                {t('retry')}
            </Button>
        );
        */

    return (
        <Button color="primary" variant="contained" fullWidth size="large" disabled={selectedLangs.size == 0} onClick={updateDbLangs}>
            {t('button-update-db-langs')}
        </Button>
    );
}

interface DialogDbLangsProps {
    onClose?: () => void;
}

export const DialogDbLangs = ({ onClose }: DialogDbLangsProps) => {
    const { t } = useTranslation();
    const { closed, handleClose } = useDialog(onClose);

    const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());

    return (
        <Dialog open={!closed} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitleWithClose handleClose={handleClose}>{t('db_langs_title')}</DialogTitleWithClose>

            <DialogContent dividers>
                <DbLanguageSelector alreadySetup={true} selectedLangs={selectedLangs} setSelectedLangs={setSelectedLangs} />
            </DialogContent>

            <DialogActions>
                <DbUpdateButton onClose={handleClose} selectedLangs={selectedLangs} />
            </DialogActions>
        </Dialog>
    );
};

export const PageDbLangs = ({ onClose }: { onClose?: () => void }) => {
    const { t } = useTranslation();
    const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());

    return (
        <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center">
            <TopBar title={t('db_langs_title')} noMenu />
            <ThinPage>
                <Box flexGrow={1} display="flex" width="100%">
                    <DbLanguageSelector alreadySetup={false} selectedLangs={selectedLangs} setSelectedLangs={setSelectedLangs} />
                </Box>
            </ThinPage>
            <Box height={60} /> {/* TODO: set height according to the button size */}
            <Box position="fixed" left={0} right={0} bottom={0}>
                <DbUpdateButton selectedLangs={selectedLangs} onClose={onClose} />
            </Box>
        </Box>
    );
};
