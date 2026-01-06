// Global variable declarations for tests
// This allows tests to set global.BUILD_TYPE, global.DEBUG, etc.

// Augment globalThis which is what 'global' refers to in modern Node.js/TypeScript

declare var BUILD_TYPE: string;
declare var DEBUG: boolean;
declare var APP_VERSION: string;
