import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let NotificationWidget: typeof import('../../src/component/notification').NotificationWidget;
let send_ui_notification: typeof import('../../src/component/notification').send_ui_notification;

describe('notification', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);

        const mod = await import('../../src/component/notification');
        NotificationWidget = mod.NotificationWidget;
        send_ui_notification = mod.send_ui_notification;
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
    });
});
