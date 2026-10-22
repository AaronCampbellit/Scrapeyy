# Third-party notices

Original Scrapeyy software is separate from the libraries, tooling and assets listed here. Any rights-reserved notice for original work does not replace or restrict these third-party licenses or copyrights. This file records inspected dependencies, selected alternative licenses and remaining publication/distribution gaps.

## Extension distributions

Source imports confirm React/React DOM, DOMPurify and JSZip in the extension. WXT is a build tool and also provides imported browser/shadow-root helpers. Runtime imports include `wxt/browser` → `@wxt-dev/browser` and `wxt/utils/content-script-ui/shadow-root` → `@webext-core/isolated-element`. Other WXT/build dependencies should not automatically be described as shipped application code just because the lockfile marks them non-dev.

- **DOMPurify 3.4.16:** Apache-2.0 is the selected option from `(MPL-2.0 OR Apache-2.0)`. Preserve the Apache text and the Cure53/contributor copyright notice from `dompurify/dist/purify.es.mjs`. Source: [Cure53 DOMPurify](https://github.com/cure53/DOMPurify).
- **JSZip 3.10.1:** MIT is the selected option from `(MIT OR GPL-3.0-or-later)`. Its preserved MIT section contains copyright 2009–2016 Stuart Knightley, David Duponchel, Franz Buchinger and António Afonso. See the [release license](https://github.com/Stuk/jszip/blob/v3.10.1/LICENSE.markdown).
- **pako:** Both the root MIT text and `lib/zlib/README` zlib notices are preserved. The latter credits Jean-loup Gailly, Mark Adler, Vitaly Puzrin and Andrey Tupitsin. A rights-reserved statement for Scrapeyy does not claim their code.
- **React and React DOM:** Preserve their MIT copyright/license with bundled portions. The inventory includes their exact installed versions and texts.

Chrome and Firefox builds, including extension ZIPs, include this notice, the original-material terms and all collected full texts in `legal/`. A build hook packages them automatically; retain this directory and the generated copyright notices with distributed extensions.

## Build and test tools

The inventory also includes WXT's tooling, Vite, TypeScript, Vitest, Babel, platform bindings and their dependencies. `caniuse-lite` is CC-BY-4.0 browser-support data used through build tooling; retain its attribution/terms if that data or tool package is redistributed. This does not apply CC-BY to separately authored Scrapeyy code. Native build-tool package metadata is not a complete audit of embedded native components.

## Publication assets and provenance

The current icon is original geometric SVG artwork rendered locally. Three unreferenced old concept images and unverified icon rasters were removed or replaced. See [asset provenance](docs/ASSET_PROVENANCE.md).

The implementation screenshots in `docs/screenshots/` are documented local captures of synthetic content in `docs/screenshots/README.md`. Underlying third-party code/assets/marks retain their own rights. Scraping/capturing an external website through Scrapeyy does not transfer the website's copyright or grant permission to republish its content.


## Inventory limits

This inventory records the installed packages inspected on 2026-10-08. Platform-specific packages present only in the lockfile were not unpacked here. Native binaries may embed additional components; this is not a complete operating-system/container-image license inventory. Recheck notices when dependencies or release contents change. Full texts below retain their upstream copyrights and terms; identical texts are stored once.

The following two build/test-only components supply MIT metadata but no full grant text at their verified upstream revisions. They are not shipped extension dependencies; redistributing those tool packages remains outside this application license pack. The imported browser helper now has a version-verified full MIT text.

- `@napi-rs/lzma-linux-x64-gnu@1.5.1`: Native build-tool binding; absent from delivered browser code.
- `stackback@0.0.2`: Test runner helper; absent from delivered browser code.


<details>
<summary>. installed dependency inventory (276 packages)</summary>

The last column links preserved texts. The lock's dev flag describes installation, not whether a build tool's code is bundled. See the distribution notes above and the [machine-readable inventory](third-party-licenses/manifest.json).

| Component | Version | License | Lock flag | Evidence |
| --- | --- | --- | --- | --- |
| `@1natsu/wait-element` | `4.2.0` | MIT | declared non-dev | [source](https://github.com/1natsu172/wait-element) · [text 1](third-party-licenses/texts/6e81319923feebdc6076--license) |
| `@adobe/css-tools` | `4.5.0` | MIT | dev/build | [source](https://github.com/adobe/css-tools) · [text 1](third-party-licenses/texts/326ff3850062286003ff--LICENSE) |
| `@aklinker1/rollup-plugin-visualizer` | `5.12.0` | MIT | declared non-dev | [source](https://github.com/btd/rollup-plugin-visualizer) · [text 1](third-party-licenses/texts/975abd563775a4953726--LICENSE) |
| `picomatch` | `2.3.2` | MIT | declared non-dev | [source](https://github.com/micromatch/picomatch) · [text 1](third-party-licenses/texts/d0cd141b0c322fded5df--LICENSE) |
| `@aklinker1/zero-zip` | `1.0.1` | MIT | declared non-dev | [npm](https://www.npmjs.com/package/@aklinker1/zero-zip) · [text 1](third-party-licenses/texts/50c738992d78e37f1257--LICENSE) |
| `@asamuzakjp/css-color` | `6.0.5` | MIT | dev/build | [source](https://github.com/asamuzaK/cssColor) · [text 1](third-party-licenses/texts/bd4539377980dd797fc6--LICENSE) |
| `@asamuzakjp/dom-selector` | `8.3.2` | MIT | dev/build | [source](https://github.com/asamuzaK/domSelector) · [text 1](third-party-licenses/texts/7cdf9db3b91cc77b9ec9--LICENSE) |
| `@babel/code-frame` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/compat-data` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/core` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/generator` | `7.29.8` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-compilation-targets` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `lru-cache` | `5.1.1` | ISC | declared non-dev | [source](https://github.com/isaacs/node-lru-cache) · [text 1](third-party-licenses/texts/4ec3d4c66cd87f5c8d8a--LICENSE) |
| `@babel/helper-globals` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-module-imports` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-module-transforms` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-plugin-utils` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-string-parser` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-validator-identifier` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helper-validator-option` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/helpers` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/4be9d87b56a306293223--LICENSE) |
| `@babel/parser` | `7.29.8` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/2e97627cb278aa7556fb--LICENSE) |
| `@babel/plugin-transform-react-jsx-self` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/plugin-transform-react-jsx-source` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/runtime` | `7.29.7` | MIT | dev/build | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/template` | `7.29.7` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/traverse` | `7.29.8` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@babel/types` | `7.29.8` | MIT | declared non-dev | [source](https://github.com/babel/babel) · [text 1](third-party-licenses/texts/117da2af0d4ce0fe1c8e--LICENSE) |
| `@bramus/specificity` | `2.4.2` | MIT | dev/build | [source](https://github.com/bramus/specificity) · [text 1](third-party-licenses/texts/ae842a63dd9bc829c95a--LICENSE) |
| `@csstools/color-helpers` | `6.1.0` | MIT-0 | dev/build | [source](https://github.com/csstools/postcss-plugins) · [text 1](third-party-licenses/texts/947e32047a166cd05f04--LICENSE.md) |
| `@csstools/css-calc` | `3.3.0` | MIT | dev/build | [source](https://github.com/csstools/postcss-plugins) · [text 1](third-party-licenses/texts/d00d032f517721b45c56--LICENSE.md) |
| `@csstools/css-color-parser` | `4.1.10` | MIT | dev/build | [source](https://github.com/csstools/postcss-plugins) · [text 1](third-party-licenses/texts/d00d032f517721b45c56--LICENSE.md) |
| `@csstools/css-parser-algorithms` | `4.0.0` | MIT | dev/build | [source](https://github.com/csstools/postcss-plugins) · [text 1](third-party-licenses/texts/d00d032f517721b45c56--LICENSE.md) |
| `@csstools/css-syntax-patches-for-csstree` | `1.1.7` | MIT-0 | dev/build | [source](https://github.com/csstools/postcss-plugins) · [text 1](third-party-licenses/texts/947e32047a166cd05f04--LICENSE.md) |
| `@csstools/css-tokenizer` | `4.0.0` | MIT | dev/build | [source](https://github.com/csstools/postcss-plugins) · [text 1](third-party-licenses/texts/d00d032f517721b45c56--LICENSE.md) |
| `@esbuild/linux-x64` | `0.28.1` | MIT | declared non-dev | [source](https://github.com/evanw/esbuild) · [text 1](third-party-licenses/texts/b40ec5baec7bb34fa5b1--LICENSE.md) |
| `@exodus/bytes` | `1.15.1` | MIT | dev/build | [source](https://github.com/ExodusOSS/bytes) · [text 1](third-party-licenses/texts/dbffd380d59504ba19fc--LICENSE) |
| `@jridgewell/gen-mapping` | `0.3.13` | MIT | declared non-dev | [source](https://github.com/jridgewell/sourcemaps) · [text 1](third-party-licenses/texts/769d154fbde32a915af1--LICENSE) |
| `@jridgewell/remapping` | `2.3.5` | MIT | declared non-dev | [source](https://github.com/jridgewell/sourcemaps) · [text 1](third-party-licenses/texts/769d154fbde32a915af1--LICENSE) |
| `@jridgewell/resolve-uri` | `3.1.2` | MIT | declared non-dev | [source](https://github.com/jridgewell/resolve-uri) · [text 1](third-party-licenses/texts/b8778b155bfde5a28b02--LICENSE) |
| `@jridgewell/sourcemap-codec` | `1.5.5` | MIT | declared non-dev | [source](https://github.com/jridgewell/sourcemaps) · [text 1](third-party-licenses/texts/769d154fbde32a915af1--LICENSE) |
| `@jridgewell/trace-mapping` | `0.3.31` | MIT | declared non-dev | [source](https://github.com/jridgewell/sourcemaps) · [text 1](third-party-licenses/texts/769d154fbde32a915af1--LICENSE) |
| `@napi-rs/lzma-linux-x64-gnu` | `1.5.1` | MIT | declared non-dev | [source](https://github.com/Brooooooklyn/lzma) · full text unresolved |
| `@rolldown/pluginutils` | `1.0.0-rc.3` | MIT | declared non-dev | [source](https://github.com/rolldown/rolldown) · [text 1](third-party-licenses/texts/23ecfff35a5a2e80d921--LICENSE) |
| `@rollup/rollup-linux-x64-gnu` | `4.62.4` | MIT | declared non-dev | [source](https://github.com/rollup/rollup) · [text 1](third-party-licenses/texts/fa1bd040c5bdeefe65b3--LICENSE.md) |
| `@standard-schema/spec` | `1.1.0` | MIT | dev/build | [source](https://github.com/standard-schema/standard-schema) · [text 1](third-party-licenses/texts/653b779005a3a4d64a72--LICENSE) |
| `@testing-library/dom` | `10.4.1` | MIT | dev/build | [source](https://github.com/testing-library/dom-testing-library) · [text 1](third-party-licenses/texts/bf8fd38056b7606deccf--LICENSE) |
| `@testing-library/jest-dom` | `6.9.1` | MIT | dev/build | [source](https://github.com/testing-library/jest-dom) · [text 1](third-party-licenses/texts/bf8fd38056b7606deccf--LICENSE) |
| `dom-accessibility-api` | `0.6.3` | MIT | dev/build | [source](https://github.com/eps1lon/dom-accessibility-api) · [text 1](third-party-licenses/texts/0ffe67fe630169de46df--LICENSE.md) |
| `@testing-library/react` | `16.3.2` | MIT | dev/build | [source](https://github.com/testing-library/react-testing-library) · [text 1](third-party-licenses/texts/9680978280d509520d2a--LICENSE) |
| `@testing-library/user-event` | `14.6.3` | MIT | dev/build | [source](https://github.com/testing-library/user-event) · [text 1](third-party-licenses/texts/b5a4028c49c48f820831--LICENSE) |
| `@topcli/prompts` | `4.0.0` | ISC | declared non-dev | [source](https://github.com/TopCli/prompts) · [text 1](third-party-licenses/texts/eab76099d5263e415b65--LICENSE) |
| `@types/aria-query` | `5.0.4` | MIT | dev/build | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/babel__core` | `7.20.5` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/babel__generator` | `7.27.0` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/babel__template` | `7.4.4` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/babel__traverse` | `7.28.0` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/chai` | `5.2.3` | MIT | dev/build | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/deep-eql` | `4.0.2` | MIT | dev/build | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/estree` | `1.0.9` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/filesystem` | `0.0.36` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/filewriter` | `0.0.33` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/har-format` | `1.2.16` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/node` | `24.13.3` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/react` | `19.2.9` | MIT | dev/build | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/react-dom` | `19.2.3` | MIT | dev/build | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@types/trusted-types` | `2.0.7` | MIT | declared non-dev | [source](https://github.com/DefinitelyTyped/DefinitelyTyped) · [text 1](third-party-licenses/texts/c2cfccb812fe482101a8--LICENSE) |
| `@typescript/typescript-linux-x64` | `7.0.2` | Apache-2.0 | declared non-dev | [source](https://github.com/microsoft/TypeScript) · [text 1](third-party-licenses/texts/a7d00bfd54525bc694b6--LICENSE), [text 2](third-party-licenses/texts/f5c708b59114507b8b27--NOTICE.txt) |
| `@vitejs/plugin-react` | `5.2.0` | MIT | declared non-dev | [source](https://github.com/vitejs/vite-plugin-react) · [text 1](third-party-licenses/texts/29b68325fe026047d13e--LICENSE) |
| `@vitest/expect` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@vitest/mocker` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@vitest/pretty-format` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@vitest/runner` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@vitest/snapshot` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@vitest/spy` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@vitest/utils` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/04575fc5bfae19a9b631--LICENSE) |
| `@webext-core/fake-browser` | `2.0.1` | MIT | declared non-dev | [source](https://github.com/aklinker1/webext-core) · [text 1](third-party-licenses/texts/3ecd2df3daf4e8ad35ab---webext-core__fake-browser-2.0.1-LICENSE) |
| `@webext-core/isolated-element` | `3.0.0` | MIT | declared non-dev | [source](https://github.com/aklinker1/webext-core) · [text 1](third-party-licenses/texts/3ecd2df3daf4e8ad35ab---webext-core__isolated-element-3.0.0-LICENSE) |
| `@webext-core/match-patterns` | `2.0.0` | MIT | declared non-dev | [source](https://github.com/aklinker1/webext-core) · [text 1](third-party-licenses/texts/3ecd2df3daf4e8ad35ab---webext-core__match-patterns-2.0.0-LICENSE) |
| `@wxt-dev/browser` | `0.2.5` | MIT | extension runtime helper | [source](https://github.com/wxt-dev/wxt/tree/71876fd1c19e0faf8412664f12b6fd890c0244df) · [full text](third-party-licenses/texts/7b0b00fcdbc6a036078a--WXT-LICENSE) |
| `@wxt-dev/module-react` | `1.2.2` | MIT | declared non-dev | [source](https://github.com/wxt-dev/wxt) · [text 1](third-party-licenses/texts/7b0b00fcdbc6a036078a--LICENSE) |
| `@wxt-dev/storage` | `1.2.9` | MIT | declared non-dev | [source](https://github.com/wxt-dev/wxt) · [text 1](third-party-licenses/texts/7b0b00fcdbc6a036078a---wxt-dev__storage-1.2.9-LICENSE) |
| `acorn` | `8.18.0` | MIT | declared non-dev | [source](https://github.com/acornjs/acorn) · [text 1](third-party-licenses/texts/76a876cf886ff9be2a8b--LICENSE) |
| `ansi-regex` | `5.0.1` | MIT | declared non-dev | [source](https://github.com/chalk/ansi-regex) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `ansi-styles` | `5.2.0` | MIT | dev/build | [source](https://github.com/chalk/ansi-styles) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `aria-query` | `5.3.0` | Apache-2.0 | dev/build | [source](https://github.com/A11yance/aria-query) · [text 1](third-party-licenses/texts/c8df456c7ccba74b9590--LICENSE) |
| `assertion-error` | `2.0.1` | MIT | dev/build | [source](https://github.com/chaijs/assertion-error) · [text 1](third-party-licenses/texts/2130216d5ab4c02134f8--LICENSE) |
| `baseline-browser-mapping` | `2.11.12` | Apache-2.0 | declared non-dev | [source](https://github.com/web-platform-dx/baseline-browser-mapping) · [text 1](third-party-licenses/texts/c71d239df91726fc519c--LICENSE.txt) |
| `bidi-js` | `1.0.3` | MIT | dev/build | [source](https://github.com/lojjic/bidi-js) · [text 1](third-party-licenses/texts/49d4d143fed599deb502--LICENSE.txt) |
| `boolbase` | `2.0.0` | ISC | declared non-dev | [source](https://github.com/fb55/boolbase) · [text 1](third-party-licenses/texts/cdf4d87ae0a6c1602272--LICENSE) |
| `browserslist` | `4.28.7` | MIT | declared non-dev | [source](https://github.com/browserslist/browserslist) · [text 1](third-party-licenses/texts/21c2679a63d7699c0e64--LICENSE) |
| `c12` | `3.3.4` | MIT | declared non-dev | [source](https://github.com/unjs/c12) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `cac` | `7.0.0` | MIT | declared non-dev | [source](https://github.com/cacjs/cac) · [text 1](third-party-licenses/texts/709131d7af352b81204a--LICENSE) |
| `caniuse-lite` | `1.0.30001807` | CC-BY-4.0 | declared non-dev | [source](https://github.com/browserslist/caniuse-lite) · [text 1](third-party-licenses/texts/fd3a263fe19ed8faa906--LICENSE) |
| `chai` | `6.3.0` | MIT | dev/build | [source](https://github.com/chaijs/chai) · [text 1](third-party-licenses/texts/b181da80336ff9dd1043--LICENSE) |
| `chokidar` | `5.0.0` | MIT | declared non-dev | [source](https://github.com/paulmillr/chokidar) · [text 1](third-party-licenses/texts/bdfd5e0edb6089e6586c--LICENSE) |
| `citty` | `0.2.2` | MIT | declared non-dev | [source](https://github.com/unjs/citty) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `cliui` | `8.0.1` | ISC | declared non-dev | [source](https://github.com/yargs/cliui) · [text 1](third-party-licenses/texts/2dc0465729366c3a7890--LICENSE.txt) |
| `color-convert` | `2.0.1` | MIT | declared non-dev | [source](https://github.com/Qix-/color-convert) · [text 1](third-party-licenses/texts/693866fc419c6f61c857--LICENSE) |
| `color-name` | `1.1.4` | MIT | declared non-dev | [source](https://github.com/colorjs/color-name) · [text 1](third-party-licenses/texts/c064f7a3e353bc1bc977--LICENSE) |
| `confbox` | `0.2.4` | MIT | declared non-dev | [source](https://github.com/unjs/confbox) · [text 1](third-party-licenses/texts/c6e83b9be7af3b907525--LICENSE) |
| `consola` | `3.4.2` | MIT | declared non-dev | [source](https://github.com/unjs/consola) · [text 1](third-party-licenses/texts/df0e3cef4a42bae7db60--LICENSE) |
| `convert-source-map` | `2.0.0` | MIT | declared non-dev | [source](https://github.com/thlorenz/convert-source-map) · [text 1](third-party-licenses/texts/1fa6ee8bb95a81ae3d73--LICENSE) |
| `core-util-is` | `1.0.3` | MIT | declared non-dev | [source](https://github.com/isaacs/core-util-is) · [text 1](third-party-licenses/texts/33b734d60042d0fe0c92--LICENSE) |
| `css-select` | `7.0.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/css-select) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `css-tree` | `3.2.1` | MIT | dev/build | [source](https://github.com/csstree/csstree) · [text 1](third-party-licenses/texts/719a251ceca49c057ea9--LICENSE) |
| `css-what` | `8.0.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/css-what) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `css.escape` | `1.5.1` | MIT | dev/build | [source](https://github.com/mathiasbynens/CSS.escape) · [text 1](third-party-licenses/texts/483acb265f182907d1ca--LICENSE-MIT.txt) |
| `cssom` | `0.5.0` | MIT | declared non-dev | [source](https://github.com/NV/CSSOM) · [text 1](third-party-licenses/texts/e539937c489c4928ad74--LICENSE.txt) |
| `csstype` | `3.2.3` | MIT | dev/build | [source](https://github.com/frenic/csstype) · [text 1](third-party-licenses/texts/11d55bd4541c75ee7879--LICENSE) |
| `data-urls` | `7.0.0` | MIT | dev/build | [source](https://github.com/jsdom/data-urls) · [text 1](third-party-licenses/texts/528eec83cb836a0adda9--LICENSE.txt) |
| `whatwg-url` | `16.0.1` | MIT | dev/build | [source](https://github.com/jsdom/whatwg-url) · [text 1](third-party-licenses/texts/db480f236292a093e77a--LICENSE.txt) |
| `debug` | `4.4.3` | MIT | declared non-dev | [source](https://github.com/debug-js/debug) · [text 1](third-party-licenses/texts/3a61c6c96caf5c1d9b62--LICENSE) |
| `decimal.js` | `10.6.0` | MIT | dev/build | [source](https://github.com/MikeMcl/decimal.js) · [text 1](third-party-licenses/texts/3108b546bcff5d346923--LICENCE.md) |
| `define-lazy-prop` | `2.0.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/define-lazy-prop) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `defu` | `6.1.7` | MIT | declared non-dev | [source](https://github.com/unjs/defu) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `dequal` | `2.0.3` | MIT | dev/build | [source](https://github.com/lukeed/dequal) · [text 1](third-party-licenses/texts/306fa513e39b23a6e874--license) |
| `destr` | `2.0.5` | MIT | declared non-dev | [source](https://github.com/unjs/destr) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `dom-accessibility-api` | `0.5.16` | MIT | dev/build | [source](https://github.com/eps1lon/dom-accessibility-api) · [text 1](third-party-licenses/texts/0ffe67fe630169de46df--LICENSE.md) |
| `dom-serializer` | `3.1.1` | MIT | declared non-dev | [source](https://github.com/cheeriojs/dom-serializer) · [text 1](third-party-licenses/texts/fd495b1bdd024995c6b3--LICENSE) |
| `domelementtype` | `3.0.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/domelementtype) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `domhandler` | `6.0.1` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/domhandler) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `dompurify` | `3.4.16` | Apache-2.0 (selected alternative) | declared non-dev | [source](https://github.com/cure53/DOMPurify) · [text 1](third-party-licenses/texts/cfc7749b96f63bd31c3c--LICENSE), [text 2](third-party-licenses/texts/eb5c0821d669f781f7f6--purify.es.mjs) |
| `domutils` | `4.0.2` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/domutils) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `dotenv` | `17.4.2` | BSD-2-Clause | declared non-dev | [source](https://github.com/motdotla/dotenv) · [text 1](third-party-licenses/texts/74b629b24865e1e83c52--LICENSE) |
| `dotenv-expand` | `13.0.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/motdotla/dotenv-expand) · [text 1](third-party-licenses/texts/3726b9470c3a6b54e1eb--LICENSE) |
| `electron-to-chromium` | `1.5.402` | ISC | declared non-dev | [source](https://github.com/Kilian/electron-to-chromium) · [text 1](third-party-licenses/texts/25ba5c59dad3e0dd8f95--LICENSE) |
| `emoji-regex` | `8.0.0` | MIT | declared non-dev | [source](https://github.com/mathiasbynens/emoji-regex) · [text 1](third-party-licenses/texts/483acb265f182907d1ca--LICENSE-MIT.txt) |
| `entities` | `8.0.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/entities) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `es-module-lexer` | `2.3.1` | MIT | dev/build | [source](https://github.com/guybedford/es-module-lexer) · [text 1](third-party-licenses/texts/8a4b6c44eebfb026d237--LICENSE) |
| `esbuild` | `0.28.1` | MIT | declared non-dev | [source](https://github.com/evanw/esbuild) · [text 1](third-party-licenses/texts/b40ec5baec7bb34fa5b1--LICENSE.md) |
| `escalade` | `3.2.0` | MIT | declared non-dev | [source](https://github.com/lukeed/escalade) · [text 1](third-party-licenses/texts/9a9edad7baae52622bdd--license) |
| `escape-string-regexp` | `5.0.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/escape-string-regexp) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `estree-walker` | `3.0.3` | MIT | declared non-dev | [source](https://github.com/Rich-Harris/estree-walker) · [text 1](third-party-licenses/texts/8a6dcbabe7179f9c8489--LICENSE) |
| `expect-type` | `1.4.0` | Apache-2.0 | dev/build | [source](https://github.com/mmkal/expect-type) · [text 1](third-party-licenses/texts/7c6cc83c84eaa249a85b--LICENSE) |
| `exsolve` | `1.1.1` | MIT | declared non-dev | [source](https://github.com/unjs/exsolve) · [text 1](third-party-licenses/texts/d37af134e0d0b9983931--LICENSE) |
| `fake-indexeddb` | `6.2.5` | Apache-2.0 | dev/build | [source](https://github.com/dumbmatter/fakeIndexedDB) · [text 1](third-party-licenses/texts/0c2e77addd3045b932ae--LICENSE) |
| `fdir` | `6.5.0` | MIT | declared non-dev | [source](https://github.com/thecodrr/fdir) · [text 1](third-party-licenses/texts/9a39f2aadab11a3697ed--LICENSE) |
| `filesize` | `11.0.22` | BSD-3-Clause | declared non-dev | [source](https://github.com/avoidwork/filesize.js) · [text 1](third-party-licenses/texts/dcc6ac957d32319cb726--LICENSE) |
| `gensync` | `1.0.0-beta.2` | MIT | declared non-dev | [source](https://github.com/loganfsmyth/gensync) · [text 1](third-party-licenses/texts/e3a956681ee067f971ac--LICENSE) |
| `get-caller-file` | `2.0.5` | ISC | declared non-dev | [source](https://github.com/stefanpenner/get-caller-file) · [text 1](third-party-licenses/texts/902dbb4154679fb2b8d7--LICENSE.md) |
| `get-port-please` | `3.2.0` | MIT | declared non-dev | [source](https://github.com/unjs/get-port-please) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `giget` | `3.3.1` | MIT | declared non-dev | [source](https://github.com/unjs/giget) · [text 1](third-party-licenses/texts/858a63872e40ca764098--LICENSE) |
| `hookable` | `6.1.1` | MIT | declared non-dev | [source](https://github.com/unjs/hookable) · [text 1](third-party-licenses/texts/3555f8c47cbff86d199d--LICENSE.md) |
| `html-encoding-sniffer` | `6.0.0` | MIT | dev/build | [source](https://github.com/jsdom/html-encoding-sniffer) · [text 1](third-party-licenses/texts/528eec83cb836a0adda9--LICENSE.txt) |
| `html-escaper` | `3.0.3` | MIT | declared non-dev | [source](https://github.com/WebReflection/html-escaper) · [text 1](third-party-licenses/texts/27d06bbb2eb031be8aa3--LICENSE.txt) |
| `htmlparser2` | `10.1.0` | MIT | declared non-dev | [source](https://github.com/fb55/htmlparser2) · [text 1](third-party-licenses/texts/204cfa747341660e4da6--LICENSE) |
| `dom-serializer` | `2.0.0` | MIT | declared non-dev | [source](https://github.com/cheeriojs/dom-serializer) · [text 1](third-party-licenses/texts/94cfe87de9b178e8fee3--LICENSE) |
| `entities` | `4.5.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/entities) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `domelementtype` | `2.3.0` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/domelementtype) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `domhandler` | `5.0.3` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/domhandler) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `domutils` | `3.2.2` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/domutils) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `entities` | `7.0.1` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/entities) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `immediate` | `3.0.6` | MIT | declared non-dev | [source](https://github.com/calvinmetcalf/immediate) · [text 1](third-party-licenses/texts/809e66de579fb7d92503--LICENSE.txt) |
| `indent-string` | `4.0.0` | MIT | dev/build | [source](https://github.com/sindresorhus/indent-string) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `inherits` | `2.0.4` | ISC | declared non-dev | [source](https://github.com/isaacs/inherits) · [text 1](third-party-licenses/texts/5ffe28e7ade7d8f10d85--LICENSE) |
| `is-docker` | `3.0.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/is-docker) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `is-fullwidth-code-point` | `3.0.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/is-fullwidth-code-point) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `is-inside-container` | `1.0.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/is-inside-container) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `is-potential-custom-element-name` | `1.0.1` | MIT | declared non-dev | [source](https://github.com/mathiasbynens/is-potential-custom-element-name) · [text 1](third-party-licenses/texts/483acb265f182907d1ca--LICENSE-MIT.txt) |
| `is-wsl` | `3.1.1` | MIT | declared non-dev | [source](https://github.com/sindresorhus/is-wsl) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `isarray` | `1.0.0` | MIT | declared non-dev | [source](https://github.com/juliangruber/isarray) · [text 1](third-party-licenses/texts/66aa9feab8bb39aceebd--README.md) |
| `jiti` | `2.7.0` | MIT | declared non-dev | [source](https://github.com/unjs/jiti) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `js-tokens` | `4.0.0` | MIT | declared non-dev | [source](https://github.com/lydell/js-tokens) · [text 1](third-party-licenses/texts/2213d91c606205c71eb0--LICENSE) |
| `jsdom` | `30.0.1` | MIT | dev/build | [source](https://github.com/jsdom/jsdom) · [text 1](third-party-licenses/texts/242d37e7cab25cbafc36--LICENSE.txt) |
| `jsesc` | `3.1.0` | MIT | declared non-dev | [source](https://github.com/mathiasbynens/jsesc) · [text 1](third-party-licenses/texts/483acb265f182907d1ca--LICENSE-MIT.txt) |
| `json5` | `2.2.3` | MIT | declared non-dev | [source](https://github.com/json5/json5) · [text 1](third-party-licenses/texts/53e59feb13058722d977--LICENSE.md) |
| `jszip` | `3.10.1` | MIT (selected alternative) | declared non-dev | [source](https://github.com/Stuk/jszip) · [text 1](third-party-licenses/texts/566c953c6090b1218ca6--LICENSE.markdown) |
| `lie` | `3.3.0` | MIT | declared non-dev | [source](https://github.com/calvinmetcalf/lie) · [text 1](third-party-licenses/texts/5c81b0caa98593408b03--license.md) |
| `linkedom` | `0.18.13` | ISC | declared non-dev | [source](https://github.com/WebReflection/linkedom) · [text 1](third-party-licenses/texts/dc6d4961d8b6ee747231--LICENSE) |
| `local-pkg` | `1.2.1` | MIT | declared non-dev | [source](https://github.com/antfu-collective/local-pkg) · [text 1](third-party-licenses/texts/67cd5e903c1f908edfa2--LICENSE) |
| `lodash.merge` | `4.6.2` | MIT | declared non-dev | [source](https://github.com/lodash/lodash) · [text 1](third-party-licenses/texts/f71e8ed126b46346494a--LICENSE) |
| `lru-cache` | `11.5.2` | BlueOak-1.0.0 | dev/build | [npm](https://www.npmjs.com/package/lru-cache) · [text 1](third-party-licenses/texts/8a1af140fdfbf5afd3df--LICENSE.md) |
| `lz-string` | `1.5.0` | MIT | dev/build | [source](https://github.com/pieroxy/lz-string) · [text 1](third-party-licenses/texts/433fc9dfe659dbfb1e91--LICENSE) |
| `magic-string` | `0.30.21` | MIT | dev/build | [source](https://github.com/Rich-Harris/magic-string) · [text 1](third-party-licenses/texts/1cbe51b907662f6cb149--LICENSE) |
| `magicast` | `0.5.4` | MIT | declared non-dev | [source](https://github.com/unjs/magicast) · [text 1](third-party-licenses/texts/7917b04272f3f7c11f9f--LICENSE) |
| `many-keys-map` | `3.0.3` | MIT | declared non-dev | [source](https://github.com/fregante/many-keys-map) · [text 1](third-party-licenses/texts/4f1216089ff1fae958e8--license) |
| `mdn-data` | `2.27.1` | CC0-1.0 | dev/build | [source](https://github.com/mdn/data) · [text 1](third-party-licenses/texts/36ffd9dc085d529a7e60--LICENSE) |
| `min-indent` | `1.0.1` | MIT | dev/build | [source](https://github.com/thejameskyle/min-indent) · [text 1](third-party-licenses/texts/9638fa87f845af6cecc5--license) |
| `mlly` | `1.8.2` | MIT | declared non-dev | [source](https://github.com/unjs/mlly) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `confbox` | `0.1.8` | MIT | declared non-dev | [source](https://github.com/unjs/confbox) · [text 1](third-party-licenses/texts/2b2bbe4244586c068b33--LICENSE) |
| `pkg-types` | `1.3.1` | MIT | declared non-dev | [source](https://github.com/unjs/pkg-types) · [text 1](third-party-licenses/texts/cb00dc7c358014d300db--LICENSE) |
| `ms` | `2.1.3` | MIT | declared non-dev | [source](https://github.com/vercel/ms) · [text 1](third-party-licenses/texts/1662fae9b5314d11cf51--license.md) |
| `nano-spawn` | `2.1.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/nano-spawn) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `nanoid` | `3.3.20` | MIT | declared non-dev | [source](https://github.com/ai/nanoid) · [text 1](third-party-licenses/texts/da4db1480d9beea3483a--LICENSE) |
| `nanospinner` | `1.2.2` | MIT | declared non-dev | [source](https://github.com/usmanyunusov/nanospinner) · [text 1](third-party-licenses/texts/70e38ae3970b9137ca8a--LICENSE) |
| `node-releases` | `2.0.53` | MIT | declared non-dev | [source](https://github.com/chicoxyzzy/node-releases) · [text 1](third-party-licenses/texts/3706296ed611888111ce--LICENSE) |
| `normalize-path` | `3.0.0` | MIT | declared non-dev | [source](https://github.com/jonschlinkert/normalize-path) · [text 1](third-party-licenses/texts/e70ff771504ba41f2be5--LICENSE) |
| `nth-check` | `3.0.1` | BSD-2-Clause | declared non-dev | [source](https://github.com/fb55/nth-check) · [text 1](third-party-licenses/texts/cb992345949ccd6e8394--LICENSE) |
| `nypm` | `0.6.9` | MIT | declared non-dev | [source](https://github.com/unjs/nypm) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `obug` | `2.1.4` | MIT | dev/build | [source](https://github.com/sxzz/obug) · [text 1](third-party-licenses/texts/ee48679d379ca6b4493d--LICENSE) |
| `ohash` | `2.0.11` | MIT | declared non-dev | [source](https://github.com/unjs/ohash) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `open` | `8.4.2` | MIT | declared non-dev | [source](https://github.com/sindresorhus/open) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `is-docker` | `2.2.1` | MIT | declared non-dev | [source](https://github.com/sindresorhus/is-docker) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `is-wsl` | `2.2.0` | MIT | declared non-dev | [source](https://github.com/sindresorhus/is-wsl) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `pako` | `1.0.11` | (MIT AND Zlib) | declared non-dev | [source](https://github.com/nodeca/pako) · [text 1](third-party-licenses/texts/a04665b3b2de56c66730--LICENSE), [text 2](third-party-licenses/texts/d8b499598e43d755ea89--README) |
| `parse5` | `8.0.1` | MIT | dev/build | [source](https://github.com/inikulin/parse5) · [text 1](third-party-licenses/texts/8c535800331e1e443983--LICENSE) |
| `pathe` | `2.0.3` | MIT | declared non-dev | [source](https://github.com/unjs/pathe) · [text 1](third-party-licenses/texts/52e92576851154bad773--LICENSE) |
| `perfect-debounce` | `2.1.0` | MIT | declared non-dev | [source](https://github.com/unjs/perfect-debounce) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `picocolors` | `1.1.1` | ISC | declared non-dev | [source](https://github.com/alexeyraspopov/picocolors) · [text 1](third-party-licenses/texts/6582629e2979466878f6--LICENSE) |
| `picomatch` | `4.0.5` | MIT | declared non-dev | [source](https://github.com/micromatch/picomatch) · [text 1](third-party-licenses/texts/d0cd141b0c322fded5df--LICENSE) |
| `pkg-types` | `2.3.1` | MIT | declared non-dev | [source](https://github.com/unjs/pkg-types) · [text 1](third-party-licenses/texts/cb00dc7c358014d300db--LICENSE) |
| `postcss` | `8.5.26` | MIT | declared non-dev | [source](https://github.com/postcss/postcss) · [text 1](third-party-licenses/texts/5be1f3465bba68a62677--LICENSE) |
| `pretty-format` | `27.5.1` | MIT | dev/build | [source](https://github.com/facebook/jest) · [text 1](third-party-licenses/texts/52412d7bc7ce4157ea62--LICENSE) |
| `process-nextick-args` | `2.0.1` | MIT | declared non-dev | [source](https://github.com/calvinmetcalf/process-nextick-args) · [text 1](third-party-licenses/texts/ecdccbcf39024f624ded--license.md) |
| `publish-browser-extension` | `6.0.0` | MIT | declared non-dev | [source](https://github.com/aklinker1/publish-browser-extension) · [text 1](third-party-licenses/texts/a517f0612579a2ee8bd4--LICENSE) |
| `punycode` | `2.3.1` | MIT | dev/build | [source](https://github.com/mathiasbynens/punycode.js) · [text 1](third-party-licenses/texts/483acb265f182907d1ca--LICENSE-MIT.txt) |
| `quansync` | `0.2.11` | MIT | declared non-dev | [source](https://github.com/quansync-dev/quansync) · [text 1](third-party-licenses/texts/fd8a6a9b107d6591b3ef--LICENSE.md) |
| `rc9` | `3.0.1` | MIT | declared non-dev | [source](https://github.com/unjs/rc9) · [text 1](third-party-licenses/texts/688222000d499a064a7f--LICENSE) |
| `react` | `19.2.8` | MIT | declared non-dev | [source](https://github.com/react/react) · [text 1](third-party-licenses/texts/da6d3703ed11cbe42bd2--LICENSE) |
| `react-dom` | `19.2.8` | MIT | declared non-dev | [source](https://github.com/react/react) · [text 1](third-party-licenses/texts/da6d3703ed11cbe42bd2--LICENSE) |
| `react-is` | `17.0.2` | MIT | dev/build | [source](https://github.com/facebook/react) · [text 1](third-party-licenses/texts/52412d7bc7ce4157ea62--LICENSE) |
| `react-refresh` | `0.18.0` | MIT | declared non-dev | [source](https://github.com/facebook/react) · [text 1](third-party-licenses/texts/da6d3703ed11cbe42bd2--LICENSE) |
| `readable-stream` | `2.3.8` | MIT | declared non-dev | [source](https://github.com/nodejs/readable-stream) · [text 1](third-party-licenses/texts/ec62dc96da0099b87f45--LICENSE) |
| `readdirp` | `5.1.1` | MIT | declared non-dev | [source](https://github.com/paulmillr/readdirp) · [text 1](third-party-licenses/texts/dffec71d93f273d2af7b--LICENSE) |
| `redent` | `3.0.0` | MIT | dev/build | [source](https://github.com/sindresorhus/redent) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `require-directory` | `2.1.1` | MIT | declared non-dev | [source](https://github.com/troygoode/node-require-directory) · [text 1](third-party-licenses/texts/a92e52eb1fa7cd746e38--LICENSE) |
| `require-from-string` | `2.0.2` | MIT | dev/build | [source](https://github.com/floatdrop/require-from-string) · [text 1](third-party-licenses/texts/6ee0feb1f6ef996ff5a6--license) |
| `rollup` | `4.62.4` | MIT | declared non-dev | [source](https://github.com/rollup/rollup) · [text 1](third-party-licenses/texts/fa1bd040c5bdeefe65b3--LICENSE.md) |
| `safe-buffer` | `5.1.2` | MIT | declared non-dev | [source](https://github.com/feross/safe-buffer) · [text 1](third-party-licenses/texts/c7cc929b57080f4b9d0c--LICENSE) |
| `saxes` | `6.0.0` | ISC | dev/build | [source](https://github.com/lddubeau/saxes) · [text 1](third-party-licenses/texts/0fac2374380621b22e6b--saxes-6.0.0-LICENSE) |
| `scheduler` | `0.27.0` | MIT | declared non-dev | [source](https://github.com/facebook/react) · [text 1](third-party-licenses/texts/da6d3703ed11cbe42bd2--LICENSE) |
| `scule` | `1.3.0` | MIT | declared non-dev | [source](https://github.com/unjs/scule) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `semver` | `6.3.1` | ISC | declared non-dev | [source](https://github.com/npm/node-semver) · [text 1](third-party-licenses/texts/4ec3d4c66cd87f5c8d8a--LICENSE) |
| `setimmediate` | `1.0.5` | MIT | declared non-dev | [source](https://github.com/YuzuJS/setImmediate) · [text 1](third-party-licenses/texts/c4b4ad3a5746f1f5249a--LICENSE.txt) |
| `siginfo` | `2.0.0` | ISC | dev/build | [source](https://github.com/emilbayes/siginfo) · [text 1](third-party-licenses/texts/3bdddf0b9b08aaa2fe43--LICENSE) |
| `source-map` | `0.7.6` | BSD-3-Clause | declared non-dev | [source](http://github.com/mozilla/source-map) · [text 1](third-party-licenses/texts/6cb0631f71c7749763fd--LICENSE) |
| `source-map-js` | `1.2.2` | BSD-3-Clause | declared non-dev | [source](https://github.com/7rulnik/source-map-js) · [text 1](third-party-licenses/texts/6cb0631f71c7749763fd--LICENSE) |
| `stackback` | `0.0.2` | MIT | dev/build | [source](https://github.com/shtylman/node-stackback) · full text unresolved |
| `std-env` | `4.2.0` | MIT | dev/build | [source](https://github.com/unjs/std-env) · [text 1](third-party-licenses/texts/a6f36438e46fb911859f--LICENCE) |
| `string-width` | `4.2.3` | MIT | declared non-dev | [source](https://github.com/sindresorhus/string-width) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `string_decoder` | `1.1.1` | MIT | declared non-dev | [source](https://github.com/nodejs/string_decoder) · [text 1](third-party-licenses/texts/11f2aafb37d06b3ee5bd--LICENSE) |
| `strip-ansi` | `6.0.1` | MIT | declared non-dev | [source](https://github.com/chalk/strip-ansi) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `strip-indent` | `3.0.0` | MIT | dev/build | [source](https://github.com/sindresorhus/strip-indent) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `strip-literal` | `4.0.0` | MIT | declared non-dev | [source](https://github.com/antfu/strip-literal) · [text 1](third-party-licenses/texts/af32efdd008a371c77b1--LICENSE) |
| `js-tokens` | `10.0.0` | MIT | declared non-dev | [source](https://github.com/lydell/js-tokens) · [text 1](third-party-licenses/texts/3b07ef3fdd96c7f4025d--LICENSE) |
| `superlock` | `1.3.5` | MIT | declared non-dev | [source](https://github.com/Kikobeats/superlock) · [text 1](third-party-licenses/texts/d0e1fbdaae1c5620073d--LICENSE.md) |
| `symbol-tree` | `3.2.4` | MIT | dev/build | [source](https://github.com/jsdom/js-symbol-tree) · [text 1](third-party-licenses/texts/9ea1eccdabe469767a9e--LICENSE) |
| `tasuku` | `2.3.0` | MIT | declared non-dev | [source](https://github.com/privatenumber/tasuku) · [text 1](third-party-licenses/texts/10c904a49af44409b073--LICENSE) |
| `tiny-open` | `1.3.0` | MIT | declared non-dev | [source](https://github.com/fabiospampinato/tiny-open) · [text 1](third-party-licenses/texts/73aa368a81b1d3f96285--license) |
| `tinybench` | `2.9.0` | MIT | dev/build | [source](https://github.com/tinylibs/tinybench) · [text 1](third-party-licenses/texts/cebc084d54e6dd99e532--LICENSE) |
| `tinyexec` | `1.3.0` | MIT | declared non-dev | [source](https://github.com/tinylibs/tinyexec) · [text 1](third-party-licenses/texts/f95f668fe64081ddb415--LICENSE) |
| `tinyglobby` | `0.2.17` | MIT | declared non-dev | [source](https://github.com/SuperchupuDev/tinyglobby) · [text 1](third-party-licenses/texts/22c68811e174cbbfb381--LICENSE) |
| `tinyrainbow` | `3.2.0` | MIT | dev/build | [source](https://github.com/tinylibs/tinyrainbow) · [text 1](third-party-licenses/texts/cebc084d54e6dd99e532--LICENCE) |
| `tldts` | `7.4.10` | MIT | dev/build | [npm](https://www.npmjs.com/package/tldts) · [text 1](third-party-licenses/texts/c64182d48160db948b6a--LICENSE) |
| `tldts-core` | `7.4.10` | MIT | dev/build | [npm](https://www.npmjs.com/package/tldts-core) · [text 1](third-party-licenses/texts/c64182d48160db948b6a--LICENSE) |
| `tough-cookie` | `6.0.2` | BSD-3-Clause | dev/build | [source](https://github.com/salesforce/tough-cookie) · [text 1](third-party-licenses/texts/22ec6791c91ba42c0516--LICENSE) |
| `tr46` | `6.0.0` | MIT | dev/build | [source](https://github.com/jsdom/tr46) · [text 1](third-party-licenses/texts/499d6d466d064e046042--LICENSE.md) |
| `typescript` | `7.0.2` | Apache-2.0 | declared non-dev | [source](https://github.com/microsoft/TypeScript) · [text 1](third-party-licenses/texts/a7d00bfd54525bc694b6--LICENSE), [text 2](third-party-licenses/texts/f5c708b59114507b8b27--NOTICE.txt) |
| `ufo` | `1.6.4` | MIT | declared non-dev | [source](https://github.com/unjs/ufo) · [text 1](third-party-licenses/texts/46231df5a7733c3f52f1--LICENSE) |
| `uhyphen` | `0.2.0` | ISC | declared non-dev | [source](https://github.com/WebReflection/uhyphen) · [text 1](third-party-licenses/texts/2b0748436e16684ec912--LICENSE) |
| `undici` | `8.11.2` | MIT | dev/build | [source](https://github.com/nodejs/undici) · [text 1](third-party-licenses/texts/a6db8096b2707bc0102d--LICENSE) |
| `undici-types` | `7.18.2` | MIT | declared non-dev | [source](https://github.com/nodejs/undici) · [text 1](third-party-licenses/texts/a6db8096b2707bc0102d--LICENSE) |
| `unimport` | `6.4.0` | MIT | declared non-dev | [source](https://github.com/unjs/unimport) · [text 1](third-party-licenses/texts/5af3c68995307360b313--LICENSE) |
| `magic-string` | `1.1.0` | MIT | declared non-dev | [source](https://github.com/Rich-Harris/magic-string) · [text 1](third-party-licenses/texts/1cbe51b907662f6cb149--LICENSE) |
| `unplugin` | `3.3.0` | MIT | declared non-dev | [source](https://github.com/unjs/unplugin) · [text 1](third-party-licenses/texts/2ef2cbeeb84d5e7a92d2--LICENSE) |
| `unplugin-utils` | `0.3.2` | MIT | declared non-dev | [source](https://github.com/sxzz/unplugin-utils) · [text 1](third-party-licenses/texts/fdb4c7395791e3ba534b--LICENSE) |
| `update-browserslist-db` | `1.2.3` | MIT | declared non-dev | [source](https://github.com/browserslist/update-db) · [text 1](third-party-licenses/texts/c414dde36704bd9c8a76--LICENSE) |
| `util-deprecate` | `1.0.2` | MIT | declared non-dev | [source](https://github.com/TooTallNate/util-deprecate) · [text 1](third-party-licenses/texts/0154425673db15cdfa80--LICENSE) |
| `vite` | `7.3.6` | MIT | declared non-dev | [source](https://github.com/vitejs/vite) · [text 1](third-party-licenses/texts/a77a1c089806b39ad339--LICENSE.md) |
| `vitest` | `4.1.11` | MIT | dev/build | [source](https://github.com/vitest-dev/vitest) · [text 1](third-party-licenses/texts/881d660c26831481b697--LICENSE.md) |
| `w3c-xmlserializer` | `5.0.0` | MIT | dev/build | [source](https://github.com/jsdom/w3c-xmlserializer) · [text 1](third-party-licenses/texts/ab654de803cdaa9e2819--LICENSE.md) |
| `webidl-conversions` | `8.0.1` | BSD-2-Clause | dev/build | [source](https://github.com/jsdom/webidl-conversions) · [text 1](third-party-licenses/texts/a889cc4dbee2ae172c17--LICENSE.md) |
| `webpack-virtual-modules` | `0.6.2` | MIT | declared non-dev | [source](https://github.com/sysgears/webpack-virtual-modules) · [text 1](third-party-licenses/texts/aa523c5b0d9c02231b38--LICENSE) |
| `whatwg-mimetype` | `5.0.0` | MIT | dev/build | [source](https://github.com/jsdom/whatwg-mimetype) · [text 1](third-party-licenses/texts/528eec83cb836a0adda9--LICENSE.txt) |
| `whatwg-url` | `17.1.0` | MIT | dev/build | [source](https://github.com/jsdom/whatwg-url) · [text 1](third-party-licenses/texts/db480f236292a093e77a--LICENSE.txt) |
| `why-is-node-running` | `2.3.0` | MIT | dev/build | [source](https://github.com/mafintosh/why-is-node-running) · [text 1](third-party-licenses/texts/6a134e51aa31496c15a7--LICENSE) |
| `wrap-ansi` | `7.0.0` | MIT | declared non-dev | [source](https://github.com/chalk/wrap-ansi) · [text 1](third-party-licenses/texts/5c932d88256b4ab958f6--license) |
| `ansi-styles` | `4.3.0` | MIT | declared non-dev | [source](https://github.com/chalk/ansi-styles) · [text 1](third-party-licenses/texts/48da2f39e100d4085767--license) |
| `wxt` | `0.21.3` | MIT | declared non-dev | [source](https://github.com/wxt-dev/wxt) · [text 1](third-party-licenses/texts/7b0b00fcdbc6a036078a--wxt-0.21.3-LICENSE) |
| `xml-name-validator` | `5.0.0` | Apache-2.0 | dev/build | [source](https://github.com/jsdom/xml-name-validator) · [text 1](third-party-licenses/texts/a6cba85bc92e0cff7a45--LICENSE.txt) |
| `xmlchars` | `2.2.0` | MIT | dev/build | [source](https://github.com/lddubeau/xmlchars) · [text 1](third-party-licenses/texts/45d196313c2647d313cc--LICENSE) |
| `y18n` | `5.0.8` | ISC | declared non-dev | [source](https://github.com/yargs/y18n) · [text 1](third-party-licenses/texts/2034cce3b6fafcddd642--LICENSE) |
| `yallist` | `3.1.1` | ISC | declared non-dev | [source](https://github.com/isaacs/yallist) · [text 1](third-party-licenses/texts/4ec3d4c66cd87f5c8d8a--LICENSE) |
| `yargs` | `17.7.3` | MIT | declared non-dev | [source](https://github.com/yargs/yargs) · [text 1](third-party-licenses/texts/2f1a503bfab84b3ba739--LICENSE) |
| `yargs-parser` | `21.1.1` | ISC | declared non-dev | [source](https://github.com/yargs/yargs-parser) · [text 1](third-party-licenses/texts/365496ca1f56da40b23c--LICENSE.txt) |

</details>

## Build outputs

WXT’s `build:done` hook copies the collected legal documents to `legal/` for Chrome and Firefox builds, including the extension ZIP produced by `wxt zip`. Preserve that directory with the artifact. The inventory conservatively includes build-tool notices too; inclusion is not a claim that every listed package is shipped. DOMPurify uses its Apache-2.0 alternative and JSZip its MIT alternative.

`stackback@0.0.2` and `@napi-rs/lzma-linux-x64-gnu@1.5.1` declare MIT in their npm metadata, but their pinned upstream sources supply no full grant text. They run in the build/test toolchain and are excluded from extension code and source bundles as installed dependencies. This is not a license pack for redistributing those tool binaries. The manifest records the verified revisions and this remaining upstream documentation limitation.
