This is the source code of the frontend app for [Worship Leader](https://worshipleaderapp.com).

It's based in typescript and the main branch uses very legacy JQuery Mobile.

The in-progress new-react-version branch is a rewrite to use React and Material UI.

From this code-base we produce builds supporting:
- Web (including very old web browsers)
- PWA
- Chrome extension
- Edge extension
- Phonegap supporting all current versions of iOS and Android
- A set of libraries for the editor frontend (legacy AngularJS project) to use

As many phones and browsers are old we want to target the broadest range of support possible.

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

# Other notes

- Static files can be placed in `public/all` for all builds, or `public/<build type>` directories to be copied over.
- You can change copyright restriction settings by typing nocopyright / forcecopyright in the search box

## Custom font

For the musical notes etc we use a custom font. See https://github.com/pettarin/glyphIgo/issues/9 for details

    python glyphIgo.py subset -f ~/Downloads/dejavu-fonts-ttf-2.36/ttf/DejaVuSans.ttf -r 0x2600-0x2700 -o out.woff
    python glyphIgo.py subset -f fontawesome-webfont.ttf -r 0xf0f0-0xf100 -o stave.eot
