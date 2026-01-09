import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    Grid,
    LinearProgress,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    NativeSelect,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ImageButton, ThinPage } from '../component/basic';
import * as Icon from '../component/icons';
import { send_ui_notification } from '../component/notification';
import { TopBar } from '../component/top-bar';
import { UILanguageChooser } from '../component/uilanguagechooser';
import * as dbModule from '../db';
import { may_support_offline, switch_db_api } from '../db-init';
import { get_presentation, useCast } from '../dual-present';
import { eventSocket } from '../event-socket';
import { get_client_type, get_uuid } from '../globals';
import { useTranslation } from '../langpack';
import { get_meta_db_update_ts } from '../meta-db';
import { persistentStorage } from '../persistent-storage.es5';
import { Settings, useSetting } from '../settings-store';
import { date_as_utc, is_cordova } from '../util';
import { DialogDbLangs } from './db-langs';

interface VersionOptions {
    db?: string;
    db_load_errors?: string;
}

// TODO: Redux this
const SettingsPageVersion = () => {
    const [options, setOptions] = useState<VersionOptions>({});

    useEffect(() => {
        const updateDbInfo = () => {
            dbModule.DB_AVAILABLE.then((db) => {
                const newOptions = { ...options };
                newOptions.db = db.get_version_string();
                if (db.db_load_errs) {
                    newOptions.db_load_errors = Array.isArray(db.db_load_errs) ? db.db_load_errs.join(',') : db.db_load_errs;
                }
                setOptions(newOptions);
            });
        };

        updateDbInfo();

        const subscription = dbModule.on_db_change.subscribe(() => {
            updateDbInfo();
        });

        return () => subscription.unsubscribe();
    }, []);

    const lines: Record<string, string> = {
        persistent_storage: persistentStorage.type(),
        code: get_uuid(),
        client: get_client_type(),
        version: APP_VERSION,
        build: BUILD_TYPE,
        current_ts: date_as_utc(new Date()),
        meta_ts: date_as_utc(new Date(get_meta_db_update_ts() ?? 0)),
        offline_status: navigator.onLine ? 'online' : 'offline',
        event_socket: eventSocket.type(),
        ...(options.db ? { db: options.db } : {}),
        ...(options.db_load_errors ? { db_load_errors: options.db_load_errors } : {}),
    };

    return (
        <Box maxWidth="100%">
            {Object.keys(lines).map((line) => (
                <div key={line}>
                    {line}: {lines[line].replace(/,/g, ', ')}
                </div>
            ))}
        </Box>
    );
};

const SettingCheckbox = ({ setting }: { setting: keyof Settings }) => {
    const { t } = useTranslation();
    const [isSet, setSetting] = useSetting(setting) as [boolean, (_isSet: boolean) => void];

    const toggle = () => setSetting(!isSet);

    return (
        <ListItem dense disablePadding>
            <ListItemButton onClick={toggle}>
                <ListItemIcon>
                    <Checkbox checked={isSet} edge="start" disableRipple readOnly />
                </ListItemIcon>
                <ListItemText primary={t(`setting-${setting}`)} />
            </ListItemButton>
        </ListItem>
    );
};

const ChordColorGroup = () => {
    const { t } = useTranslation();
    const [color] = useSetting('chord-color');

    useEffect(() => {
        // TODO: Color picker - Previous colors allowed
        //"000000","993300","333300","000080","333399","333333","800000","FF6600","808000","008000","008080","0000FF","666699","808080","FF0000","FF9900","99CC00","339966","33CCCC","3366FF","800080","999999","FF00FF","FFCC00","FFFF00","00FF00","00FFFF","00CCFF","993366","C0C0C0","FF99CC","FFCC99","FFFF99","CCFFFF","99CCFF","FFFFFF"
    }, []);

    return (
        <ListItem disablePadding>
            <ListItemButton>
                <ListItemIcon>
                    <div style={{ backgroundColor: color, width: 18, height: 18 }} />
                </ListItemIcon>
                <ListItemText primary={t('setting-chord-color') + ': ' + color} />
            </ListItemButton>
        </ListItem>
    );
};

interface ReloadDBBtnProps {
    fullWidth?: boolean;
}

const ReloadDBBtn = (props: ReloadDBBtnProps) => {
    const { t } = useTranslation();
    const [inProgress, setInProgress] = useState<boolean>(false);
    const [progressPerc, setProgressPerc] = useState<number>(0);

    const reloaddb = async () => {
        setInProgress(true);
        setProgressPerc(0);

        const finished = (message_code: string) => {
            setInProgress(false);
            send_ui_notification({ message_code });
        };

        try {
            const db = await dbModule.DB;
            await db.refresh_languages(false, true, (perc: number) => setProgressPerc(perc));
            finished('dbreload_success');
        } catch (e) {
            finished('dbreload_failed');
        }
    };

    if (inProgress) {
        return (
            <Box width="100%">
                <LinearProgress variant="determinate" value={(progressPerc || 0) * 100} />
                <Typography align="center">{Math.floor((progressPerc || 0) * 100)}%</Typography>
            </Box>
        );
    }

    return (
        <Button color="primary" variant="contained" onClick={reloaddb} {...props}>
            {t('button-reloaddb')}
        </Button>
    );
};

export const PageSettings = () => {
    const { t } = useTranslation();
    const show_cast_scan = useCast((state) => state.supported && !state.available);
    const [display_lyrics] = useSetting('display-lyrics');
    const [_display_chords] = useSetting('display-chords');
    const display_chords = display_lyrics && _display_chords;
    const [theme, setTheme] = useSetting('theme');
    const [zoom, setZoom] = useSetting('song-zoom');
    const [dbType, setDbType] = useState<string>('');
    const [showDbLang, setShowDbLang] = useState<boolean>(false);

    useEffect(() => {
        dbModule.DB_AVAILABLE.then((db) => setDbType(db.type()));

        const subscription = dbModule.on_db_change.subscribe(() => {
            dbModule.DB_AVAILABLE.then((db) => setDbType(db.type()));
        });

        return () => subscription.unsubscribe();
    }, []);

    const switch_db_type = (newDbType: string) => {
        switch_db_api(newDbType === 'offline', true);
    };

    return (
        <ThinPage>
            <TopBar title={t('settings')}>
                <ImageButton component="a" href="mailto:contact@worshipleaderapp.com" icon={Icon.Mail}>
                    {t('contact')}
                </ImageButton>
            </TopBar>
            <Grid container spacing={2} direction="column">
                <Grid>
                    <FormControlLabel
                        style={{ width: '100%' }}
                        label={t('setting-lang')}
                        labelPlacement="start"
                        control={<UILanguageChooser style={{ flexGrow: 1 }} />}
                    />
                </Grid>

                <Grid>
                    {/* TODO: translate */}
                    <FormControlLabel
                        style={{ width: '100%' }}
                        label={t('setting-theme')}
                        labelPlacement="start"
                        control={
                            <NativeSelect onChange={(e) => setTheme(e.target.value as Settings['theme'])} value={theme} style={{ flexGrow: 1 }}>
                                <option value="">Default on device mode</option>
                                <option value="light">Light mode</option>
                                <option value="dark">Dark mode</option>
                            </NativeSelect>
                        }
                    />
                </Grid>

                <Grid>
                    <FormControlLabel
                        label={t('setting-zoom')}
                        labelPlacement="start"
                        style={{ width: '100%' }}
                        control={
                            <NativeSelect onChange={(e) => setZoom(e.target.value as Settings['song-zoom'])} value={zoom} style={{ flexGrow: 1 }}>
                                <option value="vsmall">{t('zoom-vsmall')}</option>
                                <option value="small">{t('zoom-small')}</option>
                                <option value="medium">{t('zoom-medium')}</option>
                                <option value="large">{t('zoom-large')}</option>
                                <option value="xlarge">{t('zoom-xlarge')}</option>
                                <option value="xxlarge">{t('zoom-xxlarge')}</option>
                            </NativeSelect>
                        }
                    />
                </Grid>

                {showDbLang && <DialogDbLangs onClose={() => setShowDbLang(false)} />}
                <Grid>
                    <Button color="primary" variant="contained" onClick={() => setShowDbLang(true)} fullWidth>
                        {t('button-choose-song-languages')}
                    </Button>
                </Grid>

                <Grid>
                    <List>
                        <SettingCheckbox setting="display-lyrics" />

                        {display_lyrics && <SettingCheckbox setting="display-chords" />}

                        {display_chords && <SettingCheckbox setting="show-fingering" />}
                        {display_chords && <SettingCheckbox setting="use-solfege" />}
                        {display_chords && <ChordColorGroup />}

                        {display_chords && <SettingCheckbox setting="show-key-in-list" />}

                        {display_lyrics && <SettingCheckbox setting="sidebyside" />}

                        {is_cordova() && window.plugins && window.plugins.insomnia && <SettingCheckbox setting="poweron" />}
                    </List>
                </Grid>

                {may_support_offline() && (
                    <Grid>
                        <FormControlLabel
                            style={{ width: '100%' }}
                            label={t('setting-db')}
                            labelPlacement="start"
                            control={
                                <NativeSelect onChange={(e) => switch_db_type(e.target.value)} value={dbType} style={{ flexGrow: 1 }}>
                                    <option value="online">{t('db-type-online')}</option>
                                    <option value="offline">{t('db-type-offline')}</option>
                                </NativeSelect>
                            }
                        />
                    </Grid>
                )}

                {dbType === 'offline' && (
                    <Grid>
                        <ReloadDBBtn fullWidth />
                    </Grid>
                )}

                {show_cast_scan && (
                    <Grid>
                        <Button color="primary" variant="contained" fullWidth onClick={() => get_presentation().then((p) => p.enter_cast_mode())}>
                            {t('cast_scan')}
                        </Button>
                    </Grid>
                )}

                <Grid>
                    <SettingsPageVersion />
                </Grid>
            </Grid>
        </ThinPage>
    );
};
