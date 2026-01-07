// Tools for doing abc2svg rendering. Usually run from within a worker. You likely have to do some horrible hacks to
// get abc2svg object imported into the global/globalThis scope before you call this
import { abc2svg } from 'abc2svg';
import { ToAudio } from 'abc2svg/play';

export type AbcRenderRequest = {
    abc: string;
    width: number;
    delta?: number;
};
export type AbcRenderResult = {
    audio: Float32Array[];
    svg: string;
};

// Type definitions for abc2svg (library doesn't provide proper types)
interface AbcSvgOptions {
    errmsg: (...args: unknown[]) => void;
    imagesize: string;
    img_out: (svg_data: string) => void;
    get_abcmodel: (model: unknown) => void;
    anno_stop: (type: string, start: number, stop: number, x: number, y: number, w: number, h: number) => void;
}

interface AbcSvgInstance {
    out_svg: (svg: string) => void;
    out_sxsy: (x: number, middle: string, y: number) => void;
    sh: (h: number) => number;
    tosvg: (name: string, abc: string) => void;
}

interface Abc2SvgConstructor {
    new (options: AbcSvgOptions): AbcSvgInstance;
}

const abc_print_types: Record<string, number> = {
    note: 1,
    rest: 1,
    /* previous ignore types
    beam: 1,
    slur: 1,
    tuplet: 1,
    */
};

export class AbcRenderer {
    private abc_audio = ToAudio();

    abc_render(details: AbcRenderRequest): AbcRenderResult {
        let start = Date.now();
        let svg_buffer = '';
        let abc_svg = new (abc2svg.Abc as unknown as Abc2SvgConstructor)({
            errmsg(...args: unknown[]) {
                console.log(args);
            },
            imagesize: 'width="100%"',
            img_out(svg_data: string) {
                svg_buffer += svg_data;
            },
            get_abcmodel: this.abc_audio.add,
            anno_stop(type: string, start: number, stop: number, x: number, y: number, w: number, h: number) {
                if (!abc_print_types[type]) return;

                // create a rectangle
                abc_svg.out_svg('<rect id="i' + start + '" class="overlay" x="');
                abc_svg.out_sxsy(x, '" y="', y);
                abc_svg.out_svg('" width="' + w.toFixed(2) + '" height="' + abc_svg.sh(h).toFixed(2) + '"/>');
            },
        });

        // Change some defaults to make rendering better
        const params = [
            'scale 1',
            'pagewidth ' + details.width, // this accepts pixels
            'leftmargin 0',
            'rightmargin 0',

            // set chord font
            'gchordfont serifBold 18',

            // Measure at start of each line
            'measurenb 0',

            // Compress the tune a bit more than by default
            'breaklimit 0.95',
            'maxshrink 0.95',
        ];

        if (details.delta) params.push('transpose ' + (details.delta || 0));
        abc_svg.tosvg('fake_file_name', params.map((param) => `%%${param}\n`).join(''));

        abc_svg.tosvg('fake_file_name', details.abc);

        console.log('generating svg took', Date.now() - start, 'ms');

        return {
            // .clear returns the sequence of notes to play
            audio: this.abc_audio.clear(),
            svg: svg_buffer,
        };
    }

    ping() {
        // For worker to show communication is up and running
        return 1;
    }
}
