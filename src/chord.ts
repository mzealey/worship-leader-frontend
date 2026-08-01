// Based on chord.js by Einar Egilsson 2015 | http://einaregilsson.com
type LineCap = 'butt' | 'round' | 'square';
type TextBaseline = 'alphabetic' | 'bottom' | 'hanging' | 'ideographic' | 'middle' | 'top';
type TextAlign = 'center' | 'end' | 'left' | 'right' | 'start';

interface ChordDimensions {
    cellWidth: number;
    nutSize: number;
    lineWidth: number;
    barWidth: number;
    dotRadius: number;
    openStringRadius: number;
    openStringLineWidth: number;
    muteStringRadius: number;
    muteStringLineWidth: number;
    nameFontSize: number;
    nameFontPaddingBottom: number;
    fingerFontSize: number;
    fretFontSize: number;
    scale: number;
    positions: string;
    fingers: string;
    name: string;
    cellHeight: number;
    dotWidth: number;
    font: string;
    boxWidth: number;
    boxHeight: number;
    width: number;
    height: number;
    boxStartX: number;
    boxStartY: number;
}

interface CanvasRenderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    init(info: ChordDimensions, config: CanvasConfig): void;
    line(x1: number, y1: number, x2: number, y2: number, width?: number, cap?: LineCap): void;
    text(x: number, y: number, text: string, font: string, size: number, baseline: TextBaseline, align: TextAlign): void;
    rect(x: number, y: number, width: number, height: number, lineWidth: number): void;
    circle(x: number, y: number, radius: number, fillCircle: boolean, lineWidth?: number): void;
    diagram(): HTMLImageElement | HTMLCanvasElement;
}

interface BarInfo {
    finger: string;
    length: number;
    index: number;
}

interface CanvasConfig {
    color?: string;
}

const MUTED = -1;

const DEFAULT_SIZES = {
    cellWidth: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
    nutSize: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    lineWidth: [1, 1, 1, 1, 1, 1, 2, 2, 2, 2],
    barWidth: [2.5, 3, 5, 7, 7, 9, 10, 10, 12, 12],
    dotRadius: [2, 2.8, 3.7, 4.5, 5.3, 6.5, 7, 8, 9, 10],
    openStringRadius: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6.5],
    openStringLineWidth: [1, 1.2, 1.2, 1.4, 1.4, 1.4, 1.6, 2, 2, 2],
    muteStringRadius: [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5],
    muteStringLineWidth: [1.05, 1.1, 1.1, 1.2, 1.5, 1.5, 1.5, 2, 2.4, 2.5],
    // Disable name at top
    nameFontSize: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //nameFontSize: [10, 14, 18, 22, 26, 32, 36, 40, 44, 48],
    nameFontPaddingBottom: [4, 4, 5, 4, 4, 4, 5, 5, 5, 5],
    fingerFontSize: [7, 8, 9, 11, 13, 14, 15, 18, 20, 22],
    fretFontSize: [6, 8, 10, 12, 14, 14, 16, 17, 18, 19],
};

const canvasRenderer: CanvasRenderer = {
    canvas: null!,
    ctx: null!,

    init(info: ChordDimensions, config: CanvasConfig = {}): void {
        this.canvas = document.createElement('canvas');
        const ctx = (this.ctx = this.canvas.getContext('2d')!);
        this.canvas.width = info.width;
        this.canvas.height = info.height;

        if (info.lineWidth % 2 == 1) {
            ctx.translate(0.5, 0.5);
        }
        ctx.fillStyle = config.color || 'black';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = info.lineWidth;
        ctx.lineCap = 'square';
        ctx.strokeStyle = config.color || 'black';
    },

    line(x1: number, y1: number, x2: number, y2: number, width?: number, cap?: LineCap): void {
        const c = this.ctx;
        c.save();
        if (width) {
            c.lineWidth = width;
        }
        c.lineCap = cap || 'square';
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        c.restore();
    },

    text(x: number, y: number, text: string, font: string, size: number, baseline: TextBaseline, align: TextAlign): void {
        this.ctx.font = size + 'px ' + font;
        this.ctx.textBaseline = baseline;
        this.ctx.textAlign = align;
        this.ctx.fillText(text, x, y);
    },

    rect(x: number, y: number, width: number, height: number, lineWidth: number): void {
        this.ctx.fillRect(x - lineWidth / 2.0, y - lineWidth / 2.0, width + lineWidth, height + lineWidth);
    },

    circle(x: number, y: number, radius: number, fillCircle: boolean, lineWidth?: number): void {
        const c = this.ctx;
        c.beginPath();
        c.arc(x, y, radius, 0, 2 * Math.PI, false);
        if (fillCircle) {
            c.fill();
        } else {
            c.lineWidth = lineWidth ?? 1;
            c.stroke();
        }
    },

    diagram(): HTMLCanvasElement {
        return this.canvas;
    },
};

export class Chord {
    static defaultSize = 3;
    static MUTED = MUTED;
    static regex = /^([0-9xX]{4,6}|(?:x|X|\d\d?)(?:[-. ](?:x|X|\d\d?)){3,5})(?:\s*\[([T\d]+)\])?(?:\s*(\d+))?/g;
    static searchRegex = /\b([ABCDEFG](?:[a-z0-9#])*)\s*\(?([0-9xX]{4,6}|(?:x|X|\d\d?)(?:[-. ](?:x|X|\d\d?)){3,5})\)?(?:\s*\[([T\d]+)\])?(?:\s*(\d+))?/g;

    static renderers = {
        canvas: canvasRenderer,
    };

    private sizes = DEFAULT_SIZES;

    name: string;
    rawPositions: string;
    rawFingers: string;
    positions: number[] = [];
    fingerings: (string | null)[] = [];
    stringCount = 0;
    fretCount = 0;
    startFret = 1;
    renderer: CanvasRenderer = canvasRenderer;

    constructor(name: string, positions: string, fingers?: string) {
        this.name = name;
        this.rawPositions = positions;
        this.rawFingers = fingers || '';
        this.parse(positions, fingers);
    }

    private parse(frets: string, fingers?: string): void {
        this.positions = [];
        let raw: string[] = [];

        if (/^[0-9xX]{1,6}$/.test(frets)) {
            for (let i = 0; i < frets.length; i++) {
                raw.push(frets.charAt(i));
            }
        } else {
            raw = frets.split(/[^\dxX]/);
        }

        this.stringCount = raw.length;
        this.fretCount = this.stringCount == 4 ? 4 : 5;

        let maxFret = 0;
        let minFret = 1000;

        for (const c of raw) {
            if (c.toLowerCase() == 'x') {
                this.positions.push(MUTED);
            } else {
                const fret = parseInt(c);
                if (fret > 0 && fret < minFret) {
                    minFret = fret;
                }
                maxFret = Math.max(maxFret, fret);
                this.positions.push(fret);
            }
        }

        this.startFret = maxFret <= this.fretCount ? 1 : minFret;

        this.fingerings = [];
        if (!fingers) {
            return;
        }

        let j = 0;
        for (let i = 0; i < fingers.length; i++) {
            for (; j < this.positions.length; j++) {
                if (this.positions[j] <= 0) {
                    this.fingerings.push(null);
                } else {
                    this.fingerings.push(fingers[i]);
                    j++;
                    break;
                }
            }
        }
    }

    private drawMutedAndOpenStrings(info: ChordDimensions): void {
        const r = this.renderer;
        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];
            const x = info.boxStartX + i * info.cellWidth;
            let y = info.nameFontSize + info.nameFontPaddingBottom + info.dotRadius - 2;
            if (this.startFret > 1) {
                y += info.nutSize;
            }
            if (pos == MUTED) {
                this.drawCross(info, x, y, info.muteStringRadius, info.muteStringLineWidth);
            } else if (pos == 0) {
                r.circle(x, y, info.openStringRadius, false, info.openStringLineWidth);
            }
        }
    }

    private drawPositions(info: ChordDimensions): void {
        const r = this.renderer;
        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];
            if (pos > 0) {
                const relativePos = pos - this.startFret + 1;
                const x = info.boxStartX + i * info.cellWidth;
                if (relativePos <= 5) {
                    const y = info.boxStartY + relativePos * info.cellHeight - info.cellHeight / 2;
                    r.circle(x, y, info.dotRadius, true);
                }
            }
        }
    }

    toString(): string {
        return 'Chord';
    }

    private drawFretGrid(info: ChordDimensions): void {
        const r = this.renderer;
        const width = (this.stringCount - 1) * info.cellWidth;

        for (let i = 0; i <= this.stringCount - 1; i++) {
            const x = info.boxStartX + i * info.cellWidth;
            r.line(x, info.boxStartY, x, info.boxStartY + this.fretCount * info.cellHeight, info.lineWidth, 'square');
        }

        for (let i = 0; i <= this.fretCount; i++) {
            const y = info.boxStartY + i * info.cellHeight;
            r.line(info.boxStartX, y, info.boxStartX + width, y, info.lineWidth, 'square');
        }
    }

    private drawNut(info: ChordDimensions): void {
        const r = this.renderer;
        if (this.startFret == 1) {
            r.rect(info.boxStartX, info.boxStartY - info.nutSize, info.boxWidth, info.nutSize, info.lineWidth);
        } else {
            r.text(
                info.boxStartX - info.dotRadius,
                info.boxStartY + info.cellHeight / 2.0,
                this.startFret + '',
                info.font,
                info.fretFontSize,
                'middle',
                'right',
            );
        }
    }

    private drawName(info: ChordDimensions): void {
        const r = this.renderer;
        r.text(info.width / 2.0, info.nameFontSize + info.lineWidth * 3, this.name, info.font, info.nameFontSize, 'bottom', 'center');
    }

    private calculateDimensions(scale: number): ChordDimensions {
        const idx = scale - 1;
        const info: ChordDimensions = {
            cellWidth: this.sizes.cellWidth[idx],
            nutSize: this.sizes.nutSize[idx],
            lineWidth: this.sizes.lineWidth[idx],
            barWidth: this.sizes.barWidth[idx],
            dotRadius: this.sizes.dotRadius[idx],
            openStringRadius: this.sizes.openStringRadius[idx],
            openStringLineWidth: this.sizes.openStringLineWidth[idx],
            muteStringRadius: this.sizes.muteStringRadius[idx],
            muteStringLineWidth: this.sizes.muteStringLineWidth[idx],
            nameFontSize: this.sizes.nameFontSize[idx],
            nameFontPaddingBottom: this.sizes.nameFontPaddingBottom[idx],
            fingerFontSize: this.sizes.fingerFontSize[idx],
            fretFontSize: this.sizes.fretFontSize[idx],
            scale: idx,
            positions: this.rawPositions,
            fingers: this.rawFingers,
            name: this.name,
            cellHeight: this.sizes.cellWidth[idx],
            dotWidth: 2 * this.sizes.dotRadius[idx],
            font: 'Arial',
            boxWidth: (this.stringCount - 1) * this.sizes.cellWidth[idx],
            boxHeight: this.fretCount * this.sizes.cellWidth[idx],
            width: 0,
            height: 0,
            boxStartX: 0,
            boxStartY: 0,
        };

        info.width = info.boxWidth + 4 * info.cellWidth;
        info.height = info.nameFontSize + info.nameFontPaddingBottom + info.dotWidth + info.nutSize + info.boxHeight + info.fingerFontSize + 4;
        info.boxStartX = Math.round((info.width - info.boxWidth) / 2);
        info.boxStartY = Math.round(info.nameFontSize + info.nameFontPaddingBottom + info.nutSize + info.dotWidth);

        return info;
    }

    private draw(scale: number, config: CanvasConfig = {}): void {
        const info = this.calculateDimensions(scale);
        this.renderer.init(info, config);
        this.drawFretGrid(info);
        this.drawNut(info);
        this.drawName(info);
        this.drawMutedAndOpenStrings(info);
        this.drawPositions(info);
        this.drawFingerings(info);
        this.drawBars(info);
    }

    getDiagram(scale: number, config: CanvasConfig = {}): HTMLImageElement | HTMLCanvasElement {
        this.renderer = Chord.renderers.canvas;
        this.draw(scale, config);
        return this.renderer.diagram();
    }

    private drawBars(info: ChordDimensions): void {
        const r = this.renderer;

        if (this.fingerings.length > 0) {
            const bars: Record<number, BarInfo> = {};

            for (let i = 0; i < this.positions.length; i++) {
                const fret = this.positions[i];
                if (fret > 0) {
                    const finger = this.fingerings[i];
                    if (bars[fret] && bars[fret].finger == finger) {
                        bars[fret].length = i - bars[fret].index;
                    } else {
                        bars[fret] = { finger: finger || '', length: 0, index: i };
                    }
                }
            }

            for (const fretStr in bars) {
                const fret = parseInt(fretStr);
                if (bars[fret].length > 0) {
                    const xStart = info.boxStartX + bars[fret].index * info.cellWidth;
                    const xEnd = xStart + bars[fret].length * info.cellWidth;
                    const relativePos = fret - this.startFret + 1;
                    const y = info.boxStartY + relativePos * info.cellHeight - info.cellHeight / 2;
                    r.line(xStart, y, xEnd, y, info.barWidth, 'square');
                }
            }
        } else {
            const barFret = this.positions[this.positions.length - 1];
            if (barFret <= 0) {
                return;
            }
            if (this.positions.join('') == '-1-10232') {
                return;
            }

            let startIndex = -1;
            for (let i = 0; i < this.positions.length - 2; i++) {
                const fret = this.positions[i];
                if (fret > 0 && fret < barFret) {
                    return;
                } else if (fret == barFret && startIndex == -1) {
                    startIndex = i;
                } else if (startIndex != -1 && fret < barFret) {
                    return;
                }
            }

            if (startIndex >= 0) {
                const xStart = info.boxStartX + startIndex * info.cellWidth;
                const xEnd = (this.positions.length - 1) * info.cellWidth;
                const relativePos = barFret - this.startFret + 1;
                const y = info.boxStartY + relativePos * info.cellHeight - info.cellHeight / 2;
                r.line(xStart, y, xEnd, y, info.dotRadius, 'square');
            }
        }
    }

    private drawCross(info: ChordDimensions, x: number, y: number, radius: number, lineWidth: number): void {
        const r = this.renderer;
        const angle = Math.PI / 4;

        for (let i = 0; i < 2; i++) {
            const startAngle = angle + (i * Math.PI) / 2;
            const endAngle = startAngle + Math.PI;

            const startX = x + radius * Math.cos(startAngle);
            const startY = y + radius * Math.sin(startAngle);
            const endX = x + radius * Math.cos(endAngle);
            const endY = y + radius * Math.sin(endAngle);

            r.line(startX, startY, endX, endY, lineWidth, 'round');
        }
    }

    private drawFingerings(info: ChordDimensions): void {
        const r = this.renderer;
        const fontSize = info.fingerFontSize;

        for (let i = 0; i < this.fingerings.length; i++) {
            const finger = this.fingerings[i];
            const x = info.boxStartX + i * info.cellWidth;
            const y = info.boxStartY + info.boxHeight + fontSize + info.lineWidth + 1;
            if (finger) {
                r.text(x, y, finger, info.font, fontSize, 'bottom', 'center');
            }
        }
    }
}
