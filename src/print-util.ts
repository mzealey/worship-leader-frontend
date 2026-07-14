import { is_cordova } from './util';

/**
 * Shared print utility that works across both song and songbook printing.
 * Handles both standard window.print() and Cordova plugin-based printing.
 *
 * @param onAfterPrint Optional callback to execute after printing completes
 * @param prepareForPrint Optional function that returns true if layout changes were made (requiring setTimeout)
 */
export function handlePrint(onAfterPrint?: () => void, prepareForPrint?: () => boolean): void {
    const actualPrint = () => {
        if (is_cordova() && window.cordova?.plugins?.printer) {
            // Cordova webviews don't support printing natively so we need to use a plugin
            window.cordova.plugins.printer.print('', {}, (res: boolean) => {
                if (res && onAfterPrint) {
                    onAfterPrint();
                }
            });
        } else {
            // Desktop browsers, safari (mobile) all support the standard window.print
            try {
                window.print(); // note this is synchronous
                if (onAfterPrint) {
                    onAfterPrint();
                }
            } catch (e) {
                // Rarely browsers (edge, perhaps IE with no printer drivers) do an err if print was cancelled
            }
        }
    };

    // If preparation was done and layout changes were made, delay print to allow reflow
    if (prepareForPrint && prepareForPrint()) {
        setTimeout(actualPrint, 0);
    } else {
        actualPrint();
    }
}
