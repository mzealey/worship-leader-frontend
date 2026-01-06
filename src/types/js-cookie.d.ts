declare module 'js-cookie' {
    type SameSite = 'strict' | 'lax' | 'none';

    interface CookieAttributes {
        path?: string;
        domain?: string;
        expires?: number | Date;
        secure?: boolean;
        sameSite?: SameSite;
    }

    interface CookiesStatic {
        get(name: string): string | undefined;
        get(): Record<string, string>;
        set(name: string, value: string, options?: CookieAttributes): void;
        remove(name: string, options?: CookieAttributes): void;
        withAttributes(attributes: CookieAttributes): CookiesStatic;
    }

    const Cookies: CookiesStatic;
    export default Cookies;
}
