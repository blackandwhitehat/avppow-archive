# AVPPOW Archive

Static Cloudflare Pages port of the old Coranto Perl site from `/Users/Shared/newsbak2`.

The port keeps the preserved 2002 news, journal, and review content, but removes the runtime CGI/admin surface. Binaries, archives, PHP, upload handlers, and the one-off automation Perl script are intentionally not published.

## Build

```sh
npm run build
```

The generated site is written to `dist/`.

## Cloudflare Pages

Use:

- Build command: `npm run build`
- Output directory: `dist`

