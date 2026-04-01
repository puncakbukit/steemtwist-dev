// ============================================================
// blockchain.js
// Steem blockchain interactions — pure async helpers.
// No Vue, no DOM dependencies.
// ============================================================

// ---- RPC nodes & fallback ----

const RPC_NODES = [
  "https://api.steemit.com",
  "https://api.justyy.com",
  "https://steemd.steemworld.org",
  "https://api.steem.fans"
];

let currentRPCIndex = 0;

function setRPC(index) {
  currentRPCIndex = index;
  steem.api.setOptions({
    url: RPC_NODES[index]
  });
  console.log("Switched RPC to:", RPC_NODES[index]);
}

// Safe API wrapper with automatic RPC fallback on error.
function callWithFallback(apiCall, args, callback, attempt = 0) {
  apiCall(...args, (err, result) => {
    if (!err) return callback(null, result);
    console.warn("RPC error on", RPC_NODES[currentRPCIndex], err);
    const nextIndex = currentRPCIndex + 1;
    if (nextIndex >= RPC_NODES.length) return callback(err, null);
    setRPC(nextIndex);
    callWithFallback(apiCall, args, callback, attempt + 1);
  });
}

// Promise wrapper around callWithFallback.
function callWithFallbackAsync(apiCall, args) {
  return new Promise((resolve, reject) => {
    callWithFallback(apiCall, args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ---- Account helpers ----

// Fetch a single Steem account and extract its profile metadata.
// Returns null if the account does not exist or the request fails.
function fetchAccount(username) {
  return new Promise(resolve => {
    if (!username) return resolve(null);
    steem.api.getAccounts([username], (err, result) => {
      if (err || !result || !result.length) return resolve(null);
      const account = result[0];
      let profile = {};
      try {
        profile = JSON.parse(
          account.posting_json_metadata || account.json_metadata
        ).profile || {};
      } catch {}

      // Steem reputation is a raw int — convert to the familiar 1-100 scale
      // using the same formula Steemit uses.
      function calcReputation(raw) {
        if (!raw || raw === 0) return 25;
        const neg = raw < 0;
        let r = Math.log10(Math.abs(raw));
        r = Math.max(r - 9, 0);
        r = (neg ? -1 : 1) * r;
        r = r * 9 + 25;
        return Math.floor(r);
      }

      // Sanitize image URLs from profile metadata so neither profileImage
      // nor coverImage can carry javascript: URIs or CSS-injection payloads.
      // Only http/https URLs are accepted; anything else is silently dropped.
      function sanitizeImageUrl(url) {
        if (!url || typeof url !== "string") return "";
        try {
          const u = new URL(url);
          return (u.protocol === "https:" || u.protocol === "http:") ? url : "";
        } catch { return ""; }
      }

      // Fetch follower/following counts in parallel with account data
      steem.api.getFollowCount(account.name, (fcErr, fc) => {
        resolve({
          username:       account.name,
          profileImage:   sanitizeImageUrl(profile.profile_image),
          displayName:    profile.name || account.name,
          about:          profile.about || "",
          coverImage:     sanitizeImageUrl(profile.cover_image),
          location:       profile.location || "",
          website:        profile.website || "",
          reputation:     calcReputation(parseInt(account.reputation || 0)),
          postCount:      account.post_count || 0,
          followerCount:  (fc && !fcErr) ? (fc.follower_count  || 0) : null,
          followingCount: (fc && !fcErr) ? (fc.following_count || 0) : null,
          created:        account.created || ""
        });
      });
    });
  });
}

// ---- Post / comment helpers ----

// Fetch a single post by author + permlink.
function fetchPost(author, permlink) {
  return callWithFallbackAsync(steem.api.getContent, [author, permlink]);
}

// Fetch direct replies to a post.
function fetchReplies(author, permlink) {
  return callWithFallbackAsync(steem.api.getContentReplies, [author, permlink]);
}

// Recursively fetch ALL nested replies for a post.
function fetchAllReplies(author, permlink) {
  function recurse(author, permlink) {
    return callWithFallbackAsync(
      steem.api.getContentReplies,
      [author, permlink]
    ).then(replies => {
      if (!replies || replies.length === 0) return [];

      return Promise.all(
        replies.map(r =>
          recurse(r.author, r.permlink).then(children => [
            { author: r.author, permlink: r.permlink },
            ...children
          ])
        )
      ).then(results => results.flat());
    }).catch(() => []);
  }

  return recurse(author, permlink).then(collected => {
    if (collected.length === 0) return [];

    return Promise.all(
      collected.map(r =>
        callWithFallbackAsync(steem.api.getContent, [r.author, r.permlink])
          .catch(() => null)
      )
    ).then(enriched =>
      enriched.filter(Boolean)
    );
  });
}

// Fetch recent posts by tag (uses getDiscussionsByCreated).
function fetchPostsByTag(tag, limit = 20) {
  return callWithFallbackAsync(
    steem.api.getDiscussionsByCreated,
    [{
      tag,
      limit
    }]
  );
}

// Fetch the most recent posts across all of Steem (no tag filter).
// Used by ExploreView and HomeView Understream mode.
//
// cursor: { author, permlink } of the last post from the previous page,
//         or null/undefined for the first page.
// Returns Promise<{ posts: post[], nextCursor: { author, permlink } | null }>
function fetchRecentPosts(limit = 50, cursor = null) {
  const query = { tag: "", limit: limit + 1 };  // fetch one extra to detect more
  if (cursor) {
    query.start_author  = cursor.author;
    query.start_permlink = cursor.permlink;
  }
  return callWithFallbackAsync(
    steem.api.getDiscussionsByCreated,
    [query]
  ).then(posts => {
    if (!posts || posts.length === 0) return { posts: [], nextCursor: null };
    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    // When using a cursor the API repeats the start post — drop it.
    const trimmed = cursor ? page.slice(1) : page;
    const nextCursor = hasMore
      ? { author: page[page.length - 1].author, permlink: page[page.length - 1].permlink }
      : null;
    return { posts: trimmed, nextCursor };
  });
}

// Fetch recent posts from a user's blog.
// cursor: { author, permlink } for the next page, or null for first page.
// Returns Promise<{ posts: post[], nextCursor: { author, permlink } | null }>
function fetchPostsByUser(username, limit = 50, cursor = null) {
  const query = { tag: username, limit: limit + 1 };
  if (cursor) {
    query.start_author  = cursor.author;
    query.start_permlink = cursor.permlink;
  }
  return callWithFallbackAsync(
    steem.api.getDiscussionsByBlog,
    [query]
  ).then(posts => {
    if (!posts || posts.length === 0) return { posts: [], nextCursor: null };
    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    // When using a cursor the API repeats the start post — drop it.
    const trimmed = cursor ? page.slice(1) : page;
    const nextCursor = hasMore
      ? { author: page[page.length - 1].author, permlink: page[page.length - 1].permlink }
      : null;
    return { posts: trimmed, nextCursor };
  });
}

// ---- Account-history twist scanner ----

// Fetch all twists posted by a single user in the given month, using the
// account history index instead of getContentReplies on the root post.
//
// Why this is faster for profile pages:
//   getContentReplies walks the entire monthly comment tree (all authors).
//   getAccountHistory only reads one user's operation log — much smaller —
//   and we stop paging the moment we reach entries older than the month.
//
// Algorithm:
//   1. Page backwards through the user's account history in batches of 100
//      (the maximum the Steem node allows per call), starting from -1
//      (the latest entry).
//   2. Keep only "comment" ops whose permlink starts with "tw-" and whose
//      parent_permlink matches the monthly root.
//   3. Stop only when an entry's timestamp predates the month start, or when
//      the node returns an empty batch (true end of history).
//   4. Enrich the filtered raw ops with fetchPost so each object has
//      net_votes, active_votes, children, etc. — same shape as the
//      objects returned by fetchTwistFeed.
//
// Returns a Promise<post[]> sorted newest-first.
// Fetch twists posted by a user by scanning their account history.
//
// Parameters:
//   username    — Steem username to scan.
//   monthlyRoot — kept for API compatibility but no longer used as a cutoff;
//                 we now scan the full history so older months are included.
//   options     — { startFrom, limit }
//                   startFrom : sequence number to begin from (-1 = latest).
//                               Pass the cursor returned by a previous call
//                               to continue paging backward.
//                   limit     : stop after collecting this many twists
//                               (0 / undefined = no limit, scan everything).
//
// Returns Promise<{ posts: post[], nextCursor: number|null }>
//   posts      — enriched posts sorted newest-first.
//   nextCursor — sequence number for the next page, or null when exhausted.
function fetchTwistsByUser(
  username,
  monthlyRoot,
  { startFrom = -1, limit = 0, maxScan = 2000 } = {}
) {
  // 100 is the maximum limit most Steem nodes allow per call.
  const BATCH = 100;
  // Hard safety cap so one slow account can never stall Home/Profile forever.
  // HomeView may pass a smaller value for faster, bounded loading.
  const MAX_SCAN = Math.max(100, Number(maxScan) || 2000);
  const collected = [];
  let scanned = 0;
  let lastLowestSeq = null;
  let stopSeq = null;

  function page(from) {
    return new Promise((resolve) => {
      steem.api.getAccountHistory(username, from, BATCH, (err, history) => {
        if (err) {
          console.warn("[fetchTwistsByUser] error:", err);
          return resolve();
        }

        if (!history || history.length === 0) return resolve();

        for (let i = history.length - 1; i >= 0; i--) {
          const [, item] = history[i];
          const [type, data] = item.op;
          scanned++;

          if (type !== "comment") continue;
          if (data.author !== username) continue;
          if (!data.permlink.startsWith(TWIST_CONFIG.POST_PREFIX)) continue;
          // Understream OFF should only show Twist Stream posts (monthly root).
          if (monthlyRoot && data.parent_permlink !== monthlyRoot) continue;

          if (!collected.some(c => c.data.permlink === data.permlink)) {
            collected.push({ data, timestamp: steemDate(item.timestamp) });
          }

          // Stop early if a limit was requested.
          if (limit > 0 && collected.length >= limit) {
            stopSeq = history[i][0];
            return resolve();
          }
        }

        const lowestSeq = history[0][0];
        lastLowestSeq = lowestSeq;
        if (lowestSeq <= 0 || scanned >= MAX_SCAN) return resolve();

        page(lowestSeq - 1).then(resolve);
      });
    });
  }

  return page(startFrom).then(async () => {
    if (collected.length === 0) return { posts: [], nextCursor: null };

    // Enrich each raw op with a full getContent call to get vote counts,
    // children count, and all other fields TwistCardComponent expects.
    const enriched = await Promise.all(
      collected.map(({ data }) =>
        fetchPost(data.author, data.permlink).catch(() => null)
      )
    );

    const posts = enriched
      .filter(p => p && p.author)
      .sort((a, b) => steemDate(b.created) - steemDate(a.created));

    // If we stopped due to limit, continue from one entry older than where
    // we stopped inside the current history batch.
    if (stopSeq !== null) {
      return { posts, nextCursor: stopSeq > 0 ? stopSeq - 1 : null };
    }
    
    // nextCursor is null when history is exhausted (lowestSeq reached 0).
    const nextCursor = (lastLowestSeq !== null && lastLowestSeq > 0)
      ? lastLowestSeq - 1
      : null;

    return { posts, nextCursor };
  });
}

// ---- Keychain helpers ----

// Post a new root post or a comment via Steem Keychain.
//
// For a ROOT POST:
//   parentAuthor  = ""
//   parentPermlink = the main tag (e.g. "myapp")
//
// For a COMMENT:
//   parentAuthor  = author of the post/comment being replied to
//   parentPermlink = permlink of that post/comment
//
// jsonMetadata may be a plain object or a JSON string.
// tags (string[]) are merged into jsonMetadata before submission.
//
// callback signature: (response) => { response.success, response.message }
function keychainPost(
  username,
  title,
  body,
  parentPermlink,
  parentAuthor,
  jsonMetadata,
  permlink,
  tags,
  callback
) {
  const meta = typeof jsonMetadata === "string" ?
    JSON.parse(jsonMetadata) : {
      ...jsonMetadata
    };
  if (tags && tags.length) meta.tags = tags;

  steem_keychain.requestPost(
    username, title, body,
    parentPermlink, parentAuthor,
    JSON.stringify(meta),
    permlink, "",
    callback
  );
}

// Request a Keychain signature to verify account ownership (login).
// callback signature: (response) => { response.success, response.data.username }
function keychainLogin(username, callback) {
  steem_keychain.requestSignBuffer(
    username,
    "Login to Steem Vue App",
    "Posting",
    callback
  );
}

// Upload a single image to Steemit ImageHoster using a Keychain posting-key signature.
// callback receives: { success: true, url } or { success: false, error }
function uploadImageToSteemit(username, file, callback) {
  if (!username) return callback({ success: false, error: "Please sign in first." });
  if (!file) return callback({ success: false, error: "Please choose an image file." });
  if (!window.steem_keychain) return callback({ success: false, error: "Steem Keychain not installed." });
  if (!String(file.type || "").startsWith("image/")) {
    return callback({ success: false, error: "Only image files are allowed." });
  }
  if (file.size > 5 * 1024 * 1024) {
    return callback({ success: false, error: "Image too large. Max size is 5 MB." });
  }

  const challenge = "Image upload " + Date.now();
  steem_keychain.requestSignBuffer(username, challenge, "Posting", async (signRes) => {
    if (!signRes || !signRes.success || !signRes.result) {
      return callback({ success: false, error: (signRes && (signRes.error || signRes.message)) || "Signature failed." });
    }
    try {
      const formData = new FormData();
      formData.append("image", file, file.name || "image");

      const uploadUrl = "https://steemitimages.com/" + encodeURIComponent(username) + "/" + encodeURIComponent(signRes.result);
      const response  = await fetch(uploadUrl, { method: "POST", body: formData });
      const rawBody   = await response.text();
      let payload = null;
      try { payload = rawBody ? JSON.parse(rawBody) : null; } catch {}

      // Steemit ImageHoster response shape can vary by deploy/version.
      // Try common keys first, then recursively scan for the first image-like URL.
      function scanForUrl(value, depth = 0) {
        if (depth > 6 || value == null) return "";
        if (typeof value === "string") {
          const direct = value.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || "";
          if (direct) return direct;
          const schemeless = value.match(/\bsteemitimages\.com\/[^\s"'<>]+/i)?.[0] || "";
          if (schemeless) return "https://" + schemeless.replace(/^https?:\/\//i, "");
          const relativeImg = value.match(/\/[A-Za-z0-9/_\-\.]+?\.(?:png|jpe?g|gif|webp|bmp|svg)/i)?.[0] || "";
          if (relativeImg) return "https://steemitimages.com" + relativeImg;
          const md = value.match(/\((https?:\/\/[^)\s]+)\)/i)?.[1] || "";
          if (md) return md;
          const mdSchemeless = value.match(/\((steemitimages\.com\/[^)\s]+)\)/i)?.[1] || "";
          if (mdSchemeless) return "https://" + mdSchemeless;
          const mdRelative = value.match(/\((\/[^)\s]+\.(?:png|jpe?g|gif|webp|bmp|svg))\)/i)?.[1] || "";
          if (mdRelative) return "https://steemitimages.com" + mdRelative;
          return "";
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            const found = scanForUrl(item, depth + 1);
            if (found) return found;
          }
          return "";
        }
        if (typeof value === "object") {
          const preferredKeys = ["url", "secure_url", "link", "src", "href", "image", "original", "large", "medium", "small"];
          for (const key of preferredKeys) {
            if (key in value) {
              const found = scanForUrl(value[key], depth + 1);
              if (found) return found;
            }
          }
          for (const key of Object.keys(value)) {
            const found = scanForUrl(value[key], depth + 1);
            if (found) return found;
          }
        }
        return "";
      }

      function scanForError(value, depth = 0) {
        if (depth > 6 || value == null) return "";
        if (typeof value === "string") return value.trim();
        if (Array.isArray(value)) {
          for (const item of value) {
            const found = scanForError(item, depth + 1);
            if (found) return found;
          }
          return "";
        }
        if (typeof value === "object") {
          const errorKeys = ["error", "message", "msg", "detail", "details", "reason"];
          for (const key of errorKeys) {
            if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
          }
          for (const key of Object.keys(value)) {
            const found = scanForError(value[key], depth + 1);
            if (found) return found;
          }
        }
        return "";
      }

      const extractedUrl = scanForUrl(payload) || scanForUrl(rawBody);
      const extractedError = scanForError(payload);

      if (!response.ok) {
        return callback({ success: false, error: (payload && (payload.error || payload.message)) || ("Upload failed (" + response.status + ").") });
      }
      if (extractedUrl) {
        return callback({ success: true, url: extractedUrl });
      }
      if (extractedError) {
        return callback({ success: false, error: "Upload failed: " + extractedError });
      }
      return callback({ success: false, error: "Upload failed: no image URL returned by server." });
    } catch (e) {
      return callback({ success: false, error: e && e.message ? e.message : "Error uploading image." });
    }
  });
}

// ---- Utility ----

// Build a unique permlink from a title string + timestamp suffix.
// Steem permlinks: lowercase, hyphens only, max 255 chars.
function buildPermlink(title) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 241);
  return `${slug}-${Date.now()}`;
}

// Steem timestamps omit the UTC 'Z' suffix; append it to ensure correct
// Date parsing across all browsers.
function steemDate(ts) {
  if (!ts) return new Date(NaN);
  if (typeof ts === "string" && !ts.endsWith("Z")) ts += "Z";
  return new Date(ts);
}

// ============================================================
// STEEMTWIST — blockchain helpers
// ============================================================

const TWIST_CONFIG = {
  ROOT_ACCOUNT:        "steemtwist",
  ROOT_PREFIX:         "feed-",
  SECRET_ROOT_PREFIX:  "secret-",
  TAG:                 "steemtwist",
  POST_PREFIX:         "tw",
  // All tags attached to every twist. First tag is the Steem category.
  TAGS: ["steemtwist", "microblog", "steem", "twist", "social", "web"],
  // Canonical dApp URL embedded as a back-link at the end of every body.
  DAPP_URL: "https://puncakbukit.github.io/steemtwist"
};

// Returns the current monthly feed root permlink, e.g. "feed-2026-03".
window.getMonthlyRoot = function() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${TWIST_CONFIG.ROOT_PREFIX}${y}-${m}`;
}

// Returns the current monthly secret root permlink, e.g. "secret-2026-03".
// Secret Twists are posted as replies to @steemtwist/secret-YYYY-MM,
// keeping them out of the regular feed and off Steemit's post view.
window.getSecretMonthlyRoot = function() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${TWIST_CONFIG.SECRET_ROOT_PREFIX}${y}-${m}`;
}

// Returns the secret root permlink N months before the current one.
// monthsBack=0 → current month, 1 → last month, etc.
window.getSecretMonthlyRootOffset = function(monthsBack) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${TWIST_CONFIG.SECRET_ROOT_PREFIX}${y}-${m}`;
};

// Returns a deterministic, collision-free permlink for a new twist.
// Format: tw-YYYYMMDD-HHMMSS-username
function generateTwistPermlink(username) {
  const d = new Date();
  const ts =
    d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") + "-" +
    String(d.getUTCHours()).padStart(2, "0") +
    String(d.getUTCMinutes()).padStart(2, "0") +
    String(d.getUTCSeconds()).padStart(2, "0");
  return `${TWIST_CONFIG.POST_PREFIX}-${ts}-${username}`;
}

// Fetch all direct-reply twists for the given monthly root.
// First fetches the list via getContentReplies (fast), then enriches each
// post with getContent in parallel so active_votes is always populated —
// giving accurate upvote counts consistent with the twist-specific page.
// Resolves to an array sorted newest-first.
//
// extraRoots: optional array of additional monthly root permlinks to fetch
// (e.g. ["feed-2026-02", "feed-2026-01"]) so older months can be loaded
// without re-fetching roots already in memory.
//
// Month-boundary grace period: during the first ROLLOVER_GRACE_DAYS days of
// a new month the previous month's root is automatically included so users
// don't see an empty or sparse feed right after rollover.
const ROLLOVER_GRACE_DAYS = 3;
function fetchTwistFeed(monthlyRoot, extraRoots = []) {
  // Auto-append the previous month during the grace period, unless the
  // caller already included it in extraRoots.
  const prevRoot = getMonthlyRootOffset(1);
  if (
    new Date().getUTCDate() <= ROLLOVER_GRACE_DAYS &&
    !extraRoots.includes(prevRoot) &&
    prevRoot !== monthlyRoot
  ) {
    extraRoots = [prevRoot, ...extraRoots];
  }
  const allRoots = [monthlyRoot, ...extraRoots];
  return Promise.all(
    allRoots.map(root =>
      fetchReplies(TWIST_CONFIG.ROOT_ACCOUNT, root)
        .then(replies =>
          Promise.all(replies.map(r => fetchPost(r.author, r.permlink).catch(() => r)))
        )
        .catch(() => [])
    )
  ).then(arrays => {
    const seen = new Set();
    return arrays
      .flat()
      .filter(p => {
        if (!p || !p.author) return false;
        if (seen.has(p.permlink)) return false;
        seen.add(p.permlink);
        return true;
      })
      .sort((a, b) => steemDate(b.created) - steemDate(a.created));
  });
}

// Fetch one older monthly feed root, appending its posts to an existing list.
// Returns Promise<post[]> — only the newly fetched posts (caller merges them).
// root: permlink string e.g. "feed-2026-02"
function fetchTwistFeedPage(root) {
  return fetchReplies(TWIST_CONFIG.ROOT_ACCOUNT, root)
    .then(replies =>
      Promise.all(replies.map(r => fetchPost(r.author, r.permlink).catch(() => r)))
    )
    .then(enriched =>
      enriched
        .filter(p => p && p.author)
        .sort((a, b) => steemDate(b.created) - steemDate(a.created))
    )
    .catch(() => []);
}

// Return the permlink for a monthly feed root N months before the current one.
// monthsBack=0 → current month, 1 → last month, etc.
window.getMonthlyRootOffset = function(monthsBack) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${TWIST_CONFIG.ROOT_PREFIX}${y}-${m}`;
};

// Build a [comment, comment_options] operation pair with payouts disabled.
// max_accepted_payout = "0.000 SBD" prevents any monetary reward.
// allow_votes = true so likes still work as appreciation signals.
//
// A back-link to the dApp is appended to every body so other Steem interfaces
// (Steemit, Busy, etc.) show the origin. SteemTwist strips it before rendering.
function buildZeroPayoutOps(username, body, parentAuthor, parentPermlink, permlink, jsonMetadata) {
  const bodyWithLink =
    body.trimEnd() +
    `\n\n<sub>Posted via [SteemTwist](${TWIST_CONFIG.DAPP_URL})</sub>`;

  const comment = [
    "comment",
    {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author: username,
      permlink: permlink,
      title: "",
      body: bodyWithLink,
      json_metadata: JSON.stringify(jsonMetadata)
    }
  ];

  const commentOptions = [
    "comment_options",
    {
      author: username,
      permlink: permlink,
      max_accepted_payout: "0.000 SBD",
      percent_steem_dollars: 10000,
      allow_votes: true, // likes remain active
      allow_curation_rewards: false, // no curation rewards either
      extensions: []
    }
  ];

  return [comment, commentOptions];
}

// Post a new twist via Steem Keychain.
// Broadcasts comment + comment_options atomically so payouts are disabled
// from the moment of posting (cannot be changed after the fact).
// callback: (response) => { response.success, response.error }
function postTwist(username, message, callback) {
  const root = getMonthlyRoot();
  const permlink = generateTwistPermlink(username);

  const ops = buildZeroPayoutOps(
    username,
    message,
    TWIST_CONFIG.ROOT_ACCOUNT,
    root,
    permlink, {
      app: "steemtwist/0.1",
      type: "micro",
      tags: TWIST_CONFIG.TAGS
    }
  );

  steem_keychain.requestBroadcast(username, ops, "Posting", callback);
}

// Post a Live Twist — a twist whose json_metadata contains executable JS.
// The body is a plain text description shown in non-SteemTwist clients.
// callback: (response) => { response.success, response.error }
function postLiveTwist(username, title, body, code, callback) {
  const root     = getMonthlyRoot();
  const permlink = generateTwistPermlink(username);

  const ops = buildZeroPayoutOps(
    username,
    body || "⚡ Live Twist — view on SteemTwist",
    TWIST_CONFIG.ROOT_ACCOUNT,
    root,
    permlink,
    {
      app:     "steemtwist/0.1",
      type:    "live_twist",
      version: 1,
      title:   title || "Live Twist",
      code
    }
  );

  steem_keychain.requestBroadcast(username, ops, "Posting", callback);
}

// Post a reply to an existing twist via Steem Keychain.
// Also broadcasts with zero payout for consistency.
function postTwistReply(username, message, parentAuthor, parentPermlink, callback) {
  const replyPermlink = generateTwistPermlink(username);

  const ops = buildZeroPayoutOps(
    username,
    message,
    parentAuthor,
    parentPermlink,
    replyPermlink, {
      app: "steemtwist/0.1",
      type: "micro-reply",
      tags: TWIST_CONFIG.TAGS
    }
  );

  steem_keychain.requestBroadcast(username, ops, "Posting", callback);
}

// Vote on a twist via Steem Keychain.
// weight: integer 1–10000 (100% = 10000).
function voteTwist(voter, author, permlink, weight, callback) {
  steem_keychain.requestVote(voter, permlink, author, weight, callback);
}

// ============================================================
// STEEMTWIST — Live Twist flag / downvote
// ============================================================

// Reasons a user may flag a Live Twist as harmful.
// Stored verbatim in the flag-reply's json_metadata so third-party
// tools can index them without parsing free text.
const LIVE_TWIST_FLAG_REASONS = [
  { id: "session_hijacking",      label: "Session Hijacking",           emoji: "🍪",
    desc: "Uses document.cookie to steal session IDs and impersonate the user." },
  { id: "web_skimming",           label: "Web Skimming / Formjacking",  emoji: "💳",
    desc: "Intercepts credit card numbers and passwords at form submission and sends them to an attacker\'s server." },
  { id: "storage_theft",          label: "Storage Theft",               emoji: "🗄️",
    desc: "Reads authentication tokens and personal settings from localStorage or sessionStorage." },
  { id: "dom_xss",                label: "DOM-type XSS",                emoji: "💉",
    desc: "Uses URL parameters or other DOM inputs to dynamically execute malicious scripts in the browser." },
  { id: "phishing_form",          label: "Phishing Form Insertion",     emoji: "🎣",
    desc: "Injects a fake login form (e.g. \"Please verify your identity\") into a legitimate page to steal credentials." },
  { id: "ui_redressing",          label: "UI Redressing",               emoji: "🪄",
    desc: "Overlays transparent layers or repositions buttons to trick users into clicking ads or malware links." },
  { id: "cryptojacking",          label: "Cryptojacking",               emoji: "⛏️",
    desc: "Silently mines cryptocurrency in the background while the page is open, consuming the device\'s CPU." },
  { id: "browser_fingerprinting", label: "Browser Fingerprinting",      emoji: "🔍",
    desc: "Collects fonts, plugins, and screen resolution via JavaScript to identify and track users without cookies." },
  { id: "sensor_abuse",           label: "Sensor / Location Abuse",     emoji: "📍",
    desc: "Uses deceptive permission prompts to gain unauthorised access to location, camera, or other device sensors." },
  { id: "logic_tampering",        label: "Client-Side Logic Tampering", emoji: "🛠️",
    desc: "Attempts to bypass JavaScript-based access checks (e.g. admin guards) to access restricted content." },
  { id: "csrf",                   label: "CSRF",                        emoji: "↩️",
    desc: "Sends unintended requests (transfers, posts) to other sites (banks, social media) while the user is logged in." },
  { id: "other",                  label: "Other",                       emoji: "⚠️",
    desc: "Any other harmful, deceptive, or malicious behaviour not covered by the categories above." }
];

// Flag a Live Twist with a two-step Keychain sequence:
//   Step 1 — requestVote (Posting key, weight -10000).
//             Keychain requires votes to go through requestVote; bundling a
//             vote op inside requestBroadcast triggers a "Posting key
//             incorrect" error because Keychain validates op types against
//             the key type differently for broadcast vs. the dedicated call.
//   Step 2 — requestBroadcast with [comment, comment_options] (Posting key).
//             Posts the flag-reason reply only after the downvote succeeds.
//
// The two steps are not atomic at the chain level, but this is acceptable:
// a downvote without the reply comment is a harmless extra signal; a reply
// without the downvote cannot happen because Step 2 only runs on Step 1
// success.
//
// callback: (response) => { response.success, response.error }
function flagLiveTwist(voter, author, permlink, reasonId, callback) {
  const reason = LIVE_TWIST_FLAG_REASONS.find(r => r.id === reasonId);
  if (!reason) {
    return callback({ success: false, error: "Unknown flag reason: " + reasonId });
  }

  const flagPermlink = generateTwistPermlink(voter);
  const bodyText =
    `⚑ Flagged as **${reason.label}** ${reason.emoji}` +
    `\n\nThis Live Twist has been flagged by @${voter} for: **${reason.label}**.` +
    `\n\n<sub>Posted via [SteemTwist](${TWIST_CONFIG.DAPP_URL})</sub>`;

  const replyOps = [
    ["comment", {
      parent_author:   author,
      parent_permlink: permlink,
      author:          voter,
      permlink:        flagPermlink,
      title:           "",
      body:            bodyText,
      json_metadata:   JSON.stringify({
        app:     "steemtwist/0.1",
        type:    "live_twist_flag",
        reason:  reason.id,
        tags:    TWIST_CONFIG.TAGS
      })
    }],
    ["comment_options", {
      author:               voter,
      permlink:             flagPermlink,
      max_accepted_payout:  "0.000 SBD",
      percent_steem_dollars: 10000,
      allow_votes:          false,
      allow_curation_rewards: false,
      extensions:           []
    }]
  ];

  // Step 1: downvote via the dedicated vote API
  steem_keychain.requestVote(voter, permlink, author, -10000, (voteRes) => {
    if (!voteRes.success) return callback(voteRes);

    // Step 2: post the flag-reason reply
    steem_keychain.requestBroadcast(voter, replyOps, "Posting", callback);
  });
}

// Retwist (resteem) a post via Steem Keychain.
// A resteem is a custom_json operation under the "follow" plugin.
// callback: (response) => { response.success, response.error }
function retwistPost(username, author, permlink, callback) {
  const json = JSON.stringify([
    "reblog",
    {
      account: username,
      author,
      permlink
    }
  ]);
  steem_keychain.requestCustomJson(
    username,
    "follow",
    "Posting",
    json,
    "Retwist",
    callback
  );
}

// Follow a Steem account via the "follow" plugin custom_json.
// callback: (response) => { response.success, response.error }
function followUser(follower, following, callback) {
  steem_keychain.requestCustomJson(
    follower,
    "follow",
    "Posting",
    JSON.stringify(["follow", { follower, following, what: ["blog"] }]),
    "Follow @" + following,
    callback
  );
}

// Unfollow a Steem account via the "follow" plugin custom_json.
// Passing what: [] clears the follow relationship.
// callback: (response) => { response.success, response.error }
function unfollowUser(follower, following, callback) {
  steem_keychain.requestCustomJson(
    follower,
    "follow",
    "Posting",
    JSON.stringify(["follow", { follower, following, what: [] }]),
    "Unfollow @" + following,
    callback
  );
}

// Edit a twist or reply by re-broadcasting the comment op with updated body.
// The permlink stays the same — the chain overwrites the post body.
// comment_options cannot be changed after initial post, so only comment is sent.
// callback: (response) => { response.success, response.error }
function editTwist(username, post, newBody, callback) {
  const bodyWithLink =
    newBody.trimEnd() +
    `

<sub>Posted via [SteemTwist](${TWIST_CONFIG.DAPP_URL})</sub>`;

  const op = ["comment", {
    parent_author:   post.parent_author,
    parent_permlink: post.parent_permlink,
    author:          username,
    permlink:        post.permlink,
    title:           post.title || "",
    body:            bodyWithLink,
    json_metadata:   typeof post.json_metadata === "string"
                       ? post.json_metadata
                       : JSON.stringify(post.json_metadata || {})
  }];

  steem_keychain.requestBroadcast(username, [op], "Posting", callback);
}

// Delete a twist or reply.
// Uses delete_comment if the post has no votes and no replies — this
// permanently removes it from the chain.
// If the post has activity (votes or children), falls back to blanking the
// body (the "Steemit UX illusion") since delete_comment would be rejected.
// callback: (response) => { response.success, response.error, response._deleted }
function deleteTwist(username, post, callback) {
  const hasActivity = (post.net_votes || 0) !== 0 || (post.children || 0) > 0;

  if (!hasActivity) {
    // True deletion
    const op = ["delete_comment", { author: username, permlink: post.permlink }];
    steem_keychain.requestBroadcast(username, [op], "Posting", (res) => {
      if (res.success) res._deleted = true;
      callback(res);
    });
  } else {
    // Body-blank fallback — post still exists but body is cleared
    const op = ["comment", {
      parent_author:   post.parent_author,
      parent_permlink: post.parent_permlink,
      author:          username,
      permlink:        post.permlink,
      title:           post.title || "",
      body:            "<deleted>",
      json_metadata:   typeof post.json_metadata === "string"
                         ? post.json_metadata
                         : JSON.stringify(post.json_metadata || {})
    }];
    steem_keychain.requestBroadcast(username, [op], "Posting", (res) => {
      if (res.success) res._deleted = false;  // not truly deleted, just blanked
      callback(res);
    });
  }
}

// ---- Client-side ranking ----

// Sum of positive vote percents — a Steem-Power-weighted upvote signal.
// Accounts with more SP cast higher-percent votes, so this naturally
// weights influential votes more than a simple count.
function voteWeight(post) {
  const votes = post.active_votes || [];
  return votes.reduce((sum, v) => sum + (v.percent > 0 ? v.percent : 0), 0);
}

// "Hot" score — gravity decay formula inspired by Hacker News.
// score = voteWeight / (ageHours + 2)^1.5
// Effect: newer posts need fewer votes to rank high;
//         older posts decay even with many votes.
function scoreHot(post) {
  const ageHours = (Date.now() - steemDate(post.created).getTime()) / 3_600_000;
  return voteWeight(post) / Math.pow(ageHours + 2, 1.5);
}

// "Top" score — pure vote weight, no time decay.
// Equivalent to Reddit's "Top of all time" within the monthly feed.
function scoreTop(post) {
  return voteWeight(post);
}

// "New" score — simple chronological, newest first.
function scoreNew(post) {
  return steemDate(post.created).getTime();
}

// Apply a named sort mode to an array of posts.
// Returns a new sorted array; never mutates the original.
function sortTwists(posts, mode) {
  const fn = mode === "hot" ? scoreHot :
    mode === "top" ? scoreTop :
    scoreNew;
  return [...posts].sort((a, b) => fn(b) - fn(a));
}

// Start streaming all operations from the blockchain.
// Start streaming all operations from the blockchain.
// Calls onTwist(post) whenever a new top-level SteemTwist post is detected.
// Calls onVote(author, permlink, voter, percent) whenever a vote lands on
// any post — HomeView uses this to update active_votes in-memory so the
// ranking computed property re-sorts without a full reload.
// Returns a stop() function — call it to cancel the stream.
// Start the blockchain operation stream.
// options.understream (bool) — when true, streams new root posts from any
//   author (parent_author === "") instead of replies to the monthly root.
//   This matches the Understream data source (fetchRecentPosts).
// options.followingSet (Set) — when provided, only passes through posts
//   whose author is in the set (used by HomeView to filter to followed users).
function startFirehose(monthlyRoot, onTwist, onVote, options = {}) {
  const { understream = false, followingSet = null } = options;
  let active = true;

  steem.api.streamOperations((err, op) => {
    if (!active) return;
    if (err) return;

    const [type, data] = op;

    // ── Vote op: forward to caller for live ranking updates ──────────
    if (type === "vote" && typeof onVote === "function") {
      onVote(data.author, data.permlink, data.voter, data.weight);
      return;
    }

    // ── Comment op: new post ─────────────────────────────────────────
    if (type !== "comment") return;

    if (understream) {
      // Understream mode: only root posts (top-level Steem posts), any author
      if (data.parent_author !== "") return;
    } else {
      // Twist Stream mode: only replies to the SteemTwist monthly root
      if (data.parent_author !== TWIST_CONFIG.ROOT_ACCOUNT) return;
      if (data.parent_permlink !== monthlyRoot) return;
    }

    // Optional per-author filter (HomeView: followed users only)
    if (followingSet && !followingSet.has(data.author)) return;

    // Build a minimal post object so the card renders instantly.
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const post = {
      author:          data.author,
      permlink:        data.permlink,
      body:            data.body,
      parent_author:   data.parent_author,
      parent_permlink: data.parent_permlink,
      created:         now,
      net_votes:       0,
      active_votes:    [],
      children:        0,
      pending_payout_value: "0.000 SBD",
      json_metadata:   data.json_metadata || "",
      _firehose:       true
    };

    onTwist(post);

    // Enrich asynchronously once the node has indexed the operation.
    setTimeout(() => {
      if (!active) return;
      fetchPost(data.author, data.permlink).then(full => {
        if (!active || !full || !full.author) return;
        full._firehose = false;
        onTwist(full, true /* isUpdate */);
      }).catch(() => {});
    }, 4000);
  });

  return {
    stop() { active = false; }
  };
}

// ============================================================
// STEEMTWIST — Pin / Unpin helpers
// ============================================================

// Broadcast a "pin" custom_json to record which twist is pinned.
// Only the latest pin/unpin entry in account history is used,
// so this safely overwrites any previous pin.
// callback: (response) => { response.success, response.error }
function pinTwist(username, author, permlink, callback) {
  steem_keychain.requestCustomJson(
    username,
    "steemtwist",
    "Posting",
    JSON.stringify({ action: "pin", author, permlink }),
    "Pin twist",
    callback
  );
}

// Broadcast an "unpin" custom_json to clear the pinned twist.
// callback: (response) => { response.success, response.error }
function unpinTwist(username, callback) {
  steem_keychain.requestCustomJson(
    username,
    "steemtwist",
    "Posting",
    JSON.stringify({ action: "unpin" }),
    "Unpin twist",
    callback
  );
}

// localStorage key for pending pin cache.
// Stores { author, permlink, ts } for up to PIN_CACHE_TTL ms after a pin,
// so the UI stays correct during the window between broadcast and indexing.
const PIN_CACHE_KEY = "steemtwist_pending_pin";
const PIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function setPinCache(username, author, permlink) {
  try {
    localStorage.setItem(PIN_CACHE_KEY + "_" + username,
      JSON.stringify({ author, permlink, ts: Date.now() }));
  } catch {}
}

function clearPinCache(username) {
  try { localStorage.removeItem(PIN_CACHE_KEY + "_" + username); } catch {}
}

// Steem username: 3-16 chars, lowercase a-z / 0-9 / hyphens / dots.
// Permlink: 1-255 chars, lowercase a-z / 0-9 / hyphens.
const _VALID_STEEM_NAME     = /^[a-z0-9\-.]{3,16}$/;
const _VALID_STEEM_PERMLINK = /^[a-z0-9-]{1,255}$/;

function getPinCache(username) {
  try {
    const raw = localStorage.getItem(PIN_CACHE_KEY + "_" + username);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > PIN_CACHE_TTL) {
      localStorage.removeItem(PIN_CACHE_KEY + "_" + username);
      return null;
    }
    // cached.author === null signals a pending unpin — allow it through.
    // For actual pin entries, validate both fields before trusting them.
    if (cached.author !== null) {
      if (typeof cached.author   !== "string" || !_VALID_STEEM_NAME.test(cached.author))      return null;
      if (typeof cached.permlink !== "string" || !_VALID_STEEM_PERMLINK.test(cached.permlink)) return null;
    }
    return cached;
  } catch { return null; }
}

// Scan a user's account history for the latest "steemtwist" custom_json
// with action "pin" or "unpin", then return the pinned post object or null.
//
// If the chain result differs from a recent localStorage cache entry
// (written immediately on pin/unpin), the cache wins — this covers the
// window between broadcast and node indexing (typically a few seconds).
//
// Returns Promise<post|null>.
function fetchPinnedTwist(username) {
  const BATCH = 100;
  // Stop after scanning this many entries. Pin ops are always recent, so
  // 500 entries is more than enough. Without this cap, accounts with long
  // histories (thousands of votes/posts) would page forever.
  const MAX_SCAN = 500;
  let scanned = 0;

  function page(from) {
    return new Promise((resolve) => {
      steem.api.getAccountHistory(username, from, BATCH, (err, history) => {
        if (err || !history || history.length === 0) return resolve(null);

        // Walk newest-first
        for (let i = history.length - 1; i >= 0; i--) {
          const [, item] = history[i];
          const [type, data] = item.op;
          scanned++;

          if (type !== "custom_json") continue;
          if (data.id !== "steemtwist") continue;

          let payload;
          try { payload = JSON.parse(data.json); } catch { continue; }

          if (payload.action === "unpin") return resolve(null);
          if (payload.action === "pin" && payload.author && payload.permlink) {
            return resolve({ author: payload.author, permlink: payload.permlink });
          }
        }

        // Stop if we have scanned enough or reached the beginning of history
        const lowestSeq = history[0][0];
        if (lowestSeq <= 0 || scanned >= MAX_SCAN) return resolve(null);
        page(lowestSeq - 1).then(resolve);
      });
    });
  }

  return page(-1).then(chainResult => {
    // Check localStorage cache for a more recent pending pin/unpin
    const cached = getPinCache(username);

    // If cache exists, it was written after the last broadcast and the chain
    // may not have indexed it yet — prefer the cache.
    // Once the chain result matches the cache, clear the cache.
    let found = chainResult;
    if (cached) {
      if (cached.author === null) {
        // cached unpin — chain may still show old pin
        found = null;
      } else if (!chainResult || chainResult.permlink !== cached.permlink) {
        // cached pin not yet on chain — use cache
        found = { author: cached.author, permlink: cached.permlink };
      } else {
        // chain has caught up — safe to clear cache
        clearPinCache(username);
      }
    }

    if (!found) return null;
    return fetchPost(found.author, found.permlink)
      .then(post => (post && post.author ? post : null))
      .catch(() => null);
  });
}

// ============================================================
// STEEMTWIST — Signals (Notifications)
// ============================================================

// How many history entries to scan per Signals page.
// 1000 covers several months for most accounts. The SignalsView can call
// fetchSignals with a startFrom cursor to load even older entries on demand.
const SIGNALS_SCAN_LIMIT = 1000;

// Classify one account-history entry into a signal object, or return null
// if the entry is not a relevant notification for the given username.
//
// Signal shape:
//   {
//     id:         string   — unique key (sequence number as string)
//     type:       "love" | "reply" | "mention" | "follow" | "retwist"
//     actor:      string   — who triggered the signal
//     postAuthor: string   — author of the target post (for building the link)
//     permlink:   string   — permlink of the target post or actor's comment
//     body:       string   — short preview text where applicable
//     ts:         Date
//   }
function classifySignalEntry(seqNum, item, username) {
  const [type, data] = item.op;
  const ts = steemDate(item.timestamp);

  // ── Twist Love ───────────────────────────────────────────────────────────
  if (type === "vote") {
    if (data.author !== username) return null;         // vote on someone else's post
    if (data.voter === username)  return null;         // self-vote
    return {
      id: String(seqNum),
      type: "love",
      actor: data.voter,
      postAuthor: data.author,   // always username — the account being voted on
      permlink: data.permlink,
      body: "",
      ts
    };
  }

  // ── Thread Reply or Mention ──────────────────────────────────────────────
  if (type === "comment") {
    if (data.author === username) return null;         // own comment

    const bodyLower = (data.body || "").toLowerCase();
    const mentioned = bodyLower.includes("@" + username.toLowerCase());

    // Reply: actor replied directly to one of the user's posts/comments
    if (data.parent_author === username) {
      return {
        id: String(seqNum),
        type: mentioned ? "mention" : "reply",
        actor: data.author,
        postAuthor: data.author,   // link to the actor's comment
        permlink: data.permlink,
        body: stripSignalBody(data.body),
        ts
      };
    }

    // Mention without being the direct parent (e.g. replying in a thread)
    if (mentioned) {
      // Check for Secret Twist — upgrade signal type if metadata matches
      let meta = {};
      try { meta = JSON.parse(data.json_metadata || "{}"); } catch {}
      const isSecret = meta.type === "secret_twist" && meta.to === username;
      return {
        id: String(seqNum),
        type: isSecret ? "secret_twist" : "mention",
        actor: data.author,
        postAuthor: data.author,
        permlink: data.permlink,
        body: isSecret ? "" : stripSignalBody(data.body),
        ts
      };
    }

    return null;
  }

  // ── Follow or Retwist ────────────────────────────────────────────────────
  if (type === "custom_json") {
    let payload;
    try { payload = JSON.parse(data.json); } catch { return null; }

    // Follow uses the "follow" plugin — payload is ["follow", { ... }]
    if (data.id === "follow" && Array.isArray(payload) && payload[0] === "follow") {
      const follow = payload[1];
      if (follow.following !== username) return null;
      if (!follow.what || !follow.what.includes("blog")) return null;
      return {
        id: String(seqNum),
        type: "follow",
        actor: follow.follower,
        postAuthor: "",
        permlink: "",
        body: "",
        ts
      };
    }

    // Retwist (reblog) — payload is ["reblog", { account, author, permlink }]
    if (data.id === "follow" && Array.isArray(payload) && payload[0] === "reblog") {
      const reblog = payload[1];
      if (reblog.author !== username) return null;
      return {
        id: String(seqNum),
        type: "retwist",
        actor: reblog.account,
        postAuthor: reblog.author,   // always username — their post was retwisted
        permlink: reblog.permlink,
        body: "",
        ts
      };
    }

    return null;
  }

  return null;
}

// Strip body down to a readable one-line preview for signal rows.
function stripSignalBody(body) {
  if (!body) return "";
  // Cap input before regex to prevent ReDoS on crafted bodies with deeply
  // nested or unclosed HTML tags. 10 KB is far more than any legitimate
  // signal preview needs.
  const safe = body.slice(0, 10000);
  return safe
    .replace(/\n+<sub>Posted via \[SteemTwist\][^\n]*/i, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[#*`_~>\[\]!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

// Fetch signals for a user by scanning their account history.
// Scans up to SIGNALS_SCAN_LIMIT entries starting from startFrom and returns
// all recognised signal objects sorted newest-first, plus a cursor for the
// next page.
//
// Parameters:
//   username  — Steem username.
//   startFrom — sequence number to start scanning from (-1 = latest).
//               Pass nextCursor from a previous result to load older signals.
//
// Returns Promise<{ signals: signal[], nextCursor: number|null }>
//   signals    — sorted newest-first.
//   nextCursor — pass as startFrom to fetch the next (older) page,
//                or null when account history is fully exhausted.
function fetchSignals(username, startFrom = -1) {
  const BATCH = 100;
  const collected = [];
  let scanned = 0;
  let lastLowestSeq = null;

  function page(from) {
    return new Promise((resolve) => {
      steem.api.getAccountHistory(username, from, BATCH, (err, history) => {
        if (err || !history || history.length === 0) return resolve();

        for (let i = history.length - 1; i >= 0; i--) {
          const [seqNum, item] = history[i];
          scanned++;

          const signal = classifySignalEntry(seqNum, item, username);
          if (signal) collected.push(signal);

          if (scanned >= SIGNALS_SCAN_LIMIT) return resolve();
        }

        const lowestSeq = history[0][0];
        lastLowestSeq = lowestSeq;
        if (lowestSeq <= 0 || scanned >= SIGNALS_SCAN_LIMIT) return resolve();
        page(lowestSeq - 1).then(resolve);
      });
    });
  }

  return page(startFrom).then(() => {
    const signals = collected.sort((a, b) => b.ts - a.ts);
    // If we hit the scan limit and history is not exhausted, expose a cursor.
    const exhausted = lastLowestSeq === null || lastLowestSeq <= 0;
    const hitLimit = scanned >= SIGNALS_SCAN_LIMIT;
    const nextCursor = (!exhausted && hitLimit) ? lastLowestSeq - 1 : null;
    return { signals, nextCursor };
  });
}

// ============================================================
// STEEMTWIST — Follow helpers
// ============================================================

// Fetch ALL followers of a user by paging through getFollowers.
// Steem allows up to 1000 per call; we keep fetching until we get
// fewer than the limit, signalling the last page.
// Returns Promise<string[]> — array of follower usernames.
// Fetch one page of followers.
// Returns Promise<{ users: string[], nextCursor: string, hasMore: boolean }>
function fetchFollowersPage(username, startFrom = "", limit = 50) {
  return new Promise((resolve) => {
    steem.api.getFollowers(username, startFrom, "blog", limit, (err, result) => {
      if (err || !result || result.length === 0) {
        return resolve({ users: [], nextCursor: "", hasMore: false });
      }
      const users = result.map(r => r.follower);
      const hasMore = result.length === limit;
      const nextCursor = hasMore ? users[users.length - 1] : "";
      resolve({ users, nextCursor, hasMore });
    });
  });
}

// Fetch one page of following.
// Returns Promise<{ users: string[], nextCursor: string, hasMore: boolean }>
function fetchFollowingPage(username, startFrom = "", limit = 50) {
  return new Promise((resolve) => {
    steem.api.getFollowing(username, startFrom, "blog", limit, (err, result) => {
      if (err || !result || result.length === 0) {
        return resolve({ users: [], nextCursor: "", hasMore: false });
      }
      const users = result.map(r => r.following);
      const hasMore = result.length === limit;
      const nextCursor = hasMore ? users[users.length - 1] : "";
      resolve({ users, nextCursor, hasMore });
    });
  });
}

// Fetch ALL followers of a user (used internally for follow-count and Friends).
// Returns Promise<string[]>
function fetchFollowers(username) {
  const LIMIT = 1000;
  const collected = [];
  function page(startFrom) {
    return new Promise((resolve) => {
      steem.api.getFollowers(username, startFrom, "blog", LIMIT, (err, result) => {
        if (err || !result || result.length === 0) return resolve();
        for (const row of result) collected.push(row.follower);
        if (result.length < LIMIT) return resolve();
        page(result[result.length - 1].follower).then(resolve);
      });
    });
  }
  return page("").then(() => collected);
}

// Fetch ALL accounts a user is following.
// Returns Promise<string[]>
function fetchFollowing(username) {
  const LIMIT = 1000;
  const collected = [];
  function page(startFrom) {
    return new Promise((resolve) => {
      steem.api.getFollowing(username, startFrom, "blog", LIMIT, (err, result) => {
        if (err || !result || result.length === 0) return resolve();
        for (const row of result) collected.push(row.following);
        if (result.length < LIMIT) return resolve();
        page(result[result.length - 1].following).then(resolve);
      });
    });
  }
  return page("").then(() => collected);
}

// ============================================================
// STEEMTWIST — Secret Twist (encrypted private messages)
// ============================================================

// Secret Twists are rootless Steem posts whose encrypted payload lives
// entirely in json_metadata. The body contains only "@recipient 🔒" so
// the mention triggers the recipient's Signals feed. The payload is
// encrypted with Steem's native memo-key scheme via Keychain.
//
// json_metadata shape:
//   { type: "secret_twist", to: "bob", version: 1, payload: "#<encoded>" }
//
// Permlink prefix: "st-" (distinct from regular "tw-" twists)

const SECRET_TWIST_PREFIX  = "st-";
const SECRET_TWIST_VERSION = 1;

// Returns a deterministic permlink for a new Secret Twist.
// Format: st-YYYYMMDD-HHMMSS-username
function generateSecretTwistPermlink(username) {
  const d = new Date();
  const ts =
    d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") + "-" +
    String(d.getUTCHours()).padStart(2, "0") +
    String(d.getUTCMinutes()).padStart(2, "0") +
    String(d.getUTCSeconds()).padStart(2, "0");
  return `${SECRET_TWIST_PREFIX}${ts}-${username}`;
}

// Send a Secret Twist.
// Steps (all done client-side via Keychain):
//   1. Encrypt `message` with sender's memo key + recipient's memo public key.
//   2. Broadcast a rootless post with body "@recipient 🔒" and encrypted
//      payload in json_metadata.
//
// callback: (response) => { response.success, response.error }
function sendSecretTwist(sender, recipient, message, callback) {
  // Guard: requestEncodeMessage may not exist in older Keychain versions
  if (typeof steem_keychain.requestEncodeMessage !== "function") {
    return callback({
      success: false,
      error: "Your Steem Keychain version does not support memo encryption. Please update Keychain."
    });
  }

  // Step 1: Encrypt — requestEncodeMessage(sender, receiver, message, keyType, callback)
  steem_keychain.requestEncodeMessage(
    sender,
    recipient,
    "#" + message,   // Keychain memo encoding; message must start with #
    "Memo",
    (encRes) => {
      if (!encRes.success) return callback(encRes);

      // Keychain returns the encoded string in encRes.result or encRes.message
      // depending on the version — check both.
      const payload = encRes.result || encRes.message || "";
      console.log("[SteemTwist] encRes:", JSON.stringify(encRes));
      if (!payload || !payload.startsWith("#")) {
        return callback({
          success: false,
          error:   "Encryption produced no payload. encRes: " + JSON.stringify(encRes)
        });
      }

      const permlink = generateSecretTwistPermlink(sender);

      // Step 2: Post as a reply to @steemtwist/secret-YYYY-MM.
      // This keeps Secret Twists off Steemit's post view and out of the
      // regular feed, while still surfacing via the mention signal.
      const secretRoot = getSecretMonthlyRoot();
      const meta = JSON.stringify({
        type:    "secret_twist",
        to:      recipient,
        version: SECRET_TWIST_VERSION,
        payload
      });

      const ops = [
        ["comment", {
          parent_author:   TWIST_CONFIG.ROOT_ACCOUNT,
          parent_permlink: secretRoot,
          author:          sender,
          permlink,
          title:           "",
          body:            `@${recipient} [encrypted]`,
          json_metadata:   meta
        }],
        ["comment_options", {
          author:               sender,
          permlink,
          max_accepted_payout:  "0.000 SBD",
          percent_steem_dollars: 10000,
          allow_votes:          true,
          allow_curation_rewards: false,
          extensions:           []
        }]
      ];

      steem_keychain.requestBroadcast(sender, ops, "Posting", callback);
    }
  );
}

// Reply to an existing Secret Twist with an encrypted message.
// The reply is posted as a Steem nested comment under the original post,
// encrypted to the other party in the conversation.
// callback: (response) => { response.success, response.error }
function replySecretTwist(sender, recipient, message, parentAuthor, parentPermlink, callback) {
  if (typeof steem_keychain.requestEncodeMessage !== "function") {
    return callback({
      success: false,
      error: "Your Steem Keychain version does not support memo encryption. Please update Keychain."
    });
  }

  steem_keychain.requestEncodeMessage(
    sender,
    recipient,
    "#" + message,
    "Memo",
    (encRes) => {
      if (!encRes.success) return callback(encRes);

      const payload  = encRes.result || encRes.message || "";
      if (!payload || !payload.startsWith("#")) {
        return callback({ success: false, error: "Encryption produced no payload." });
      }

      const permlink = generateSecretTwistPermlink(sender);
      const meta = JSON.stringify({
        type:    "secret_twist",
        to:      recipient,
        version: SECRET_TWIST_VERSION,
        payload
      });

      const ops = [
        ["comment", {
          parent_author:   parentAuthor,
          parent_permlink: parentPermlink,
          author:          sender,
          permlink,
          title:           "",
          body:            `@${recipient} [encrypted]`,
          json_metadata:   meta
        }],
        ["comment_options", {
          author:               sender,
          permlink,
          max_accepted_payout:  "0.000 SBD",
          percent_steem_dollars: 10000,
          allow_votes:          true,
          allow_curation_rewards: false,
          extensions:           []
        }]
      ];

      steem_keychain.requestBroadcast(sender, ops, "Posting", callback);
    }
  );
}

// Decrypt a Secret Twist payload via Keychain.
// Uses requestVerifyKey(account, encodedMessage, "Memo", callback) —
// the standard Steem Keychain method for decoding memo-encrypted messages.
// callback: (response) => { response.success, response.result (plaintext) }
function decryptSecretTwist(recipient, sender, encodedPayload, callback) {
  steem_keychain.requestVerifyKey(
    recipient,
    encodedPayload,
    "Memo",
    callback
  );
}

// Fetch Secret Twists for a user (both sent and received).
//
// Strategy: call getContentReplies on @steemtwist/secret-YYYY-MM to get
// all Secret Twists, then enrich each with fetchPost (same pattern as
// fetchTwistFeed). The caller filters by author (sent) or meta.to (inbox).
//
// Why not scan account history?
//   getAccountHistory only contains ops the user *performed* or ops that
//   directly affected their account (votes on their posts, replies to their
//   posts). A comment by someone else mentioning @user in its body does NOT
//   create a history entry for the mentioned user — Steem has no server-side
//   mention indexing. Only the sender's own history contains the comment op.
//
// Parameters:
//   username    — the logged-in user (used for filtering only by the caller).
//   monthsBack  — number of past months to fetch in addition to the current
//                 one. 0 = current month only, 1 = current + previous, etc.
//                 The function always includes the current month.
//
// Returns Promise<post[]> sorted newest-first.
function fetchSecretTwists(username, monthsBack = 0) {
  // Build the list of roots to fetch: current month first, then older ones.
  const roots = [];
  for (let i = 0; i <= monthsBack; i++) {
    roots.push(getSecretMonthlyRootOffset(i));
  }

  return Promise.all(
    roots.map(root =>
      fetchReplies(TWIST_CONFIG.ROOT_ACCOUNT, root)
        .then(replies =>
          Promise.all(
            replies.map(r => fetchPost(r.author, r.permlink).catch(() => r))
          )
        )
        .catch(() => [])
    )
  ).then(arrays => {
    const seen = new Set();
    return arrays
      .flat()
      .filter(p => {
        if (!p || !p.author) return false;
        if (seen.has(p.permlink)) return false;
        seen.add(p.permlink);
        // Keep only genuine Secret Twists
        try {
          const raw = p.json_metadata;
          const meta = raw
            ? (typeof raw === "string" ? JSON.parse(raw) : raw)
            : {};
          return meta.type === "secret_twist";
        } catch { return false; }
      })
      .sort((a, b) => steemDate(b.created) - steemDate(a.created));
  });
}
