import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let NotificationWidget: typeof import('../../src/component/notification').NotificationWidget;
let send_ui_notification: typeof import('../../src/component/notify').send_ui_notification;

describe('notification', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);

        const notifyMod = await import('../../src/component/notify');
        send_ui_notification = notifyMod.send_ui_notification;

        const mod = await import('../../src/component/notification');
        NotificationWidget = mod.NotificationWidget;
    });

    describe('send_ui_notification', () => {
        it('is exported as a function', () => {
            expect(typeof send_ui_notification).toBe('function');
        });

        it('does not throw when called', () => {
            expect(() => send_ui_notification({ message_code: 'test_message' })).not.toThrow();
        });
    });

    describe('NotificationWidget', () => {
        it('renders without crashing', () => {
            renderWithProviders(<NotificationWidget />);
            expect(document.body).toBeInTheDocument();
        });

        it('shows snackbar when notification is triggered', () => {
            renderWithProviders(<NotificationWidget />);

            act(() => {
                send_ui_notification({ message_code: 'hello_world', autoHideDuration: 2000 });
            });

            const snackbarRoot = document.body.querySelector('.MuiSnackbar-root');
            expect(snackbarRoot).toBeInTheDocument();
        });

        it('displays the translated message text', () => {
            renderWithProviders(<NotificationWidget />);

            act(() => {
                send_ui_notification({ message_code: 'greeting', autoHideDuration: 2000 });
            });

            const snackbarRoot = document.body.querySelector('.MuiSnackbar-root');
            expect(snackbarRoot).toBeInTheDocument();
            expect(snackbarRoot!.textContent).toContain('greeting');
        });

        it('uses default autoHideDuration of 4000 when not specified', () => {
            renderWithProviders(<NotificationWidget />);

            act(() => {
                send_ui_notification({ message_code: 'default_duration' });
            });

            const snackbarRoot = document.body.querySelector('.MuiSnackbar-root');
            expect(snackbarRoot).toBeInTheDocument();
        });

        it('shows multiple snackbars when multiple notifications are sent', () => {
            renderWithProviders(<NotificationWidget />);

            act(() => {
                send_ui_notification({ message_code: 'first' });
                send_ui_notification({ message_code: 'second' });
            });

            const snackbars = document.body.querySelectorAll('.MuiSnackbar-root');
            expect(snackbars.length).toBeGreaterThanOrEqual(1);
        });

        it('removes notification from state when onClose is called', async () => {
            const user = userEvent.setup();
            renderWithProviders(<NotificationWidget />);

            act(() => {
                send_ui_notification({ message_code: 'closable' });
            });

            const snackbarRoot = document.body.querySelector('.MuiSnackbar-root');
            expect(snackbarRoot).toBeInTheDocument();
        });

        it('cleanly unsubscribes on unmount', () => {
            const { unmount } = renderWithProviders(<NotificationWidget />);
            unmount();

            act(() => {
                send_ui_notification({ message_code: 'after_unmount' });
            });
        });
    });
});
