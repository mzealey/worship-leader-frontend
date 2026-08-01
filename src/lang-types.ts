/**
 * Database language code — always a base 2-character language code
 * (e.g., "en", "tr", "fr") and never includes a locale/region suffix
 * (e.g., NOT "en-GB", "en-US").
 *
 * This branded type ensures that browser-locale codes (which may include
 * suffixes like "en-GB") cannot accidentally be passed to functions that
 * expect database language codes (such as `save_db_chosen_langs`).
 */
export type DBLangCode = string & { readonly __dbLangBrand: true };

/**
 * Browser-reported locale code — may include a locale/region suffix
 * (e.g., "en-GB", "en-US") or be a plain 2-character code (e.g.,
 * "en", "tr"). These are the raw values from {@code navigator.language}
 * and {@code navigator.languages}.
 *
 * Use {@link DBLangCode} for database language codes instead.
 */
export type BrowserLangCode = string & { readonly __browserLangBrand: true };

/**
 * UI language pack code — the code used to select a language pack
 * (e.g., {@code langpack/en.json}) for the application interface. May
 * include a locale suffix or be a base code, and may be derived from a
 * browser code via the {@code lang_code_map} mapping.
 *
 * Distinct from {@link BrowserLangCode} (raw browser locale) and
 * {@link DBLangCode} (database language).
 */
export type UILangCode = string & { readonly __uiLangBrand: true };
