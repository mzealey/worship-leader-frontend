import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGlobalsMock } from '../helpers/mocks/globals';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PageEditTextarea: typeof import('../../src/page/edit').PageEditTextarea;
let EditTypeChooser: typeof import('../../src/page/edit').EditTypeChooser;

describe('EditTypeChooser', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);

        const mod = await import('../../src/page/edit');
        EditTypeChooser = mod.EditTypeChooser;
    });

    it('renders format toggle buttons', () => {
        renderWithRouter(<EditTypeChooser format="chords" onChange={() => {}} />);
        expect(screen.getByText('edit_chords')).toBeInTheDocument();
        expect(screen.getByText('edit_opensong')).toBeInTheDocument();
    });

    it('renders elvanto option when elvanto prop set', () => {
        renderWithRouter(<EditTypeChooser format="chords" onChange={() => {}} elvanto={1} />);
        expect(screen.getByText('Elvanto')).toBeInTheDocument();
    });
});

describe('PageEditTextarea', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => createGlobalsMock());
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                get_song: vi.fn().mockResolvedValue({ id: 1, title: 'Test', songxml: '<song/>' }),
            }),
            DB_AVAILABLE: Promise.resolve({ ideal_debounce: () => 300 }),
        }));
        vi.doMock('../../src/songxml-util', () => ({
            convert_to_pre: vi.fn().mockReturnValue('converted content'),
            convert_to_elvanto: vi.fn().mockReturnValue('elvanto content'),
        }));
        vi.doMock('../../src/util', () => ({
            fetch_json: vi.fn().mockResolvedValue({}),
        }));
        vi.doMock('../../src/component/notify', () => ({
            send_ui_notification: vi.fn(),
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title, before, children }: any) => (
                <div data-testid="topbar">
                    {before}
                    <span>{title}</span>
                    {children}
                </div>
            ),
        }));

        const mod = await import('../../src/page/edit');
        PageEditTextarea = mod.PageEditTextarea;
        EditTypeChooser = mod.EditTypeChooser;
    });

    it('renders new song form', () => {
        renderWithRouter(<PageEditTextarea type="new" />);
        expect(screen.getByText('newbtn')).toBeInTheDocument();
    });

    it('renders edit song form', async () => {
        const song = { id: 1, title: 'Test Song', songxml: '<song/>' } as any;
        renderWithRouter(<PageEditTextarea type="edit" song={song} />);

        await screen.findByText('editbtn');
        expect(screen.getByText('editbtn')).toBeInTheDocument();
    });

    it('renders submit and cancel buttons', () => {
        renderWithRouter(<PageEditTextarea type="new" />);
        expect(screen.getByText('editsubmit')).toBeInTheDocument();
        expect(screen.getByText('cancel_btn')).toBeInTheDocument();
    });

    it('renders edit welcome text', () => {
        renderWithRouter(<PageEditTextarea type="new" />);
        expect(screen.getByText('edit_welcome_text')).toBeInTheDocument();
    });

    it('shows content editable area', () => {
        renderWithRouter(<PageEditTextarea type="new" />);
        const pre = document.querySelector('[contenteditable]');
        expect(pre).toBeInTheDocument();
    });

    it('shows lock screen when submitting', async () => {
        const song = { id: 1, title: 'Test Song', songxml: '<song/>' } as any;
        renderWithRouter(<PageEditTextarea type="edit" song={song} />);

        await screen.findByText('editbtn');
    });

    it('shows alert on submit failure', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/globals', () => createGlobalsMock());
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                get_song: vi.fn().mockResolvedValue({ id: 1, title: 'Test', songxml: '<song/>' }),
            }),
            DB_AVAILABLE: Promise.resolve({ ideal_debounce: () => 300 }),
        }));
        vi.doMock('../../src/songxml-util', () => ({
            convert_to_pre: vi.fn().mockReturnValue('converted content'),
            convert_to_elvanto: vi.fn().mockReturnValue('elvanto content'),
        }));
        vi.doMock('../../src/util', () => ({
            fetch_json: vi.fn().mockRejectedValue(new Error('fail')),
        }));
        vi.doMock('../../src/component/notify', () => ({
            send_ui_notification: vi.fn(),
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title, before }: any) => (
                <div data-testid="topbar">
                    {before}
                    <span>{title}</span>
                </div>
            ),
        }));

        const mod2 = await import('../../src/page/edit');
        const EditSubmitFail = mod2.PageEditTextarea;

        const song = { id: 1, title: 'Test Song', songxml: '<song/>' } as any;
        renderWithRouter(<EditSubmitFail type="edit" song={song} />);
    });
});
