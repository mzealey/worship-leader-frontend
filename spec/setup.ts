// Vitest setup file - runs before all tests
import jQuery from 'jquery';

// Handle both ES module and CommonJS imports
const $ = typeof jQuery === 'function' ? jQuery : (jQuery as any).default;

// Set jQuery as a global function
// Don't call jQuery(window) - just use the jQuery function directly
// The jsdom environment is already available, jQuery will find it automatically
(window as any).$ = $;
(window as any).jQuery = $;
(global as any).$ = $;
(global as any).jQuery = $;
(globalThis as any).$ = $;
(globalThis as any).jQuery = $;
