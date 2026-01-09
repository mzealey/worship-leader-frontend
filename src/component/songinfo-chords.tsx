import { FormControlLabel, NativeSelect } from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../langpack';
import { SET_DB } from '../set-db';
import type { SetSwitcher } from '../set-switcher';
import { maybe_convert_solfege } from '../solfege-util';
import { Song } from '../song';
import { Transpose } from '../transpose';
import type { TransposeDetails } from '../transpose-details';

const trans = new Transpose();

export const ChordSelect = ({ song, transpose, set_switcher }: { song: Song; transpose: TransposeDetails; set_switcher?: SetSwitcher }) => {
    const { t } = useTranslation();
    const [key, setKey] = useState<string | number>('');
    const [options, setOptions] = useState<ReactElement[]>([]);
    const [title, setTitle] = useState<string>('');

    const update_key_changer = useCallback(
        (newKey: string | number, save?: boolean) => {
            transpose.update_key(newKey, save);
            setKey(newKey);
        },
        [transpose],
    );

    const refresh_key_changer = useCallback(() => {
        const newOptions: ReactElement[] = [];
        let newKey: string | number;

        const startKey = transpose.startKeyName;
        if (startKey) {
            trans.keys
                // Show whatever key the song claims it is, and all the keys that are sensible to show as well
                .filter((item) => item.name == startKey || (!item.hidden && (transpose.is_minor ? 'minor' : 'major') in item))
                .map((item) => item.name)
                .map((val) => {
                    let opttext = maybe_convert_solfege(val) + (transpose.is_minor ? 'm' : '');

                    newOptions.push(
                        <option key={val} value={val}>
                            {opttext}
                            {val == startKey && ' ' + t('original_key')}
                        </option>,
                    );
                });
            newKey = startKey;
        } else {
            for (let i = -11; i < 12; i++)
                newOptions.push(
                    <option key={i} value={i}>
                        {i}
                    </option>,
                );
            newKey = 0;
        }

        setOptions(newOptions);
        setTitle(startKey ? 'key_text' : 'semitone_text');
        update_key_changer(newKey);
    }, [transpose, t, update_key_changer]);

    const refresh_from_set = useCallback(() => {
        if (SET_DB && set_switcher) {
            SET_DB.get_song_set_details(set_switcher.set_id, song.id).then((details) => {
                if (details && details.song_key !== undefined) update_key_changer(details.song_key);
            });
        }
    }, [song, set_switcher, update_key_changer]);

    useEffect(() => {
        refresh_key_changer();
        refresh_from_set();
    }, [song, transpose, set_switcher, refresh_key_changer, refresh_from_set]);

    const update_save_key = (e: React.ChangeEvent<HTMLSelectElement>) => update_key_changer(e.target.value, true);

    return (
        <FormControlLabel
            label={t(title)}
            labelPlacement="start"
            control={
                <NativeSelect title={t(title)} value={key} onChange={update_save_key}>
                    {options}
                </NativeSelect>
            }
        />
    );
};

export const CapoChange = ({ song_id, transpose, set_switcher }: { song_id: number; transpose: TransposeDetails; set_switcher?: SetSwitcher }) => {
    const { t } = useTranslation();
    const [capoValue, setCapoValue] = useState(0);

    const update_capo = useCallback(
        (newCapo: number, save?: boolean) => {
            transpose.update_capo(newCapo, save);
            setCapoValue(newCapo);
        },
        [transpose],
    );

    const refresh_capo = useCallback(() => {
        update_capo(transpose.song_capo || 0);
    }, [transpose, update_capo]);

    const refresh_from_set = useCallback(() => {
        if (SET_DB && set_switcher) {
            SET_DB.get_song_set_details(set_switcher.set_id, song_id).then((details) => {
                if (details && details.capo !== undefined) update_capo(details.capo);
            });
        }
    }, [song_id, set_switcher, update_capo]);

    useEffect(() => {
        refresh_capo();
        refresh_from_set();
    }, [song_id, transpose, set_switcher, refresh_capo, refresh_from_set]);

    const update_save_capo = (e: React.ChangeEvent<HTMLSelectElement>) => update_capo(parseInt(e.target.value, 10), true);

    return (
        <FormControlLabel
            label={t('capo')}
            labelPlacement="start"
            control={
                <NativeSelect title={t('capo')} value={capoValue} onChange={update_save_capo} data-value={capoValue}>
                    {' '}
                    {/* data-value for masking with css during prints */}
                    <option value="0">{t('none')}</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                </NativeSelect>
            }
        />
    );
};
