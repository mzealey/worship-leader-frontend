This is a jQuery Mobile project which is being gradually converted to modern TypeScript.

After you have made changes, run `yarn lint` to check for linting/typing errors, and `yarn test:unit` to run the unit tests.

Most source code lives under src/

Tests live under spec/ and can be run with `yarn test:unit`. When writing tests, try to use minimal mocking (rather
depend on the library code), although spying on functions to ensure they were called correctly is perfectly fine. In
particular don't mock persistentStorage but rather just run .clear() between tests. Don't test basic constants or
functionality but rather focus on running the code in a realistic way and especially checking edge cases. If you find
something that seems to be incorrect, note it as such but don't attempt to fix it. If tests you write fail, don't just
try removing them but think hard and to understand why they fail and try to fix them correctly.
