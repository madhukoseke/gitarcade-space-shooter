# Third-party notices

## gh-space-shooter

Parts of this project adapt ideas and small pieces of logic from
<https://github.com/czl9707/gh-space-shooter>:

- the GraphQL contribution-calendar query and the `NONE…FOURTH_QUARTILE` to 0-4 level map (`src/lib/github/client.ts`, `src/game/generation/ContributionParser.ts`)
- the week → X, weekday → Y grid mapping (`src/game/generation/FormationGenerator.ts`)
- the column, row zig-zag and distance-weighted random orderings (`src/game/systems/EnemyAISystem.ts`, `src/game/systems/Autopilot.ts`)

That project is distributed under the MIT License:

```
The MIT License (MIT)

Copyright (c) 2026 Zane Chen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Runtime dependencies (Next.js, React, Three.js, React Three Fiber, Drei,
postprocessing, Zustand, Zod) are used unmodified under their own licences;
see each package in `node_modules`.
