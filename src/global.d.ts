// Global variable declarations from vite
declare const DEBUG: boolean;
declare const APP_VERSION: string;
declare const BUILD_TYPE: string;

// Global variables from cordova
declare const cordova: any;
declare const BackgroundTransfer: any;

// Global variables from other non-es6 parts of the app
declare const Audio5: any;
declare const ToAudio: any;
declare const Abc: any;

// Chrome extension API
declare const chrome: any;

// Global functions from songxml-util
declare function convert_to_elvanto(songxml: string, without_chords?: boolean): string;
declare function convert_to_pre(songxml: string, opensong?: boolean, without_chords?: boolean): string;

interface Navigator {
    presentation: any;
    standalone?: boolean;
    userLanguage?: string;
}

interface Window {
    opera: any;
    Audio5: any;
    abc2svg: any;
    ga: any;
    ym: any;
    clipboardData: any;
    DB_API: any;
    kill_db: any;
    switch_db_api: any;
    event_socket: any;
    firsttime?: boolean;

    // Cordova plugins
    PresentationRequest: any;
    universalLinks: any;
    sqlitePlugin: any;
    resolveLocalFileSystemURL: any;
    cordova: any;
    plugins: any;
    StatusBar: any;

    // Chrome extension
    chrome: any;

    // common functions
    prepare_search_string: (input: string) => string;
    is_mobile_browser: () => boolean;
    is_rtl: (str?: string | null) => boolean;
    is_vertical: (str?: string | null) => boolean;
    add_chord_zwjs: (songxml: string) => string;
    songxml_to_divs: (songxml: string | null | undefined, without_chords?: boolean, chord_color?: string) => string;
    format_html_chords: (elem: { 0: HTMLElement } | HTMLElement | null) => void;
    convert_to_elvanto: (songxml: string, without_chords?: boolean) => string;
    convert_to_pre: (songxml: string, opensong?: boolean, without_chords?: boolean) => string;
    SORT_TITLE_SORT: (a: { sort_title: string }, b: { sort_title: string }) => number;
    get_youtube_id: (file: { type?: string; path: string }) => string | undefined;
    unidecode: (str: string) => Promise<string>;
    HOST: string;
}

interface PresentationWindow {
    _connection: any;
}

interface Document {
    mozFullScreenElement: Element | null;
    webkitFullscreenElement: Element | null;
    msFullscreenElement: Element | null;

    exitFullscreen: () => Promise<void>;
    webkitExitFullscreen: () => Promise<void>;
    webkitCancelFullScreen: () => Promise<void>;
    mozCancelFullScreen: () => Promise<void>;
    msExitFullscreen: () => Promise<void>;
}

interface MediaQueryList {
    // We add this in
    unsubscribe(): void;
}

// JQM etc extensions
interface JQueryStatic {
    mobile: any;
}

// JQM etc extensions
interface JQuery {
    listview: any;
    toolbar: any;
    raty: any;
    selectmenu: any;
    colorPicker: any;
    dialog: any;
    popup: any;
    filterable: any;
    sortable: any;
    checkboxradio: any;
    disableSelection: any;
    tristateSetState: any;
    tristateValue: any;
}
