# Balloon Room

A calm, personal tracker for self-paced ICPC preparation, built around Antti Laaksonen's
*Competitive Programmer's Handbook* (July 2018 draft). It is written for one person
preparing for the ICPC Asia Kanpur regional.

The plan has exactly 8 weeks ("Week 1" to "Week 8"). It has no dates, deadlines, timers or
streaks, so you move through it at your own pace. Each topic follows the same 5-step loop:
**read**, **visualize**, **code from memory**, **practice**, **revise**.

## Pages

- **Home:** overall progress (out of 185 topic steps), the 8-week balloon strip, the current
  week, the next step to work on, and links to the problem log.
- **Plan:** the 8 weeks, each with its topics, a checklist and a status (Not started,
  In progress or Done). Every week is always open.
- **Topics:** all 37 topics in plan order, with step chips, links to the handbook,
  visualizations, references and CSES practice, plus personal notes.
- **Problem log:** problems you struggled with, what went wrong, the key idea you missed,
  and whether to revisit them. A "Mistake patterns" line counts your most common mistakes.

## Run it

The app is plain HTML, CSS and JavaScript with no build step and no dependencies. Serve the
folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` straight from disk (`file://`)
won't work, because browsers block ES modules there.

To deploy, push the folder to GitHub Pages as it is. All paths are relative, and routing
uses the URL hash (`#/home`, `#/plan`, `#/topics`, `#/problems`), so no server
configuration is needed.

## The handbook PDF

The "Handbook p. N" links open `./CP_book.pdf#page=N+10` in a new tab, because the PDF has
10 pages of front matter before book page 1. This repository already contains
`CP_book.pdf`. If you copy the app somewhere else, **copy `CP_book.pdf` into the project
root** (next to `index.html`), or those links will not work. The book is free to download
from <https://cses.fi/book/>.

## Your data

Everything you enter is stored **only in this browser**, in `localStorage` under the key
`balloonroom:v1`. There is no account, no server and no sync. This means:

- A different browser, device or private window starts empty.
- Clearing site data for this page deletes your progress.
- If the stored data ever becomes unreadable, the app starts fresh and keeps the unreadable
  value under `balloonroom:v1:backup`, so it can still be recovered by hand.
- If saving fails (for example, if storage is full), the app shows a message.

## Tests

The store (state, updates, migration and persistence) has unit tests that use Node's
built-in test runner (Node 18 or newer):

```sh
node --test
```

To check that every external link still works, run this from a machine with internet
access:

```sh
node tools/check-links.js
```

## Project layout

```
index.html          page shell
styles.css          all styles (olive, gold and beige design tokens)
src/main.js         router and boot
src/data.js         static content: steps, topics, weeks
src/store.js        state, pure update functions, persistence, migrate()
src/ui.js           DOM helpers (text-only rendering), inline confirm, toast
src/views/*.js      home, plan, topics, problems
tests/store.test.js unit tests for the store
tools/check-links.js  link checker for the external URLs
```
