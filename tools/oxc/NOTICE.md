# Notice

`src/oxlint/rules/*.ts` and `oxlintrc.json` are copied from Effect's `packages/tools/oxc`
([Effect-TS/effect@594fa71](https://github.com/Effect-TS/effect/tree/594fa71/packages/tools/oxc)), used under the MIT
licence:

> MIT License
>
> Copyright (c) 2023 Effectful Technologies Inc
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
> Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Not copied: `no-unused-internal` (needs the TypeScript 6 compiler API; this repo uses TypeScript 7) and
`no-bigint-literals` (viem and contract code rely on bigint literals).
