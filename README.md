# Nocturne — Graveyard Portfolio

The application source and assets are in [nocturne](nocturne/README.md).

Use Node.js 22.13 or newer:

```sh
cd nocturne
npm ci
npm run dev
```

Open the local URL printed by the server. For a production build, run `npm run build` inside `nocturne`.

Before committing changes, run `npm run lint`, `npm run typecheck`, and `npm test` from the app directory. Generated output and local browser profiles are excluded from Git.
