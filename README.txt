KidTech Learning Hub
====================

A free, browser-based learning app for kids ages 3 to 8+. It has 80+ small
games that start with ABCs, counting and shapes and climb all the way up to
real coding, Linux, networking and cybersecurity concepts.

It is a Progressive Web App (PWA): it can be installed on a tablet or phone
like a normal app, works offline after the first visit, and is built to run
fullscreen in a "kiosk" style so a child stays inside the app.


WHAT'S INSIDE
-------------
  Age 3  Tiny Explorers   letters, numbers, shapes, tap-and-play toys
  Age 4  Growing Minds    keyboard, phonics, early math, sorting, patterns
  Age 5  Junior Techies   math, reading, first terminal, simple physics,
                          binary counting
  Age 6  Skill Builders   typing, ciphers, logic gates, binary, code blocks
  Age 7  Foundations      step-by-step classes: Linux, Python, HTML, SQL,
                          regex, binary, ciphers
  Age 8+ Junior Hackers   Python, HTML/CSS/JS, SQL, Git, regex, networking,
                          firewalls, passwords, phishing awareness,
                          encryption, CTF puzzles, AI bias

Other features:
  - Built-in "Help" overlay explaining every screen and game
  - "Lesson" pop-ups for the older age groups
  - Split-screen mode (two games side by side) for ages 6-8
  - A simple parent gate (a math question) for the youngest ages
  - Sound effects generated in the browser (no audio files)


PRIVACY
-------
  - No accounts, no logins, no ads, no analytics, no tracking.
  - No backend and no database. Nothing a child types leaves the device.
  - The only outside requests are for the React and Babel libraries, which
    are loaded from the unpkg.com CDN on first load (then cached offline).


HOW IT WORKS
------------
There is no build step. The browser loads React and Babel from a CDN, and
Babel turns app.jsx into JavaScript right in the browser.

  index.html          The page. Loads React + Babel and registers the
                      service worker.
  app.jsx             The whole app: every game, the menus and navigation.
  manifest.json       PWA settings (name, icons, fullscreen).
  service-worker.js   Offline caching.
  _htaccess           Optional Apache config (HTTPS redirect, MIME types,
                      caching). Rename to ".htaccess" on an Apache/LiteSpeed
                      server to use it.
  icons/              App icons.
  kid/                Optional helper: a redirect page for a lowercase
                      "/kid/" URL. Not needed for the app itself.


RUN IT ON YOUR COMPUTER
-----------------------
Opening index.html by double-clicking will NOT work (browsers block loading
app.jsx from a file:// address). Serve the folder with any small local web
server instead, for example:

  Python:   python -m http.server 8000
  Node:     npx serve .

Then open http://localhost:8000 in your browser.


PUT IT ON THE WEB
-----------------
Any static web host works (shared hosting, GitHub Pages, Netlify, etc.).
No PHP, Node or database is needed.

  1. Upload all the files above into a folder on your host.
  2. Make sure the site uses HTTPS (needed for install + offline mode).
  3. Check folder permissions: folders 755, files 644. If you see a plain
     "Index of /..." file list instead of the app, the folder is probably
     set too strict (for example 700).
  4. If you deploy by cloning this repo onto the server, make sure the
     .git folder is NOT reachable from the web (see SECURITY below).

After changing any file, bump CACHE_VERSION in service-worker.js so
returning visitors get the new version.


ADD YOUR OWN GAME
-----------------
  1. Write a component in app.jsx:   function MyGame({ onBack }) { ... }
  2. Register it in GAME_MAP:        mygame: MyGame,
  3. Add a tile in GAMES_BY_AGE:     { id: "mygame", e: "🎯", t: "My Game",
                                       d: "Short blurb!" },
  4. Add a one-line how-to in HOWTO.
  5. Bump CACHE_VERSION in service-worker.js.

Quiz-style content (CTF puzzles, regex challenges, phishing examples, etc.)
lives in plain arrays near the top of app.jsx and is easy to extend.


ABOUT "KIOSK MODE"
------------------
The app goes fullscreen and blocks common browser shortcuts, but a web page
can never block the device's Home button, app switcher or Windows key. To
truly lock a device to this app, use the operating system's own feature:

  iPad / iPhone   Settings > Accessibility > Guided Access
  Android         Settings > Security > Screen Pinning (App Pinning)
  Desktop         chrome --kiosk --app=https://your-site/


SECURITY
--------
This project has no server code, no passwords and no API keys. If you fork
it, please keep it that way: never commit secrets, and if you deploy with
git, block web access to the .git folder.


LICENSE
-------
No license has been chosen yet. Until a LICENSE file is added, please ask
before reusing this code in your own project.
