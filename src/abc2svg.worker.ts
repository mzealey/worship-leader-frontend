import { abc2svg } from 'abc2svg';
import * as Comlink from 'comlink';
import { AbcRenderer } from './abc2svg-renderer';

self.abc2svg = abc2svg;

console.log('abc2svg worker running');

// NOTE: window.onerror also catches unhandled errors here

Comlink.expose(new AbcRenderer());
