This is the source code of the frontend app for [Worship Leader](https://worshipleaderapp.com).

It uses Typescript, modern React and Material UI.

From this code-base we produce builds supporting:
- Web (including very old web browsers)
- PWA
- Chrome extension
- Edge extension
- Phonegap supporting all current versions of iOS and Android
- A set of libraries for the editor frontend (legacy AngularJS project) to use

As many phones and browsers are old we want to target the broadest range of support possible.

# Features

- Offline-First Architecture: Features a robust, abstraction-based database layer (src/db.ts) that seamlessly switches
  between OnlineDB, OfflineWebSQLDB (Cordova), and OfflineWASMDB (Browser SQLite via WebAssembly), ensuring
  functionality without internet access.
- Dual-Screen Presentation API: Implements the W3C Presentation API (src/dual-present.ts) to "cast" lyrics and chords
  to a secondary screen (projector/TV) natively, with fallbacks for standard popup windows and a custom Cordova
  implementation.
- Real-Time Device Synchronization: Uses a custom EventSocket (src/event-socket.ts) with a WebSocket primary channel
  and HTTP polling fallback to synchronize state (scroll position, active song) between a leader's device and band
  members/projectors, including time-skew correction.
- Dynamic Sheet Music Rendering: Integrates abc2svg in a Web Worker (src/abc2svg.worker.ts) to compile ABC musical
  notation into SVG sheet music on-the-fly without blocking the main UI thread.
- Client-Side Transposition: Features a music-theory-aware transposition engine (src/transpose.ts) that correctly
  handles key changes, sharps/flats relative to the key (Circle of Fifths logic), and Capo calculations.
- Interactive Chord Diagrams: Dynamically renders guitar/ukulele chord charts onto HTML Canvas (src/chord.ts), enabling
  visual resizing and custom fingerings rather than using static images.
- Browser Audio Synthesis: Capable of playing back sheet music directly in the browser using SoundFonts
  (src/abc2svg.ts), allowing users to hear the melody or parts of a song.
- Polyglot Song Support: sophisticated localization (src/song-languages.ts) that manages song lyrics in multiple
  languages, handling user preferences for which language version to display or print. This includes correct rendering
  RTL and Vertical scripts.
- Regional Music Notation: The transposition logic (src/transpose.ts) specifically handles regional differences, such
  as the German/European usage of "H" instead of "B". Also includes solfege support (src/solfege-util.ts) to support
  Do-Re-Mi notation systems.
- Responsive "Print Mode": Includes logic (resize_for_print in src/render-songxml.ts) to dynamically re-render sheet
  music and lyrics optimized for A4 paper dimensions when printing is detected.

# Development

1. After checkout you need to set up the submodules:

    git submodule update --init

2. You then need to install the dependencies:

    yarn

The following basic commands are available (see package.json for more):

    yarn dev            # Start a development web server and tells you how to connect to it
    yarn lint           # Reformat and lint all code for errors
    yarn test:unit      # Run the unit tests
    yarn test:browser   # Run the browser tests in playwright
    yarn test           # Run all tests
    yarn test:unit:watch # Run the unit tests in watch mode
    yarn build:test     # Do a test build of everything into build/

# History

See https://worshipleaderapp.com/en/story-worship-leader for some details of the general project. The history of the
code in this frontend is that it was originally a single page JQuery Mobile app that grew to around 5k lines of JS
before I split it into a modern build system using webpack around 2016. In 2018/2019 I started migrating to
React/Material UI in a different branch but the project became stuck for a long time. I then updated to vite around
2023 and in 2025/2026 started using some LLM agents to convert to typescript and backport as many of the non-UI
improvements from the react branch to the main branch.

I'm not particularly proud of the state of the code at present but I've been quite time-limited to clean it up and
write tests and proper documentation.

# Other notes

- Static files can be placed in `public/all` for all builds, or `public/<build type>` directories to be copied over.
- You can change copyright restriction settings by typing nocopyright / forcecopyright in the search box

## Custom font

For the musical notes etc we use a custom font. See https://github.com/pettarin/glyphIgo/issues/9 for details

    python glyphIgo.py subset -f ~/Downloads/dejavu-fonts-ttf-2.36/ttf/DejaVuSans.ttf -r 0x2600-0x2700 -o out.woff
    python glyphIgo.py subset -f fontawesome-webfont.ttf -r 0xf0f0-0xf100 -o stave.eot
