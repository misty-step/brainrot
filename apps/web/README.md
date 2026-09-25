# brainrot publishing house

this nextjs app is a total vibe: a reading + audio platform that merges sweet waveforms, text highlighting, chapter/timestamp sharing, and a spool of dope expansions on the horizon. behold:

**Public site (checked 2026-09-25):** `brainrotpublishing.com` and
`www.brainrotpublishing.com` did not resolve in direct `curl` probes. This
README describes the source app, not a verified live deployment.

## features

- **reading room**: pick your translation, pick your chapter, listen to synced audio. your eyeballs read as your ears feast.
- **timestamp sharing**: copy a share link that auto-seeks to a precise chapter/time. no more scrubbing or guesswork.
- **wavesurfer**: we use wavesurfer.js to visualize the audio waveform and handle playback.

## architecture

- **app/reading-room/[slug]**: main reading component. fetches your text, loads audio, manages chapters/timestamps.
- **hooks & components**: reusable building blocks to handle reading progress, theme toggles, etc.
- **digitalocean spaces**: assets use the standardized paths under the authoritative Spaces bucket.
- **env**: `.env.local` holds local settings; the repository targets App
  Platform for deployment, but no live deployment was verified.

## documentation

### translation system

- [Translation System](docs/translation-system/): comprehensive translation methodology and project documentation
  - [Guidelines](docs/translation-system/methodology/guidelines.md): 974-line maximalist gremlin mode methodology
  - [Great Gatsby Project](docs/translation-system/projects/great-gatsby/): complete project documentation including character voices and specifications

### technical documentation

- [BLOB_STORAGE.md](docs/BLOB_STORAGE.md): details about Blob storage configuration
- [BLOB_PATH_STRUCTURE.md](docs/BLOB_PATH_STRUCTURE.md): path structure for assets in Blob storage
- [ASSET_CLEANUP.md](docs/ASSET_CLEANUP.md): guide for cleaning up local assets after migration

## stack

- **nextjs** (app router) for zero-config routing & serverless endpoints.
- **react** for the core ui.
- **wavesurfer** for audio waveforms and playback.
- **digitalocean spaces**: authoritative production asset storage and delivery.
- **tailwindcss** for speed-coded styling.
- **vitest** for unit and integration testing.

## running locally

1. clone the repo
2. `pnpm install` (we use pnpm, not npm)
3. set up `.env.local`
4. `pnpm dev`
5. open localhost:3000
6. test the reading room: try reading-room/the-iliad?c=1&t=30.

## testing

from the monorepo root, use these **Vitest** scripts (the web package has a smaller script set):

```bash
# run tests in watch mode (recommended for dev)
pnpm test

# run all tests once
pnpm test:run

# generate coverage report
pnpm test:coverage

# open the vitest ui (super clean interface)
pnpm test:ui
```

### what we test

- **components**: all react components with React Testing Library
- **api routes**: download endpoints, service layers
- **hooks**: custom react hooks
- **utilities**: path helpers, validators, converters
- **security**: command injection prevention, input sanitization

### migration from jest

we migrated from jest to vitest for:

- native test runner instead of Jest configuration
- **native esm support** (no more transform headaches)
- **better typescript support** out of the box
- **hmr for tests** (instant re-runs on save)

key syntax changes if you're familiar with jest:

```javascript
// old (jest)
jest.fn() → vi.fn()
jest.mock() → vi.mock()
jest.spyOn() → vi.spyOn()
```

## scripts

### `apps/web` package scripts

run these commands from `apps/web/`; root package scripts differ:

```bash
pnpm dev         # fire up the dev server with turbopack
pnpm build       # production build with all optimizations
pnpm test        # run tests in watch mode (vitest)
pnpm lint        # currently prints a skip notice
pnpm format      # auto-format with prettier
pnpm typecheck   # typescript type checking
pnpm prettier:fix # direct prettier (alias for format)
```

### script philosophy

1. **essential only** - if it's not used weekly, it's not a script
2. **clarity over convenience** - obvious beats clever
3. **direct execution** - rare tasks use `tsx` directly:
   ```bash
   tsx scripts/some-analysis.ts  # no script needed
   ```

## vision

this is just the beginning:

- line-by-line audio sync & highlight
- buy physical copies with stripe or bitcoin
- dynamic user accounts, profiles, reading stats
- more translations

if you vibe with this or see a next-level improvement, fork it and submit a pr.
zero warranties, maximum fun. stay stoked.
