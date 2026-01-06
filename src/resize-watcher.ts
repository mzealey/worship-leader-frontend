import { fromEvent, interval, merge, Subject, type Observable, type Subscription } from 'rxjs';
import { distinctUntilChanged, map, throttle } from 'rxjs/operators';

// Emit one event every X time with a final one when event has finished
const throttle_time = (time: number) => throttle(() => interval(time), { trailing: true });

const _real_resizes = fromEvent(window, 'resize').pipe(
    throttle_time(50),
    // Ignore height resizes as eg android chrome does this when scrolling and hiding the navbar
    map(() => window.innerWidth),
    distinctUntilChanged(),
);
const fake_resize = new Subject<number>();
if (window.matchMedia) {
    const mql = window.matchMedia('print');
    if (mql.addListener) mql.addListener(() => fake_resize.next(mql.matches ? 1000 : window.innerWidth));
}

export const send_fake_resize = () => fake_resize.next(0);

export const on_resize = (cb: (value: number) => void, time = 200): Subscription => {
    const observable = merge(_real_resizes.pipe(throttle_time(time)) as Observable<number>, fake_resize.asObservable());
    return observable.subscribe((value) => cb(value));
};
