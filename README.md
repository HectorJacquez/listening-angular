# Listening (Angular demo)

A small Angular 22 app over my own music server's data. It shows my recent
plays and my most played artists, and each artist page adds a bio, facts,
artwork and 30-second previews from public APIs. You can also search for any
artist and build a mixtape whose share link carries the whole list in the URL.

I put it together to get my head around Angular after a conversation about a
Java + Angular team.

Live copy: https://hectorjacquez.github.io/listening-angular/

## What is in it

It uses standalone components and signals throughout, with lazy routes and the
route parameter bound straight to a component input. The recent plays table
filters and sorts off two signals and one `computed()`. The mixtape page is a
reactive form on top of a small signal store (`PlaylistStore`) that the other
pages add tracks to.

The live data comes from three public APIs that need no key: MusicBrainz for
facts, Wikipedia (through Wikidata) for the bio and photo, and the iTunes Search
API for artwork and previews. Each one loads on its own, so if one is down the
rest of the page still shows. Requests to each API go through a queue that
spaces them out, because MusicBrainz asks for one a second and iTunes starts
refusing after about twenty a minute.

Search debounces typing and uses `switchMap`, so a slow answer to an old query
does not replace a newer one.

There are 60 tests (Vitest and TestBed). CI runs them on every push and deploys
`main` to GitHub Pages.

## Data

`public/snapshot.json` is a static copy of my listening history, made by
`scripts/snapshot.py` on my server from Navidrome's play log and library. It
holds titles, artists, albums, play counts and timestamps. It covers my top 60
artists plus anyone in the last few hundred plays, and leaves out explicit
titles since the file is public. The script reads what to leave out from
`scripts/snapshot-filters.json`, which is not in the repo;
`snapshot-filters.example.json` shows the shape.

## Run

```bash
pnpm install
pnpm exec ng serve        # http://localhost:4200
pnpm exec ng test
pnpm run format           # Prettier, checked in CI
```
