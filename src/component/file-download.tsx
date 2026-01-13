import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { delete_downloaded_file, download_file, get_downloaded_file, get_file, remove_file } from '../file-download-utils';
import { useTranslation } from '../langpack';
import { clsx } from '../preact-helpers';
import { Song } from '../song';
import { MediaFile } from '../util';
import { Download, Link } from './icons';

interface DownloadButtonProps {
    down_file_key: string;
    file: MediaFile & {
        id: number | string;
    };
    song: Song;
    onDownload: (path: string) => void;
}

export const DownloadButton = ({ down_file_key, file, song, onDownload }: DownloadButtonProps) => {
    const { t } = useTranslation();
    const [active, setActive] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Toggle link based on whether file actually exists or not if it
        // was previously downloaded.
        //
        // TODO: Compare to see if the server's modtime is greater than our
        // timestamp and if so then mark it as not downloaded & remove.
        const existing = get_downloaded_file(down_file_key);
        if (existing) {
            get_file(existing).then(
                () => {
                    setActive(true);
                },
                () => {
                    delete_downloaded_file(down_file_key);

                    // Revert to the original what it should have been
                    onDownload(file.path);
                },
            );
        } else {
            setActive(false);
        }
    }, [down_file_key, file.path, onDownload]);

    const download = () => {
        // Special-case to cache audio files locally
        if (active) {
            // Remove file
            const existing = get_downloaded_file(down_file_key);
            if (!existing) {
                setActive(false);
                setLoading(false);
                onDownload(file.path);
                return;
            }
            remove_file(existing).then(() => {
                setActive(false);
                setLoading(false);
                delete_downloaded_file(down_file_key);
                onDownload(file.path);
            });
        } else {
            download_file(
                song.id,
                file,
                song.title,
                (state: { active?: number; loading?: number }) => {
                    if ('active' in state) setActive(state.active === 1);
                    if ('loading' in state) setLoading(state.loading === 1);
                },
                (src: string | undefined) => onDownload(src ?? ''),
            );
        }
    };

    return (
        <IconButton
            size="small"
            color="primary"
            className={clsx(active && 'active', loading && 'loading')}
            title={t('download_link')}
            onClick={download}
            sx={(theme) => ({
                '&.active': {
                    color: theme.palette.secondary.main,
                },
                '&.loading': {
                    animation: 'loading 2s linear infinite',
                },
                '@keyframes loading': {
                    '0%': { color: theme.palette.primary.main },
                    '50%': { color: theme.palette.secondary.main },
                    '100%': { color: theme.palette.primary.main },
                },
            })}
        >
            {file.download_path ? <Link /> : <Download />}
        </IconButton>
    );
};
