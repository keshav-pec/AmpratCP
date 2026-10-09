# Balloon Room

A calm, personal tracker for self-paced ICPC preparation, built around Antti Laaksonen's
*Competitive Programmer's Handbook* (July 2018 draft). It is written for one person
preparing for the ICPC Asia Kanpur regional.

The plan has exactly 8 weeks ("Week 1" to "Week 8"). It has no dates, deadlines, timers or
streaks, so you move through it at your own pace. Each topic follows the same 5-step loop:
**read**, **visualize**, **code from memory**, **practice**, **revise**.

## Pages

- **Home:** overall progress (out of 215 topic steps), the 8-week balloon strip, the current
  week, the next step to work on, and links to the problem log.
- **Plan:** the 8 weeks, each with its topics, a checklist and a status (Not started,
  In progress or Done). Every week is always open.
- **Topics:** all 43 topics, numbered 1 to 43 in plan order (each also shows its handbook
  chapter). Each has a one-line focus, step chips, links to the handbook, visualizations and
  references, exact practice problems (CSES task ids and
  Codeforces problem codes, 296 in total), and personal notes. Search matches problem names
  and ids too.
- **Problem log:** problems you struggled with, what went wrong, the key idea you missed,
  and whether to revisit them. A "Mistake patterns" line counts your most common mistakes.

Three small conveniences sit in the sidebar:

- **Dark mode.** The app follows your system's light or dark setting until you press
  "Dark mode", and then remembers your choice.
- **Collapse sidebar.** On wider screens the sidebar shrinks to a narrow rail of icons.
  On phones the navigation is a top bar instead.
- **Sync devices.** Optional: keeps your progress the same on your laptop and phone through
  your own MongoDB database. See [Sync across devices](#sync-across-devices).

## The plan

The order follows how often topics decide ICPC Asia and India regionals: implementation,
greedy, binary search, DP, maths, graphs, trees and range queries come first and get the most
time. Rarer topics come later, and the ones that seldom decide a regional are marked
**Optional**, so they can wait until the core feels solid.

| Week | Theme | Topics |
| --- | --- | --- |
| 1 | Foundations | I/O, complexity, sorting and binary search (also on the answer), STL, prefix sums and difference arrays, two pointers and monotonic stack, greedy and constructive |
| 2 | Complete search and DP | Complete search and meet in the middle, DP, interval DP, digit DP, bit tricks and bitmask DP |
| 3 | Mathematics | Number theory, combinatorics, probability and expected value, game theory, XOR basis |
| 4 | Graphs | Graph basics, DFS/BFS, shortest paths, MST and union-find, toposort and DAG DP. Ends with a full mock contest |
| 5 | Trees and range queries | Fenwick and segment trees, lazy propagation, tree DP and rerooting, LCA and binary lifting, small-to-large merging |
| 6 | Strings and connectivity | Hashing, Z, trie, KMP, suffix array (optional), SCC and 2-SAT, bridges and articulation points, Euler paths. Ends with a second mock contest |
| 7 | Geometry, flows, advanced | Geometry, convex hull, flows and matchings, matrix exponentiation, Mo's algorithm; min-cost flow, HLD, centroid decomposition, CHT and FFT are optional |
| 8 | Contest mode | No new topics: full virtual regionals, one with your team, upsolving, revision and your contest routine |

Every learning week also asks you to take part in a contest or two and upsolve, and to
re-solve problems you marked to revisit. Week 1 adds writing a stress tester.

No plan suits everyone. If a week's topics already feel easy, move on; if one needs more
time, take it. There is no schedule to fall behind.

## Run it

The app is plain HTML, CSS and JavaScript with no build step. Serve the folder with any
static server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` straight from disk (`file://`)
won't work, because browsers block ES modules there.

To deploy, push the folder to GitHub Pages as it is. All paths are relative, and routing
uses the URL hash (`#/home`, `#/plan`, `#/topics`, `#/problems`), so no server
configuration is needed. Sync is the only part that needs a server, and it's optional.

## The handbook

The "Handbook: chapter C, p. N" links open the built-in reader (`book.html`) in a new tab, at
book page N. Plain PDF links (`CP_book.pdf#page=…`) are unreliable: phones and some browsers
ignore the page and open the first page or download the file. The reader shows the PDF with
[pdf.js](https://github.com/mozilla/pdf.js) (a copy is in `vendor/pdfjs/`, Apache-2.0), so it
opens on the right page everywhere, including phones. It only draws the pages near the
screen, lets you select and copy text, and has Previous, Next and a page box that uses the
page numbers printed in the book. "PDF file" in its top bar opens the original file.

Page numbers: the PDF has 10 pages of front matter, so book page N is PDF page N+10, and the
reader's address uses the PDF page (`book.html#page=35` is book page 25).

This repository already contains `CP_book.pdf`. If you copy the app somewhere else, **copy
`CP_book.pdf` into the project root** (next to `index.html`), or the reader can't open it.
The book is free to download from <https://cses.fi/book/>.

## Your data

Everything you enter is saved **in this browser first**, in `localStorage` under the key
`balloonroom:v1`. Without sync:

- A different browser, device or private window starts empty.
- Clearing site data for this page deletes your progress.
- If the stored data ever becomes unreadable, the app starts fresh and keeps the unreadable
  value under `balloonroom:v1:backup`, so it can still be recovered by hand.
- If saving fails (for example, if storage is full), the app shows a message.

With sync turned on, a copy also lives in your MongoDB database, and every connected device
works from it.

## Sync across devices

Sync is optional. The app keeps working exactly as before without it.

### How it works

- Every change is saved in the browser straight away, then sent to **your own sync server**
  a moment later. The server keeps one copy of your progress in **your MongoDB database**.
- When the app opens, or comes back into view, it fetches changes made on your other devices.
- Offline is fine: changes wait in the browser and are sent once you're back online.
- If two devices changed things at the same time, the copies are merged: changes on
  either side are kept. If both changed the very same thing, the device syncing last wins,
  except notes, where both versions are kept, and a logged problem that was edited on one
  device and deleted on the other, which is kept.
- What syncs: topic steps, notes, week checklists and the problem log. Dark mode and the
  sidebar stay per device.

A browser page can't talk to MongoDB directly, and putting the connection string in the page
would hand full access to your database to anyone who opens it. So a tiny server sits in
between: it holds the connection string in its private settings, and only answers devices
that know your **sync key**.

### Set it up on Vercel (free)

You need a MongoDB Atlas cluster (the free tier is plenty) and a Vercel account.

1. **Secure the database user.** If your connection string was ever pasted somewhere
   (a chat, an issue, a commit), change that user's password first: Atlas → *Database
   Access* → *Edit* → *Edit Password*. Better still, create a user just for this app with
   the *readWrite* role on the `balloonroom` database only, and use its connection string.
2. **Let Vercel reach the database.** Vercel has no fixed IP addresses, so in Atlas →
   *Network Access* → *Add IP Address*, choose *Allow access from anywhere* (`0.0.0.0/0`).
   Access still needs the user's password, so make it a strong one.
3. **Make a sync key**: a long random secret. Any of these works:
   ```sh
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   openssl rand -base64 24
   ```
   Save it in your password manager. You'll enter it once on each device.
4. **Deploy.** In Vercel: *Add New → Project*, import this repository, keep the framework
   preset *Other* and leave the build settings empty. Under *Environment Variables* add:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | your connection string (`mongodb+srv://…`) |
   | `SYNC_KEY` | the sync key from step 3 (at least 16 characters) |
   | `ALLOWED_ORIGINS` | only if you'll keep using the GitHub Pages copy: `https://keshav-pec.github.io` (no path) |
   | `MONGODB_DB` | optional, the database name (default `balloonroom`) |

   Then deploy. If you change a variable later, redeploy so it takes effect.
5. **Check it.** Open `https://<your-project>.vercel.app/api/state`. It should say
   `{"error":"unauthorized"}`, which means the server is running and set up.
   `{"error":"not-configured"}` means a variable is missing or the key is too short.
6. **Connect each device.** Open the app, press **Sync devices** in the sidebar (the cloud
   button at the top on phones), enter the sync key and press **Connect**.
   - Using the app at `https://<your-project>.vercel.app`? Leave *Server address* empty.
   - Using the GitHub Pages copy? Enter `https://<your-project>.vercel.app` as the server
     address, and make sure `ALLOWED_ORIGINS` is set as in step 4.

   Connecting never loses anything: if both the device and the server already have
   progress, they're merged.

The status under the sidebar buttons says whether you're synced, syncing, offline, or what
went wrong. To stop syncing on one device, open **Sync devices** and press
**Disconnect this device**. Its progress stays in that browser.

### If it says the server couldn't use the database

The connect dialog names the cause. Your Vercel project's **Logs** also show it, on a line
starting `Sync storage error (…)`.

| Cause | Fix |
| --- | --- |
| `network` | Atlas → *Network Access* → add `0.0.0.0/0` and wait until it's *Active*. Check the cluster isn't paused. |
| `auth` | The user or password in `MONGODB_URI` is wrong. Replace `<db_password>` (brackets included) with the real password, write `@ : / ? # %` in it as `%40 %3A %2F %3F %23 %25`, and update the variable after any password change. |
| `dns` | The cluster address is wrong: copy the string again from Atlas → *Connect* → *Drivers*. |
| `uri` | The value isn't a connection string. It should start with `mongodb+srv://`, with no quotes. |
| `permission` | Give the user the *readWrite* role on `balloonroom` in Atlas → *Database Access*. |
| `driver` | Redeploy from the latest code. |

After changing an environment variable in Vercel, **redeploy** (Deployments → ⋯ → Redeploy):
running deployments keep the old values.

### Keep it safe

- The connection string belongs only in Vercel's *Environment Variables* (or your server's
  settings). Never put it in the app or commit it: this repository is public.
  `.gitignore` keeps `.env` files out of git, and `.vercelignore` keeps them out of
  `vercel deploy` uploads.
- The sync key is what protects your progress on the server. Anyone with it can read and
  change your progress, and each connected browser keeps it in its storage. If it leaks,
  set a new `SYNC_KEY` in Vercel, redeploy, and enter the new key on each device (the app
  will ask).
- The server only accepts the app's own data shape, at most 1 MB per save, and stores it as
  one document (`_id: "main"`) in the `state` collection.

### Run the sync server yourself

`server/serve.js` serves the app and the sync API together, for your own machine or any Node
host (Render, Railway, Fly.io and so on). It needs Node 20.19 or newer.

```sh
npm install
MONGODB_URI='mongodb+srv://…' SYNC_KEY='your-sync-key' npm run serve
```

Then open <http://localhost:8000/>. To try sync without a database, use
`SYNC_STORE=memory` instead of `MONGODB_URI` (it forgets everything when the server stops).
In PowerShell, set variables first, for example `$env:SYNC_KEY = 'your-sync-key'`.
`PORT` changes the port, and `ALLOWED_ORIGINS` works as on Vercel.

The server only ever serves the app's own files (`index.html`, `book.html`, `styles.css`,
`CP_book.pdf`, and the scripts in `src/` and `vendor/`), never `.env`, `.git`, `node_modules` or the server code.

## Tests

Unit tests use Node's built-in test runner (Node 20 or newer). They cover the store, the
merge, the sync client (two simulated devices against the real server) and the server:

```sh
npm test
```

To also run the MongoDB tests against a local database (they create and drop their own
throwaway databases):

```sh
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
```

To check that every external link still works (including all 296 practice problems),
run this from a machine with internet access:

```sh
npm run check-links
```

## Project layout

```
index.html            page shell
book.html             the handbook reader
styles.css            all styles (olive, gold and beige design tokens)
src/main.js           router and boot
src/data.js           static content: steps, topics, weeks
src/practice.js       exact CSES and Codeforces practice problems for each topic
src/store.js          state, pure update functions, persistence, migrate()
src/sync.js           optional sync with your server (local-first, retries, merging)
src/merge.js          three-way merge used by sync
src/sync-ui.js        the Sync devices button, its status and its dialog
src/ui.js             DOM helpers (text-only rendering), inline confirm, toast, notices
src/views/*.js        home, plan, topics, problems
src/book.js           the handbook reader: opens CP_book.pdf on the right page
vendor/pdfjs/         pdf.js (legacy build, Apache-2.0), used by the reader
api/state.js          the sync API as a Vercel function
server/sync-handler.js  the sync API itself: key check, validation, conflicts
server/storage.js     MongoDB (or in-memory) storage with revision checks
server/serve.js       the app and the sync API from one Node process
tests/*.test.js       unit tests
tools/check-links.js  link checker for the external URLs
```
