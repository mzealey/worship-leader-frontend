import Cookies from 'js-cookie';

// Set of classes to wrap localStorage and fallbacks (cookie-based and
// in-memory) as some browsers notably safari mobile in private mode don't
// allow use of localStorage.

abstract class PerstentStorageCommon {
    // base class
    abstract type(): string;
    abstract set(key: string, val: string): void;
    abstract get(key: string): string | undefined;
    abstract remove(key: string): void;
    abstract clear(): void;

    // Install JSON wrappers
    setObj(key: string, obj: StorageObject): void {
        this.set(key, JSON.stringify(obj));
    }

    getObj<T>(key: string, default_val: T): T;
    getObj<T>(key: string, default_val?: undefined): T | undefined;
    getObj<T>(key: string, default_val?: T): T | undefined {
        const val = this.get(key);
        return val ? (JSON.parse(val) as T) : default_val;
    }
}

type StorageObject = unknown;

class PersistentStorageCookie extends PerstentStorageCommon {
    type() {
        return 'cookie';
    }

    set(key: string, val: string) {
        Cookies.set(key, val, { expires: 365 * 5 });
    }
    get(key: string) {
        return Cookies.get(key);
    }
    remove(key: string) {
        Cookies.remove(key);
    }
    clear() {
        const all = Cookies.get();
        for (const key in all) Cookies.remove(key);
    }
}

class PersistentStorageLocal extends PerstentStorageCommon {
    type() {
        return 'localStorage';
    }

    set(key: string, val: string) {
        try {
            localStorage[key] = val;
            return;
        } catch (e: unknown) {
            // FF error when localStorage was corrupted... Seems to happen from
            // the event-socket call of setObj so may be something to do with
            // ff running in certain contexts, in which case try to fix it and
            // then ignore it
            if (!/NS_ERROR_FILE_CORRUPTED/.test(String(e))) throw e;
        }

        // We are in an error - try to fix it by cleaning out the storage and retrying
        this.clear();
        try {
            localStorage[key] = val;
        } catch (e) {
            // give up if it fails again
        }
    }
    get(key: string) {
        return localStorage[key];
    }
    remove(key: string) {
        delete localStorage[key];
    }
    clear() {
        localStorage.clear();
    }
}

class PersistentStorageInMemory extends PerstentStorageCommon {
    mem: Record<string, string> = {};

    type() {
        return 'in-memory';
    }

    constructor() {
        super();
        this.clear();
    }
    set(key: string, val: string) {
        this.mem[key] = val;
    }
    get(key: string) {
        return this.mem[key];
    }
    remove(key: string) {
        delete this.mem[key];
    }
    clear() {
        this.mem = {};
    }
}

export let persistentStorage: PerstentStorageCommon;

// TODO: On cordova backup to file and if cannot find it on startup then load it again from the persistent
// location
function setup() {
    const engines = [PersistentStorageLocal, PersistentStorageCookie, PersistentStorageInMemory];
    const test_key = '_test';
    for (const engineCtor of engines) {
        persistentStorage = new engineCtor();

        try {
            persistentStorage.set(test_key, '1');
            if (persistentStorage.get(test_key) !== '1') continue;

            persistentStorage.remove(test_key);
            break;
        } catch (e) {
            console.log('error setting persistent storage');
        }
    }
}

setup();
