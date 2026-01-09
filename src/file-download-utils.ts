import { send_ui_notification } from './component/notification';
import { file_feedback } from './feedback';
import { get_client_type } from './globals';
import { get_translation } from './langpack';
import { persistentStorage } from './persistent-storage.es5';
import { is_chrome_extension, is_cordova } from './util';

import { MediaFileAdditionalData } from './util';

export type DownloadState = {
    loading: 0 | 1;
    active: 0 | 1;
};

interface DownloadableFile {
    id: number | string;
    path: string;
    download_path?: string;
}

type DownloadSetClass = (state: DownloadState) => void;
type SetSrc = (url: string | undefined) => void;

interface FileSystemFlags {
    create?: boolean;
    exclusive?: boolean;
}

interface DirectoryEntry {
    getFile(path: string, options: FileSystemFlags, success: (entry: FileEntry) => void, error: (err: DOMException) => void): void;
    toURL(): string;
}

interface FileEntry extends DirectoryEntry {
    remove(successCallback: () => void, errorCallback: (err: DOMException) => void): void;
}

interface CordovaFileSystem {
    externalApplicationStorageDirectory: string;
    externalDataDirectory?: string;
    dataDirectory: string;
}

interface CordovaInAppBrowser {
    open(url: string, target: string): WindowProxy | null;
}

interface CordovaGlobal {
    file: CordovaFileSystem;
    InAppBrowser?: CordovaInAppBrowser;
}

declare function resolveLocalFileSystemURL(url: string, success: (entry: DirectoryEntry) => void, error?: (err: DOMException) => void): void;

declare const cordova: CordovaGlobal;

declare const BackgroundTransfer: {
    BackgroundDownloader: new () => {
        createDownload(
            url: string,
            targetFile: FileEntry,
            title: string,
        ): {
            resultFile: FileEntry;
            startAsync(): Promise<number | undefined>;
        };
        removeDownload(downloadId: number): void;
    };
};

interface ChromeDownloadDelta {
    id?: number;
    state?: { current?: string } | undefined;
}

interface ChromeDownloadItem {
    id: number;
    exists?: boolean;
    filename: string;
}

interface ChromeDownloadsNamespace {
    download(options: { url: string }, callback: (downloadId: number) => void): void;
    onChanged: {
        addListener(listener: (delta: ChromeDownloadDelta) => void): void;
        removeListener(listener: (delta: ChromeDownloadDelta) => void): void;
    };
    search(query: { id?: number }, callback: (items: ChromeDownloadItem[]) => void): void;
    removeFile(downloadId: number, callback: () => void): void;
}

interface ChromeExtensionNamespace {
    isAllowedFileSchemeAccess(callback: (allowed: boolean) => void): void;
}

interface ChromeTabsNamespace {
    create(details: { url: string }): void;
}

interface ChromeRuntimeNamespace {
    lastError?: { message?: string };
    id?: string;
}

declare const chrome: {
    downloads: ChromeDownloadsNamespace;
    extension: ChromeExtensionNamespace;
    runtime: ChromeRuntimeNamespace;
    tabs: ChromeTabsNamespace;
};

// Data structure of files that we have downloaded and are stored locally (with
// url references)
export interface DownloadedFileDetails {
    download_id?: number;
    local_url?: string;
    ts?: number;
    file_name?: string;
    [key: string]: MediaFileAdditionalData;
}
let downloaded_files = persistentStorage.getObj<Record<string, DownloadedFileDetails>>('downloaded-files', {});
export const save_downloaded_files = () => persistentStorage.setObj('downloaded-files', downloaded_files);

export const get_downloaded_files = () => downloaded_files;
export const get_downloaded_file = (key: string): DownloadedFileDetails | undefined => downloaded_files[key];
export const set_downloaded_file = (key: string, details: DownloadedFileDetails) => {
    downloaded_files[key] = details;
    save_downloaded_files();
};
export const delete_downloaded_file = (key: string) => {
    delete downloaded_files[key];
    save_downloaded_files();
};

function get_download_fs(): Promise<DirectoryEntry> {
    return new Promise((resolve, reject) => {
        if (is_cordova()) {
            let path: string;

            // NOTE: Should be Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS) on android really.
            if (get_client_type() == 'and')
                path = cordova.file.externalApplicationStorageDirectory; // on android these are local to the app itself
            else path = cordova.file.externalDataDirectory || cordova.file.dataDirectory;

            if (typeof resolveLocalFileSystemURL === 'function') {
                resolveLocalFileSystemURL(
                    path,
                    (dirEntry) => resolve(dirEntry),
                    (err) => reject(err),
                );
            } else {
                reject(new Error('resolveLocalFileSystemURL unsupported'));
            }

            /* The below works, however there is no easy way to get the download location so cannot map the downloaded file to a file:// url...
        } else if( ('webkitRequestFileSystem' in window) && ('webkitPersistentStorage' in navigator) ) { // only in chrome & opera, standard revoked now
            let quota_size = 1024 * 1024 * 1024;        // size in bytes
            navigator.webkitPersistentStorage.requestQuota(
                quota_size,
                function() {
                    try {
                        window.webkitRequestFileSystem(
                            window.PERSISTENT || 1,
                            quota_size,
                            function(filesystem) { resolve( filesystem.root ) },
                            function(err) { reject(['requestFileSystem failed', err]) }
                        );
                    } catch(e) {
                        reject(['requestFileSystem threw error', e]);
                    }
                }, function(err) {
                    reject(["Error allocating quota", err]);
                }
            );
            */
        } else {
            reject(new Error('no request file system support'));
        }
    });
}

function open_file(dirEntry: DirectoryEntry, filename: string, options: FileSystemFlags) {
    return new Promise<FileEntry>((resolve, reject) =>
        dirEntry.getFile(
            filename,
            options,
            (targetFile) => resolve(targetFile),
            (err) => reject(err),
        ),
    );
}

export async function try_window_open_download(path: string) {
    // Try cordova special in ios at least required
    if (is_cordova() && cordova.InAppBrowser?.open) {
        if (cordova.InAppBrowser.open(path, '_system')) return 'cordova open';
    }

    if (window.open(path, '_blank')) return 'by window.open _blank';

    throw 'window open failed';
}

let alert_shown = false;
export async function is_local_url_allowed(): Promise<boolean> {
    if (is_chrome_extension()) {
        return new Promise((resolve) =>
            chrome.extension.isAllowedFileSchemeAccess((allowed: boolean) => {
                if (!allowed && !persistentStorage.get('chrome_prompt_local_file')) {
                    // TODO: React this alert
                    // Only show once per instance
                    if (!alert_shown) {
                        alert(get_translation('chrome-enable-localfile'));
                        alert_shown = true;
                    }
                    chrome.tabs.create({
                        url: 'chrome://extensions/?id=' + chrome.runtime.id,
                    });
                    persistentStorage.set('chrome_prompt_local_file', '1');
                }
                resolve(allowed);
            }),
        );
    }

    return true;
}

export function download_file(song_id: number, file: DownloadableFile, song_title: string, download_set_class: DownloadSetClass, set_src: SetSrc) {
    const down_file_key = `${song_id}-${file.id}`; // silly js not auto-vivifying entries

    file_feedback('download', song_id, file.id);

    const match = file.path.match(/[^\/]+$/); // eslint-disable-line no-useless-escape
    const [name] = match || [];
    const output_file_name = `${song_id}-${file.id}-${name || 'worship_leader_unknown.mp3'}`;

    let file_promise: Promise<any> | undefined;
    if (!file.download_path) {
        if (is_chrome_extension()) {
            file_promise = new Promise<DownloadedFileDetails>((resolve, reject) => {
                const onchanged = (data: ChromeDownloadDelta) => {
                    if (!data.state) return;

                    // Catch any errors like user cancelling
                    if (['complete', 'in_progress'].indexOf(data.state.current ?? '') < 0) {
                        reject('Download cancelled or something - state changed to' + data.state.current);
                        return;
                    }

                    if (data.state.current !== 'complete') return;

                    const details: DownloadedFileDetails = {
                        download_id: data.id,
                    };
                    get_file(details).then(
                        (file_info) => {
                            details.local_url = `file://${(file_info as ChromeDownloadItem).filename}`;
                            resolve(details);
                        },
                        (issue) => reject(issue),
                    );
                    chrome.downloads.onChanged.removeListener(onchanged);
                };

                chrome.downloads.download({ url: file.path }, (/*download_id*/) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else chrome.downloads.onChanged.addListener(onchanged);
                });
            });
        } else if (is_cordova() && 'BackgroundTransfer' in window) {
            // cordova plugin
            file_promise = get_download_fs()
                .then((dirEntry) => open_file(dirEntry, output_file_name, { create: true }))
                .then((targetFile) => {
                    const downloader = new BackgroundTransfer.BackgroundDownloader();

                    const dl = downloader.createDownload(file.path, targetFile, song_title);

                    const details: DownloadedFileDetails = {
                        // Hacky way which works on wkwebview at least
                        local_url: dl.resultFile.toURL().replace('file://', window.location.origin),
                    };

                    // TODO: Allow cancel while downloading? There is a dl.stop if we wanted this
                    return dl.startAsync().then(
                        // startAsync loses filename unfortunately hack with details...
                        (download_id) => {
                            if (download_id) details.download_id = download_id;
                            return details;
                        },
                    );
                });
        }
    }

    if (file_promise) {
        let local_url: string | undefined;
        download_set_class({ loading: 1, active: 0 });
        file_promise = file_promise
            .then(
                (details) => {
                    // should really be the remote server's timestamp (or file's modtime) but there we go...
                    details.ts = Date.now();
                    details.file_name = output_file_name;
                    set_downloaded_file(down_file_key, details);

                    download_set_class({ loading: 0, active: 1 });
                    local_url = details.local_url;
                    return is_local_url_allowed();
                },
                () => download_set_class({ loading: 0, active: 0 }), // error
            )
            .then(
                (local_allowed) => {
                    if (local_allowed) set_src(local_url);
                    send_ui_notification({ message_code: 'download_file_finished' });
                },
                (msg) => {
                    // Fallback to window.open method if proper methods failed, or if it was a link that should have been opened...
                    console.log('trying a direct filesystem download failed:', msg);

                    return try_window_open_download(file.download_path || file.path);
                },
            );
    } else {
        // browser etc
        file_promise = try_window_open_download(file.download_path || file.path);
    }

    file_promise = file_promise.catch((err) => {
        console.log('error thrown', err);
        send_ui_notification({ message_code: 'download_file_error' });
    });
}

type DownloadEntry = ChromeDownloadItem | FileEntry;

export async function get_file(file_entry: DownloadedFileDetails): Promise<DownloadEntry> {
    if (is_chrome_extension()) {
        if (!file_entry.download_id) return Promise.reject('No download id');

        return new Promise((resolve, reject) =>
            chrome.downloads.search({ id: file_entry.download_id }, (results: ChromeDownloadItem[]) => {
                if (!results.length) {
                    reject('Downloaded file not found');
                    return;
                }

                // May lag up to 10 seconds after file has been deleted but there we go.
                if (results[0].exists === false) {
                    reject('Downloaded file was removed externally');
                    return;
                }

                resolve(results[0]);
            }),
        );
    }

    const dirEntry = await get_download_fs();
    if (!file_entry.file_name) throw new Error('No filename stored for download');
    return open_file(dirEntry, file_entry.file_name, { create: false });
}

export async function remove_file(file_entry: DownloadedFileDetails): Promise<void> {
    if (is_chrome_extension()) {
        if (!file_entry.download_id) throw new Error('No download id');

        return new Promise<void>((resolve, reject) =>
            chrome.downloads.removeFile(file_entry.download_id!, () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
            }),
        );
    }

    const entry = await get_file(file_entry);
    if (file_entry.download_id && is_cordova() && 'BackgroundTransfer' in window) {
        // cordova plugin. NOTE: Also deletes the file as well, probably
        let downloader = new BackgroundTransfer.BackgroundDownloader();
        downloader.removeDownload(file_entry.download_id);
    }

    const fileEntry = entry as FileEntry;
    return new Promise<void>((resolve, reject) =>
        fileEntry.remove(
            () => resolve(),
            (err) => reject(['delete failed', err]),
        ),
    );
}
