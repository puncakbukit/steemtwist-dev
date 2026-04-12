# SteemTwist
**Steem with a Twist** — a decentralised microblogging dApp built on the Steem blockchain.

Posts are permanent and censorship-resistant. No backend, no build tools, no server — just four static files.

> **Implementation snapshot:** this README reflects the current codebase as of **April 2026**.

---

## The Twister Community

A SteemTwist user is called a **Twister** 🌀

Just as a blog writer is a *blogger* and a YouTube creator is a *YouTuber*, every person who posts, replies, loves, and connects on SteemTwist is a **Twister**. Twisters spin ideas into twists, connect with other Twisters, and keep the stream alive.

---

## Vocabulary

| Concept | SteemTwist term | Icon |
|---|---|---|
| SteemTwist user | **Twister** | 🌀 |
| Monthly root post | Feed root / Secret root | — |
| Comment reply | **Twist** | 🌀 |
| Reply to a twist | **Thread Reply** | 💬 |
| Upvote | **Twist Love** | ❤️ |
| Downvote / flag | **Flag** | 🚩 |
| Resteem | **Retwist** | 🔁 |
| Personalised timeline | **Home** | 🏠 |
| Global timeline | **Explore** | 🔭 |
| Interactive JS twist | **Live Twist** | ⚡ |
| Notifications | **Signals** | 🔔 |
| Encrypted private message | **Secret Twist** | 🔒 |
| Private inbox | **Private Signals** | 🔒 |

---

## Data model

```
@steemtwist/feed-2026-03               ← monthly feed root
├── @alice/tw-20260315-091530-alice     ← twist
├── @bob/tw-20260315-102244-bob         ← twist (Live Twist)
│   ├── @alice/tw-20260315-150012-alice ← thread reply
│   └── @carol/tw-20260315-160000-carol ← flag reply (type: live_twist_flag)
└── ...

@steemtwist/secret-2026-03             ← monthly secret root
├── @alice/st-20260315-091530-alice     ← Secret Twist to @bob
│   └── @bob/st-20260315-110000-bob    ← encrypted reply
└── ...
```

**Permlink formats:** `tw-YYYYMMDD-HHMMSS-username` (twist / flag reply), `st-YYYYMMDD-HHMMSS-username` (secret)
**Monthly roots:** `feed-YYYY-MM`, `secret-YYYY-MM`

---

## Features

### Feed & navigation
- 🏠 **Home** — personalised stream of twists from Twisters you follow; Understream and Firehose supported
- 🔭 **Explore** — global Twist Stream; sort New / Hot / Top; Firehose real-time stream; Understream toggle
- 🌊 **Understream** — toggle between Twist Stream and full Steem data on Home, Explore, Profile, and Signals
- 🔥 **Trending Now** — probabilistic real-time trend detector surfacing the top 10 words across all loaded content; present on every page (see [Trending Detection](#trending-detection-) below)

### Twists
- 📝 **Post twists** up to 280 characters (**media excluded**) with **markdown** and real-time **Write / Preview** tab
- 📷 **Image upload** for twists/replies/secret twists via Steemit ImageHoster (signed with Keychain posting key); max **4 media items** per post/reply
- 💾 **Draft autosave** — twist, live twist, and secret twist composers persist local drafts in `localStorage`
- 💬 **Thread replies** — recursive; auto-expanded two levels deep; Write / Preview on reply box
- ✏️ **Edit** — re-broadcast with updated body; card updates instantly
- 🗑️ **Delete** — true `delete_comment` (no votes/children) or body-blank fallback; removed from feed instantly
- ❤️ **Twist Love** — upvote any twist or reply
- 🔁 **Retwist** — resteem
- 📌 **Pin** — pin one twist to the top of your profile
- 🔀 **Sort** — New / Hot / Top
- 🔥 **Firehose** — live stream; Home Firehose filters to followed Twisters only

### Live Twists ⚡
- Write JavaScript that runs in an **isolated iframe sandbox** when viewers click ▶ Run
- Full **Live Twist Editor** with Code tab, ▶ Preview tab (WYSIWYG, auto-resizing), and Templates gallery
- **Templates gallery** — 40 ready-to-use examples across four categories: Simple (interactive widgets), Greetings (animated cards), Queries (read-only blockchain data), and Actions (Keychain operations)
- **Edit** published Live Twists with the inline Live Twist editor (Card label, Body, Code fields)
- **Blockchain queries** — call read-only Steem API methods from inside the sandbox via `app.query()` or the Promise-based `app.ask()`
- **Blockchain actions** — trigger Keychain-signed operations (vote, reply, follow, transfer, etc.) via `app.action()`, each requiring explicit user confirmation via an in-page modal
- **Flag system** — users can downvote and flag a Live Twist as harmful; reason is selected from a fixed list and stored on-chain as a reply
- Security: `sandbox="allow-scripts"` only (no same-origin), network blocked, Keychain unreachable from sandbox, DOMPurify sanitisation on every `app.render()` using a shared config applied identically in both viewer and composer preview, 10 KB code size limit, user-initiated execution only

### Social
- 👤 **Rich profiles** — avatar, reputation (1–100), bio, location, website (https only), join date, stats grid
- 👥 **Social pages** — paginated Followers / Following / Friends; Follow / Unfollow button per row
- 👤 **Follow / Unfollow** from the Social page using Steem's `follow` plugin

### Signals & privacy
- 🔔 **Signals** — Twist Love, Replies, Mentions, Follows, Retwists, Secret Twists; All / Unread tabs
- 🔒 **Secret Twists** — end-to-end encrypted; unlimited length; nested encrypted replies; markdown; Write / Preview; only recipient can reply

---

## Trending Detection 🔥

SteemTwist includes a **client-side streaming trend detector** that runs entirely in the browser against whatever content is currently loaded — no external API, no server-side index. It answers the question *"what is being talked about right now, on this page, in this moment?"*

### How it works

For every word that appears in the loaded posts or signals, the detector maintains two counters:

| Counter | Meaning |
|---|---|
| `count` | Lifetime occurrences — the word's historical baseline |
| `recent` | Time-decayed occurrences — how much the word has appeared *lately* |

The **trend score** is:

```
score = recent / (count + 1)
```

This ratio is high when a word is appearing frequently right now but is not yet overwhelmingly common historically — exactly the shape of a genuine trend. A word that has always been frequent scores low regardless of volume; a brand-new word that bursts suddenly scores high.

### Time decay

`recent` is multiplied by a **decay factor of 0.85** on each decay tick, so older occurrences fade automatically without any explicit expiry logic:

```
recent = recent × 0.85
```

Decay is applied in two ways depending on the data source:

- **Batch loads** (initial feed, older months/pages): one decay tick is applied per batch before ingesting, so loading a large historical archive does not artificially inflate recent scores.
- **Firehose** (live stream, Home and Explore only): a repeating timer fires every **8 seconds** while the Firehose is active. This continuously drains words that stop appearing, ensuring the trending list stays current even when no new posts arrive.

### What gets ingested where

| Page | Data source | Ingest method | Firehose decay timer |
|---|---|---|---|
| **Explore** | Post bodies | `ingestPosts` on load + each older page; `ingestPost` per live post | ✅ 8-second tick |
| **Home** | Post bodies from followed Twisters | `ingestPosts` on load + each older month; `ingestPost` per live post | ✅ 8-second tick |
| **Profile** | Post bodies for the viewed user | `ingestPosts` on load + each older page | — |
| **Signals** | Signal body text + actor usernames | `ingestSignals` on load + each older page | — |

On the Signals page, actor usernames are weighted as trend terms too — so a user who is generating many signals (e.g. replying actively) will surface in that page's trend list.

The detector is **reset on every full feed reload** so trends always reflect the currently loaded content, not a stale mix of old and new data.

### Noise filtering

Before a word enters the detector it is passed through `_tokenize()`, which:

1. Strips the SteemTwist back-link footer (`Posted via [SteemTwist]…`)
2. Removes HTML tags
3. Removes URLs (`http://`, `https://`, `www.`)
4. Removes Markdown image/link syntax
5. Removes Markdown symbols (`#`, `*`, `_`, `` ` ``, `~`, `>`, `|`, brackets)
6. Lower-cases and splits on whitespace and hyphens
7. Drops any token shorter than 3 characters
8. Filters against `TREND_STOPWORDS` — a set of 100+ English stopwords plus Steem-specific boilerplate terms (`posted`, `via`, `steemtwist`, `steemit`, `steem`, `http`, `https`, `www`, `com`, etc.) and common Markdown/HTML artefacts

### Deduplication

Each post permlink is tracked in a `_seenPermlinks` Set so the same post body is never counted twice, even if it appears in multiple batch loads or arrives via both a batch load and the Firehose.

### Widget

The **Trending Now** widget (`TrendingWidgetComponent`) is embedded at the top of the feed on every page:

- **Collapsible** — click the header to show/hide; Profile and Signals pages start collapsed by default to keep the feed prominent
- **Relative bar chart** — 10 bars with widths normalised to the top scorer; colours cycle blue → purple → pink across rank 1–10 using `hsl()` computed values matching the app's brand gradient
- **Score badge** — each bar shows a 0–100 normalised score; hovering reveals the raw `score`, `recent`, and `count` values in a tooltip
- **Source label** — the widget header shows the active context, e.g. `Explore · Firehose`, `Home · Understream · Firehose`, `@alice`, `Signals`
- **Animated transitions** — bar widths animate at 0.4 s ease so the chart visually flows as new content arrives

### `TrendDetector` API (`blockchain.js`)

```js
const td = new TrendDetector({ decay: 0.85, minLen: 3 });

td.ingestPosts(posts);          // batch of post objects; applies one decay tick
td.ingestPost(post);            // single post from Firehose; no decay tick
td.ingestSignals(signals);      // batch of signal objects; applies one decay tick
td.decay();                     // standalone decay tick (called by the timer)
td.getTrends(10);               // → [{ word, score, count, recent }, …] top N
td.reset();                     // clear all state (call on feed reload)
```

---

## Client-side cache key schema

SteemTwist uses browser `localStorage` for lightweight client cache/state. Username-scoped keys use a normalized username (`trim` + lowercase + `[a-z0-9-.]` only) to avoid duplicate logical keys.

| Key pattern | Purpose | TTL / lifecycle |
|---|---|---|
| `steem_user` | Last logged-in username used by the app | Persisted until logout |
| `steemtwist_understream_<username>` | Per-user Understream ON/OFF preference | Persisted until changed |
| `steemtwist_understream` | Understream preference for the logged-out state (legacy fallback) | Persisted until changed |
| `steemtwist_signals_read_<username>` | Signals read markers (`{ v, items: [{ id, ts }] }`) | 180-day TTL per item, capped to 2000 IDs |
| `steemtwist_pending_pin_<username>` | Pending pin/unpin optimistic cache (`{ author, permlink, ts }`) | 5-minute TTL |
| `st_draft_<username>_<draftKey>` | Draft cache for composers/replies/edits | 30-day TTL, periodic GC |
| `st_draft_<draftKey>` | Legacy unscoped draft key (migrated on read) | Migrated to scoped key, then removed |

**Note:** The Understream preference is now scoped per user so that different accounts on the same browser keep independent preferences. The unscoped `steemtwist_understream` key is still read/written for the logged-out state. On login the app reads the scoped key for the newly signed-in account; on logout it reverts to the unscoped key.

Debugging cache behavior can be enabled with:

```js
window.STEEMTWIST_CACHE_DEBUG = true;
```

---

## Live Twists ⚡

### On-chain format

```json
{
  "type": "live_twist",
  "version": 1,
  "title": "Click Counter",
  "code": "let n=0; function draw(){ app.render('<button id=b>Clicks: '+n+'</button>'); document.getElementById('b').onclick=()=>{n++;draw();}; } draw();"
}
```

Stored in `json_metadata`. The `body` field of the Steem comment is shown on non-SteemTwist clients (Steemit etc.) — defaults to `"⚡ Live Twist — view on SteemTwist"`.

### Sandbox API

| Method | Description |
|---|---|
| `app.render(html)` | Sanitise and set `body` innerHTML; automatically resizes the iframe to fit the new content |
| `app.text(str)` | Set `body` as plain text (max 2000 chars) |
| `app.resize(px)` | Manually resize the iframe height (40–600 px) |
| `app.log(...args)` | Append a line to the built-in console panel |
| `app.query(type, params)` | Call a read-only Steem API method; result delivered via `app.onResult()` |
| `app.ask(type, params)` | Like `app.query()` but returns a **Promise** that resolves with the result. Safe to use concurrently — each call is correlated by a unique request ID so parallel queries never collide. Example: `const data = await app.ask("getTicker", {})` |
| `app.action(type, params)` | Request a Keychain-signed blockchain operation; shows an in-page confirmation modal with clearly labelled, HTML-escaped fields before reaching Keychain; result delivered via `app.onResult()` |
| `app.onResult(callback)` | Register `callback(success, data)` to receive results from `app.query()` and `app.action()` calls. Each call replaces any previously registered callback — only one listener is active at a time. For concurrent queries use `app.ask()` instead |

> **Auto-resize:** `app.render()` fires an automatic resize postMessage after every call so the iframe always grows to show the full output. This means query templates that update their UI after receiving results will resize correctly without any manual `app.resize()` call.

> **Concurrent queries:** Use `app.ask()` when firing multiple queries in parallel. `app.onResult()` uses a single shared callback slot; calling it more than once replaces the previous listener, so only the last registration receives results. `app.ask()` attaches a per-request listener keyed to a unique ID, so `Promise.all([app.ask("getTicker",{}), app.ask("getDynamicGlobalProperties",{})])` works correctly.

#### Supported `app.query()` / `app.ask()` types

Read-only Steem API calls. Pass parameters as a plain object matching the steem-js argument names. All `limit` parameters are capped to a maximum of 100; all string parameters are capped to 256 characters to prevent oversized RPC payloads.

**Discussions:** `getDiscussionsByCreated`, `getDiscussionsByTrending30`, `getDiscussionsByActive`, `getDiscussionsByHot`, `getDiscussionsByVotes`, `getDiscussionsByChildren`, `getDiscussionsByCashout`, `getDiscussionsByPayout`, `getDiscussionsByFeed`, `getDiscussionsByBlog`, `getDiscussionsByComments`, `getDiscussionsByPromoted`, `getCommentDiscussionsByPayout`, `getPostDiscussionsByPayout`, `getDiscussionsByAuthorBeforeDate`

**Content:** `getContent`, `getContentReplies`, `getRepliesByLastUpdate`, `getRebloggedBy`

**Accounts:** `getAccounts`, `getAccountHistory`, `getAccountReferences`, `getAccountBandwidth`, `getAccountVotes`, `getAccountCount`, `getAccountReputations`, `lookupAccountNames`, `lookupAccounts`, `getConversionRequests`, `getOwnerHistory`, `getRecoveryRequest`, `findChangeRecoveryAccountRequests`

**Follow:** `getFollowers`, `getFollowing`, `getFollowCount`, `getWithdrawRoutes`

**Blog:** `getBlog`, `getBlogAuthors`, `getBlogEntries`, `getFeedEntries`

**Chain globals:** `getConfig`, `getDynamicGlobalProperties`, `getChainProperties`, `getFeedHistory`, `getCurrentMedianHistoryPrice`, `getTicker`, `getTradeHistory`, `getVolume`, `getVersion`, `getHardforkVersion`, `getNextScheduledHardfork`, `getRewardFund`, `getVestingDelegations`

**Blocks:** `getBlockHeader`, `getBlock`, `getOpsInBlock`

**Market:** `getOrderBook`, `getMarketOrderBook`, `getOpenOrders`, `getLiquidityQueue`, `getMarketHistoryBuckets`, `getRecentTrades`, `getSavingsWithdrawFrom`, `getSavingsWithdrawTo`

**Witnesses:** `getWitnesses`, `getWitnessByAccount`, `getWitnessesByVote`, `lookupWitnessAccounts`, `getWitnessCount`, `getActiveWitnesses`, `getWitnessSchedule`, `getMinerQueue`, `getApiByName`

**Authority:** `getTransactionHex`, `getTransaction`, `getRequiredSignatures`, `getPotentialSignatures`, `verifyAuthority`, `verifyAccountAuthority`, `getTagsUsedByAuthor`, `getActiveVotes`

**Categories:** `getTrendingCategories`, `getBestCategories`, `getActiveCategories`, `getRecentCategories`

**Formatter / utils:** `amount`, `vestingSteem`, `numberWithCommas`, `estimateAccountValue`, `createSuggestedPassword`, `commentPermlink`, `reputation`, `vestToSteem`, `validateAccountName`, `camelCase`

#### Supported `app.action()` types

Each action opens an in-page confirmation modal showing clearly labelled, HTML-escaped fields for every parameter before handing off to Keychain. All parameters are validated and sanitised before the Keychain call is made.

| Action | Key parameters | Validation |
|---|---|---|
| `vote` | `author`, `permlink`, `weight` (-10000 to 10000) | `author` validated as Steem username; `weight` clamped to ±10000 |
| `reply` | `parentAuthor`, `parentPermlink`, `message` | `message` capped to 2000 chars |
| `retwist` | `author`, `permlink` | `author` validated as Steem username |
| `follow` | `following` | validated as Steem username |
| `unfollow` | `following` | validated as Steem username |
| `transfer` | `to`, `amount`, `memo`, `currency` | `to` validated as username; `amount` must be a plain non-negative decimal; `currency` must be `"STEEM"` or `"SBD"`; `memo` capped to 2048 chars |
| `delegate` | `delegatee`, `amount`, `unit` | `delegatee` validated as username; `amount` plain decimal; `unit` must be `"SP"` or `"VEST"` |
| `voteWitness` | `witness`, `vote` (true/false) | `witness` validated as username |
| `powerUp` | `to`, `amount` | `to` validated as username; `amount` plain decimal |
| `powerDown` | `amount` | `amount` plain decimal |

### Templates gallery

The Live Twist composer includes a built-in gallery of 40 templates organised into four tabs. Selecting a template always replaces the current Title, Body, and Code fields.

| Tab | Count | Contents |
|---|---|---|
| **Simple** | 10 | Poll, Quiz, Clicker, Calculator, Chart, Expandable, Story, Demo, Explorer, Prototype |
| **Greetings** | 10 | Birthday, New Year, Congratulations, Wedding, Graduation, Eid, Christmas, Thank You, Get Well, Anniversary |
| **Queries** | 10 | Account Info, Trending Tags, STEEM Price, Hot Posts, Follower Count, Top Witnesses, Chain Stats, Post Viewer, Order Book, Reward Pool |
| **Actions** | 10 | Vote on a Post, Reply to a Post, Follow/Unfollow Account, Transfer STEEM/SBD, Delegate SP, Power Up, Vote for Witness, Retwist, Query then Vote, Query then Follow |

The **Preview** tab in the composer runs the current code in a live sandbox. The preview iframe auto-resizes to show all output — including results that arrive asynchronously after blockchain queries resolve — and resets to a minimal height each time a new preview is started.

### Security layers

1. `<iframe sandbox="allow-scripts">` — isolated null origin, no same-origin access, no form submission, no top navigation
2. Network blocked: `fetch`, `XMLHttpRequest`, `WebSocket`, `window.open` all throw inside the sandbox
3. DOMPurify sanitises every `app.render()` call using `LIVE_TWIST_PURIFY_CONFIG` — a single shared config constant applied identically in both the viewer iframe and the composer preview iframe. Allowed tags include standard layout, text, table, form input, and media elements. Forbidden tags: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<frame>`. Forbidden attributes: all inline event handlers (`onclick`, `onerror`, `onload`, `onmouseover`, `onfocus`, `onblur`, `onchange`, `onsubmit`). Data attributes are also forbidden.
4. 10 KB code size limit enforced before publish and before ▶ Run
5. User must click ▶ Run — never auto-executed on page load
6. Keychain is never accessible from inside the sandbox. All `app.action()` calls route through the parent page, which validates and sanitises every parameter, presents an in-page confirmation modal with clearly labelled HTML-escaped values, and only calls Keychain after the user explicitly approves
7. `postMessage` from sandbox to parent uses the hardcoded `PARENT_ORIGIN` constant (`https://puncakbukit.github.io`). The parent validates `e.origin === "null"` on every inbound message and additionally checks `e.source === iframe.contentWindow` before dispatching to any handler
8. `postMessage` replies from parent back to the sandbox use target origin `"*"`. This is required by the HTML spec: sandboxed iframes have an opaque origin and the string `"null"` is not a valid postMessage target for opaque origins — messages sent with `"null"` as the target are silently discarded by the browser. The security boundary is enforced on the inbound side (`e.origin === "null"` guard), not by restricting the outbound target
9. All `app.query()` / `app.ask()` parameters are sanitised before reaching `steem.api`: string values capped to 256 chars, limit values clamped to 1–100, integers coerced with safe fallbacks, array inputs validated with `Array.isArray` and sliced to 10 entries
10. All `app.action()` parameters are validated before the confirmation modal is shown: usernames checked against `/^[a-z0-9\-.]{3,16}$/`, amounts checked against `/^\d+(\.\d+)?$/`, currency and unit checked against explicit allowlists

### Minimum test code

```js
app.render("<b style='color:#c084fc'>Hello from Live Twist!</b> " + new Date().toLocaleTimeString());
```

### Concurrent query example

```js
// Two queries in parallel using app.ask() — no callback collision
(async () => {
  const [ticker, props] = await Promise.all([
    app.ask("getTicker", {}),
    app.ask("getDynamicGlobalProperties", {})
  ]);
  app.render(
    "<b>STEEM:</b> $" + parseFloat(ticker.latest).toFixed(4) + "<br>" +
    "<b>Block:</b> #" + props.head_block_number
  );
})();
```

### Security note on `</script>`

The `sandboxDoc` string (generated inside a JS template literal loaded as `<script src>`) must never contain the literal sequence `</script>`, which the HTML tokeniser would misinterpret before JS execution. The closing sandbox tag uses the template expression `${'<'}/script>` and regexes are constructed with `new RegExp(...)` to avoid this.

---

## Live Twist flag system 🚩

Users can flag a Live Twist they believe is harmful. Flagging is only available on Live Twists authored by others — you cannot flag your own Live Twist.

### How it works

1. The viewer clicks 🚩 on a Live Twist card to open the flag panel.
2. They select one reason from the fixed list below.
3. Clicking **Confirm flag** triggers two sequential Keychain operations:
   - A `-10000` weight downvote on the Live Twist (via `requestVote`).
   - A reply comment posted under the Live Twist (via `requestBroadcast`) whose `json_metadata` records the reason and whose `body` provides a human-readable description for non-SteemTwist clients.
4. The 🚩 button turns red and shows the cumulative downvote count.

### Flag reasons

| ID | Label | Emoji | Description |
|---|---|---|---|
| `session_hijacking` | Session Hijacking | 🍪 | Uses `document.cookie` to steal session IDs and impersonate the user. |
| `web_skimming` | Web Skimming / Formjacking | 💳 | Intercepts credit card numbers and passwords at form submission and sends them to an attacker's server. |
| `storage_theft` | Storage Theft | 🗄️ | Reads authentication tokens and personal settings from `localStorage` or `sessionStorage`. |
| `dom_xss` | DOM-type XSS | 💉 | Uses URL parameters or other DOM inputs to dynamically execute malicious scripts in the browser. |
| `phishing_form` | Phishing Form Insertion | 🎣 | Injects a fake login form (e.g. "Please verify your identity") into a legitimate page to steal credentials. |
| `ui_redressing` | UI Redressing | 🪄 | Overlays transparent layers or repositions buttons to trick users into clicking ads or malware links. |
| `cryptojacking` | Cryptojacking | ⛏️ | Silently mines cryptocurrency in the background while the page is open, consuming the device's CPU. |
| `browser_fingerprinting` | Browser Fingerprinting | 🔍 | Collects fonts, plugins, and screen resolution via JavaScript to identify and track users without cookies. |
| `sensor_abuse` | Sensor / Location Abuse | 📍 | Uses deceptive permission prompts to gain unauthorised access to location, camera, or other device sensors. |
| `logic_tampering` | Client-Side Logic Tampering | 🛠️ | Attempts to bypass JavaScript-based access checks (e.g. admin guards) to access restricted content. |
| `csrf` | CSRF | ↩️ | Sends unintended requests (transfers, posts) to other sites (banks, social media) while the user is logged in. |
| `other` | Other | ⚠️ | Any other harmful, deceptive, or malicious behaviour not covered by the categories above. |

### Flag reply on-chain format

```json
{
  "app": "steemtwist/0.1",
  "type": "live_twist_flag",
  "reason": "cryptojacking",
  "tags": ["steemtwist", "microblog", "steem", "twist", "social", "web"]
}
```

The flag reply is posted with `max_accepted_payout: "0.000 SBD"` and `allow_votes: false`.

### Why two separate Keychain calls

Steem Keychain's `requestBroadcast` rejects `vote` operations bundled with other op types — it validates op types against the key tier differently for broadcast versus the dedicated vote endpoint. The flag therefore uses `requestVote` for the downvote and a separate `requestBroadcast` for the reply. A downvote landing without the reply comment is harmless; a reply without the downvote cannot happen because the second call only runs on the first succeeding.

---

## Twist Stream vs Understream 🌊

| Page | Twist Stream (OFF) | Understream (ON) |
|---|---|---|
| **Home** | `fetchTwistsByUser` per followed Twister | `fetchPostsByUser` per followed Twister |
| **Explore** | `fetchTwistFeed` on monthly root | `fetchRecentPosts` — all recent Steem posts |
| **Profile** | `fetchTwistsByUser` (all historical `tw-` posts, paged) | `fetchPostsByUser` (full blog) |
| **Signals** | Only `tw-` permlinks (+ follows) | All Steem account history |

The Understream preference is stored **per user** in `localStorage` so that different accounts on the same browser are independent. The preference is re-read from the correct key on login and reverts to the unscoped fallback on logout.

---

## Secret Twists 🔒

```
Sender → requestEncodeMessage (Keychain) → broadcast to @steemtwist/secret-YYYY-MM
Recipient sees 🔒 signal → requestVerifyKey (Keychain) → message revealed
```

- **Rootless from feed** — replies to `secret-YYYY-MM`, not visible in regular feed
- **Unlimited length**, **markdown**, **Write / Preview** composer
- **Image upload support** in both compose and reply editors (shared 4-media cap)
- **Nested encrypted replies** — each decrypted individually on demand
- **One-way reply** — only the recipient (non-author) can reply

---

## Edit and Delete

**Edit (✏️)** — for regular twists: textarea with updated body. For Live Twists: inline editor with Card label, Body, and Code fields. Re-broadcasts the `comment` op; card updates immediately.

**Delete (🗑️)** — `delete_comment` if no votes/replies; body-blank (`<deleted>`) fallback otherwise. Card removed from feed instantly via `@deleted` event.

---

## Tech stack

| Layer | Technology |
|---|---|
| Blockchain | [steem-js](https://github.com/steemit/steem-js) |
| Signing & encryption | [Steem Keychain](https://github.com/steem-monsters/steem-keychain) |
| UI | [Vue 3](https://vuejs.org/) CDN + [Vue Router 4](https://router.vuejs.org/) CDN |
| Markdown | [marked.js](https://marked.js.org/) CDN |
| HTML sanitisation | [DOMPurify](https://github.com/cure53/DOMPurify) CDN |
| Hosting | GitHub Pages (static) |

---

## Project structure

```
steemtwist/
├── index.html       # HTML shell — CDN scripts with SRI hashes, CSS tokens, app mount
├── blockchain.js    # Steem API, Keychain helpers, TrendDetector class (no Vue)
├── components.js    # Vue 3 components, including TrendingWidgetComponent
└── app.js           # Views, router, root App
```

---

## `blockchain.js` reference

### RPC
- `setRPC(index)`, `callWithFallback`, `callWithFallbackAsync`

### Account
- `fetchAccount(username)` → `{ username, profileImage, displayName, about, coverImage, location, website, reputation, postCount, followerCount, followingCount, created }`
  - `profileImage` and `coverImage` are sanitised to `http://` or `https://` URLs only; anything else is returned as `""`
  - `website` is validated to `https://` only in `UserProfileComponent.safeWebsite`
  - Results are cached in-memory for 90 seconds (`ACCOUNT_CACHE_TTL`), capped to 500 entries. Concurrent calls for the same username share a single in-flight Promise (`accountInFlight` Map) so only one RPC request is dispatched regardless of how many callers are waiting.

### Posts
- `fetchPost(author, permlink)` — always returns populated `active_votes`
- `fetchReplies(author, permlink)` — direct replies (raw `getContentReplies` result)
- `fetchAllReplies(author, permlink)` — recursively fetches all nested replies and enriches each with `getContent`
- `fetchRecentPosts(limit)` — all recent Steem posts, no tag filter (Explore Understream)
- `fetchPostsByTag(tag, limit)` — by tag (`getDiscussionsByCreated`)
- `fetchPostsByUser(username, limit, cursor)` — full blog with cursor paging (Profile / Home Understream)

### SteemTwist feed
- `TWIST_CONFIG` — `ROOT_ACCOUNT`, `ROOT_PREFIX`, `SECRET_ROOT_PREFIX`, `TAG`, `POST_PREFIX`, `TAGS`, `DAPP_URL`
- `getMonthlyRoot()` → `feed-YYYY-MM` · `getSecretMonthlyRoot()` → `secret-YYYY-MM`
- `generateTwistPermlink(username)` → `tw-YYYYMMDD-HHMMSS-username`
- `generateSecretTwistPermlink(username)` → `st-YYYYMMDD-HHMMSS-username`
- `fetchTwistFeed(monthlyRoot)` — `getContentReplies` + parallel `fetchPost` enrichment; automatically includes the previous month during the first 3 days of a new month (rollover grace period)
- `fetchTwistFeedPage(root)` — one older monthly root page, newest-first
- `fetchTwistsByUser(username, monthlyRoot, { startFrom, limit, maxScan })` — account-history scan for `tw-` posts with optional cursor paging and scan cap; when `monthlyRoot` is `null`, returns twists across all months
- `buildZeroPayoutOps(...)` — `[comment, comment_options]` with payouts disabled
- `postTwist(username, message, callback)` — post new twist
- `uploadImageToSteemit(username, file, callback)` — uploads image bytes to Steemit ImageHoster after Keychain signing
- `postTwistReply(username, message, parentAuthor, parentPermlink, callback)`
- `postLiveTwist(username, title, body, code, callback)` — post Live Twist; stores `{ type:"live_twist", version:1, title, code }` in `json_metadata`
- `voteTwist(voter, author, permlink, weight, callback)` — weight 1–10000 (upvote); use `flagLiveTwist` for downvotes
- `retwistPost(username, author, permlink, callback)`
- `followUser(follower, following, callback)` — `custom_json` follow plugin `what:["blog"]`
- `unfollowUser(follower, following, callback)` — `what:[]`
- `editTwist(username, post, newBody, callback)` — re-broadcast `comment` op
- `deleteTwist(username, post, callback)` — `delete_comment` or body-blank fallback; `res._deleted` indicates path

### Live Twist flag
- `LIVE_TWIST_FLAG_REASONS` — array of `{ id, label, emoji, desc }` objects; the authoritative reason list shared by both `blockchain.js` and the UI. The `desc` field is shown as a tooltip when hovering a reason chip in the flag panel.
- `flagLiveTwist(voter, author, permlink, reasonId, callback)` — step 1: `requestVote` at weight `-10000`; step 2 on success: `requestBroadcast` with `[comment, comment_options]` whose `json_metadata.type === "live_twist_flag"` and `json_metadata.reason === reasonId`

### Sorting, Firehose, Pin
- `sortTwists(posts, mode)` — new / hot / top
- `startFirehose(monthlyRoot, onTwist, onVote, options)` — options: `{ understream, followingSet }`; Understream mode streams root posts instead of monthly-root replies
- `pinTwist / unpinTwist / fetchPinnedTwist` — on-chain pin via `custom_json`
- `setPinCache / clearPinCache / getPinCache` — localStorage cache with 5-minute TTL; `getPinCache` validates `author` against `/^[a-z0-9\-.]{3,16}$/` and `permlink` against `/^[a-z0-9-]{1,255}$/` before returning; the pending-unpin entry is cleared automatically once the chain confirms the pin is gone

### Signals
- `classifySignalEntry(seqNum, item, username)` → `love | reply | mention | follow | retwist | secret_twist`
- `fetchSignals(username, startFrom)` — scans up to 1000 history entries per call with cursor-based paging
- `stripSignalBody(body)` — caps input at 10 000 chars before regex processing to prevent ReDoS; truncates output to 100 chars

### Follow lists
- `fetchFollowersPage(username, startFrom, limit)` → `{ users, nextCursor, hasMore }` — single page
- `fetchFollowingPage(username, startFrom, limit)` → single page
- `fetchFollowers(username)` → full list (used for Friends)
- `fetchFollowing(username)` → full list

### Secret Twists
- `sendSecretTwist(sender, recipient, message, callback)` — encrypt + broadcast to secret monthly root
- `replySecretTwist(sender, recipient, message, parentAuthor, parentPermlink, callback)`
- `decryptSecretTwist(recipient, sender, encodedPayload, callback)` — `requestVerifyKey("Memo")`
- `fetchSecretTwists(username)` — `getContentReplies` on secret root, filtered to `meta.type === "secret_twist"`

### Trend Detector
- `TREND_STOPWORDS` — `Set<string>` of 100+ English stopwords and Steem/Markdown boilerplate terms excluded from trend analysis
- `TrendDetector({ decay, minLen })` — class; `decay` defaults to `0.85`, `minLen` to `3`
  - `ingestPosts(posts[])` — tokenise each post body; apply one decay tick for the batch
  - `ingestPost(post)` — tokenise a single post (Firehose); no decay tick
  - `ingestSignals(signals[])` — tokenise signal bodies + actor usernames; apply one decay tick
  - `decay()` — multiply every word's `recent` counter by the decay factor
  - `getTrends(n)` → `[{ word, score, count, recent }]` — top N by score, excluding words with `recent < 0.01`
  - `reset()` — clear all word counters and the seen-permlinks dedup Set

---

## `components.js` reference

### Architecture notes

`LIVE_TWIST_PURIFY_CONFIG` is a single JSON-serialised constant defined once and embedded into both the viewer `sandboxDoc` and the composer `buildSandboxDoc`. This guarantees identical DOMPurify sanitisation rules in both contexts.

`handleQueryRequest` and `handleActionRequest` are defined once in `LIVE_TWIST_HANDLER_MIXIN` and spread into both `LiveTwistComponent` and `LiveTwistComposerComponent`. This ensures query/action behaviour is identical between the live viewer and the composer preview. The reply postMessage always targets the already-validated `iframeSource` captured synchronously at event-receive time, rather than re-reading `$refs` asynchronously, to avoid stale-closure drops when Vue recycles the iframe element between the query being sent and the RPC returning.

| Component | Description |
|---|---|
| `AppNotificationComponent` | Toast; auto-dismiss 3.5 s for non-errors |
| `AuthComponent` | Keychain login / logout |
| `UserProfileComponent` | Profile card: avatar, reputation badge, bio, meta row, stats grid; website validated to https only |
| `LoadingSpinnerComponent` | Animated spinner |
| `ReplyCardComponent` | Reply: Love / Retwist / Reply / Edit / Delete; Write/Preview on reply box |
| `ThreadComponent` | Lazy-loads replies; enriches `active_votes` |
| `LiveTwistComponent` | Renders a Live Twist card: ▶ Run / ■ Stop, sandboxed iframe (`ref="sandbox"`), blockchain query/action bridge via `LIVE_TWIST_HANDLER_MIXIN`, security notice |
| `TwistCardComponent` | Full twist card: action bar (Love, Retwist, Replies, **Flag** for Live Twists); body; Edit; Delete; inline flag panel with reason selector |
| `LiveTwistComposerComponent` | Live Twist editor: Card label, Body, Code textarea, ▶ Preview sandbox (`ref="previewSandbox"`), auto-resizing preview iframe, Templates gallery (Simple / Greetings / Queries / Actions), Publish ⚡ |
| `TwistComposerComponent` | 🌀 Twist / ⚡ Live Twist tabs; Write/Preview on twist pane |
| `TrendingWidgetComponent` | 🔥 Collapsible trend bar chart: 10 bars normalised to top scorer, blue→purple→pink gradient per rank, score badge with hover tooltip, source label; `startCollapsed` prop for Profile/Signals pages |
| `SignalItemComponent` | Signal row: icon, label, preview, timestamp, View link |
| `UserRowComponent` | Twister row with optional Follow/Unfollow button |
| `SecretTwistComposerComponent` | Secret Twist composer: recipient, unlimited textarea, Write/Preview, Send 🔒 |
| `SecretTwistCardComponent` | Secret Twist card: Decrypt, Reply (non-author only), recursive nested replies |

---

## `app.js` reference

### Routes

| Route | View | Description |
|---|---|---|
| `/` | `HomeView` | Personalised feed — followed Twisters; Understream; Firehose; Trending widget |
| `/explore` | `ExploreView` | Global Twist Stream; Firehose; Understream; sort tabs; composer; Trending widget |
| `/signals` | `SignalsView` | Signals feed; All / Unread; Trending widget (collapsed by default) |
| `/secret-twists` | `SecretTwistView` | Inbox / Sent / Compose |
| `/about` | `AboutView` | README via marked.js |
| `/@:user/social` | `SocialView` | Paginated Followers / Following / Friends; Follow buttons |
| `/@:user/:permlink` | `TwistView` | Single twist; parent context |
| `/@:user` | `ProfileView` | Profile card; twist list; Trending widget (collapsed by default) |

### Global provided state

| Key | Type | Notes |
|---|---|---|
| `username` | `ref<string>` | Persisted in `localStorage` |
| `hasKeychain` | `ref<boolean>` | Detected on mount via polling |
| `notify` | `function(msg, type)` | type: `"error"` \| `"success"` \| `"info"` |
| `unreadSignals` | `ref<number>` | Recomputed on nav to Signals |
| `refreshUnreadSignals` | `function(user)` | Called on login and nav |
| `understreamOn` | `ref<boolean>` | Persisted per-user in `localStorage`; re-read on login/logout |
| `toggleUnderstream` | `function()` | Flips and persists `understreamOn` to the current user's scoped key |

The following are also provided globally and injected by `LiveTwistComponent` and `LiveTwistComposerComponent` so that blockchain actions work correctly in both the live viewer and the composer preview:

`voteTwist`, `postTwistReply`, `retwistPost`, `followUser`, `unfollowUser`

### Trend detection per view

Each feed view owns a private `TrendDetector` instance (`_trendDetector`) created in `created()` and kept non-reactive (prefixed `_`) to avoid Vue observation overhead on the internal Maps. The reactive output is a plain `trends` array updated by calling `_refreshTrends()` after every ingest or decay tick.

| View | `_trendDetector` lifecycle | Decay timer |
|---|---|---|
| `ExploreView` | Created in `created()`; `reset()` on `loadFeed()` | Started in `startFirehose()`; stopped in `stopFirehose()` and `unmounted()` |
| `HomeView` | Created in `created()`; `reset()` on `loadFeed()` | Started in `startFirehose()`; stopped in `stopFirehose()` and `unmounted()` |
| `ProfileView` | Created in `created()`; `reset()` on `loadProfile()` | None |
| `SignalsView` | Created in `created()` | None |

### Signals read state

`SignalsView` stores the set of read signal IDs as a reactive `data` field (`readIds: new Set()`) rather than recomputing it from `localStorage` on every render. It is initialised once in `created()` via `readSignalIdSet(username)` and rebuilt (new Set reference) whenever `markAllRead()` is called, triggering Vue's change detection without touching `localStorage` again.

---

## Security

### Supply chain
All CDN scripts (`steem-js`, `vue`, `vue-router`, `marked`, `DOMPurify`) load with `integrity` (SRI) and `crossorigin="anonymous"` attributes. A tampered CDN file will be rejected by the browser before execution.

### Content
- All user-supplied markdown and HTML rendered via `v-html` is passed through `DOMPurify.sanitize()` before insertion.
- Profile `coverImage` and `profileImage` URLs are validated to `http://` or `https://` only inside `fetchAccount`; `coverImage` is additionally passed through `encodeURI()` before being interpolated into a CSS `url(...)` value in the header.
- User-supplied `website` URLs are validated to `https://` only in `UserProfileComponent.safeWebsite`.

### Live Twist sandbox
- Sandboxed iframe uses `sandbox="allow-scripts"` only — null origin, no same-origin, no form submission, no top navigation.
- `fetch`, `XMLHttpRequest`, `WebSocket`, and `window.open` are all overridden to throw inside the sandbox.
- DOMPurify is loaded inside the sandbox from CDN via a `<script src>` tag in the sandbox `<head>`. The parent page's CSP includes `cdnjs.cloudflare.com` in `script-src`, and sandboxed iframes inherit the parent CSP. The sanitisation config is defined once in `LIVE_TWIST_PURIFY_CONFIG` and embedded into both the viewer and the composer preview sandbox so both apply identical rules.
- The parent validates `e.origin === "null"` and `e.source === iframe.contentWindow` on every inbound message before dispatching to any handler. The `iframeSource` reference is captured synchronously at event-receive time so async RPC callbacks still post to the correct window even if Vue has re-rendered the iframe element.
- Replies from the parent back to the sandbox use `postMessage(..., "*")` — required because sandboxed iframes have an opaque origin and `"null"` is not a valid postMessage target for opaque origins per the HTML spec.
- All `app.action()` parameters are validated (username regex, decimal-only amounts, currency/unit allowlists) and displayed in a styled in-page confirmation modal with HTML-escaped values before any Keychain call is made.
- All `app.query()` / `app.ask()` parameters are sanitised before reaching `steem.api`: strings capped to 256 chars, limits clamped to 1–100, integers coerced with safe fallbacks, array inputs sliced to 10 entries.

### localStorage
- The pending-pin cache (`getPinCache`) validates `author` against `/^[a-z0-9\-.]{3,16}$/` and `permlink` against `/^[a-z0-9-]{1,255}$/` before use. Tampered or injected cache values are silently discarded.
- The pending-unpin cache entry (`author: null`) is cleared automatically once `fetchPinnedTwist` confirms that the chain no longer shows a pin, so it does not linger for the full TTL.

### Signals
- `stripSignalBody` caps its input to 10 000 characters before applying regex patterns, preventing potential ReDoS from crafted post bodies with deeply nested or unclosed HTML tags.

---

## No payouts by design

All twists broadcast with `max_accepted_payout = "0.000 SBD"`, `allow_votes = true`, `allow_curation_rewards = false`. Twist Love works as appreciation without moving money. Flag replies additionally set `allow_votes = false`.

---

## RPC fallback nodes

1. `https://api.steemit.com`
2. `https://api.justyy.com`
3. `https://steemd.steemworld.org`
4. `https://api.steem.fans`

On error the app automatically advances to the next node in the list for the remainder of the session.

---

## Monthly setup for `@steemtwist`

At the start of each month publish two root posts:

```
permlink: feed-2026-04       body: SteemTwist feed — April 2026
permlink: secret-2026-04     body: SteemTwist secret feed — April 2026
```

Both use `parent_permlink: steemtwist`, `title: ""`, `parent_author: ""`.

---

## Hosting on GitHub Pages

Push the four runtime files (`index.html`, `app.js`, `components.js`, `blockchain.js`), enable Pages on the `main` branch root. The hash router (`createWebHashHistory`) makes all routes work without server configuration.

---

## License

MIT
