This is a React/Material UI project in modern TypeScript.

After you have made changes, run `yarn lint` to check for linting/typing errors, and `yarn test:unit` to run the unit tests.

Most source code lives under src/. Files are named .tsx if they are to do with View, otherwise .ts if they are more
to do with Controllers or Models.

Unit tests live under spec/ and can be run with `yarn test:unit`. When writing tests, try to use minimal mocking
(rather depend on the library code), although spying on functions to ensure they were called correctly is perfectly
fine. In particular don't mock persistentStorage but rather just run .clear() between tests. Don't test basic constants
or functionality but rather focus on running the code in a realistic way and especially checking edge cases. If you
find something that seems to be incorrect, note it as such but don't attempt to fix it. If tests you write fail, don't
just try removing them but think hard and to understand why they fail and try to fix them correctly.

Playwright browser tests live under tests/ and can be run with `yarn test:playwright`.

Once you have completed any changes, run `yarn build:test:chrome` as well to try a full build which may catch
additional errors or issues.

You can test the app using playwright MCP and going to http://localhost:5174/. Initially you will likely need to set up
the database by choosing a language and choosing some song languages to download - try English and Turkish.

## TypeScript Conversion Rules

### General Principles
- Do NOT use inline imports like `import('...').Type` - always use proper imports at the top of the file
- Do NOT use ugly workarounds like `{...{} as any}` or spreading empty objects with type assertions
