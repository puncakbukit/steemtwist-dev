// ============================================================
// app.js — SteemTwist
// Vue 3 + Vue Router 4 application entry point.
// ============================================================

const { createApp, ref, onMounted, provide } = Vue;
const { createRouter, createWebHashHistory, useRoute }                = VueRouter;

function postKey(post) {
  return `${post.author}/${post.permlink}`;
}

// ============================================================
// ROUTE VIEWS
// ============================================================

// ---- ExploreView ----
// Global Twist Stream: all twists this month from everyone.
// Supports three sort modes (New / Hot / Top) and Firehose real-time stream.
// Route: /explore
const ExploreView = {
  name: "ExploreView",
  inject: ["username", "hasKeychain", "notify", "understreamOn", "toggleUnderstream"],
  components: { TwistComposerComponent, TwistCardComponent, LoadingSpinnerComponent },

  data() {
    return {
      twists:              [],
      pinnedTwist:         null,   // logged-in user's pinned twist, shown above feed
      loading:             true,
      isPosting:           false,
      sortMode:            "new",        // "new" | "hot" | "top"
      firehoseOn:          false,
      firehoseStream:      null,
      firehoseError:       "",
      page:                1,
      pageSize:            20,
      monthsLoaded:        1,      // how many calendar months fetched (Twist Stream)
      loadingOlderMonth:   false,  // true while fetching an older page
      understreamCursor:   null    // { author, permlink } cursor for Understream paging
    };
  },

  computed: {
    // Always reflects the current calendar month so a tab left open across
    // midnight on the last day of the month auto-corrects on next interaction.
    monthlyRoot() { return getMonthlyRoot(); },
    // Apply the selected ranking formula to the raw twists array.
    // Entirely reactive — switching sortMode re-sorts instantly with no fetch.
    sortedTwists() {
      return sortTwists(this.twists, this.sortMode);
    },
    pagedTwists() {
      const list = this.pinnedTwist
        ? this.sortedTwists.filter(p => p.permlink !== this.pinnedTwist.permlink)
        : this.sortedTwists;
      return list.slice(0, this.page * this.pageSize);
    },
    hasMore() {
      const total = this.pinnedTwist
        ? this.sortedTwists.filter(p => p.permlink !== this.pinnedTwist.permlink).length
        : this.sortedTwists.length;
      return this.pagedTwists.length < total;
    },
    canLoadOlder() {
      if (this.understreamOn) return this.understreamCursor !== null;
      return true;
    }
  },

  watch: {
    sortMode() { this.page = 1; },
    // When the computed monthlyRoot flips (month rollover), reload the feed
    // automatically so users don't stay stuck on a stale month.
    monthlyRoot() { this.loadFeed(true); }
  },

  async created() {
    await this.loadFeed(true);
  },

  unmounted() {
    this.stopFirehose();
  },

  methods: {
    // refreshPin: if true, also re-fetches the pinned twist from chain.
    // Kept false for vote-triggered reloads so a just-broadcast pin isn't
    // overwritten before the node has indexed it.
    async loadFeed(refreshPin = false) {
      this.loading = true;
      this.page    = 1;
      try {
        // Twist Stream: replies to monthly root (SteemTwist-only)
        // Understream:  all recent Steem posts regardless of tags
        const feedPromise = this.understreamOn
          ? fetchRecentPosts(50)
          : fetchTwistFeed(this.monthlyRoot);
        const pinPromise  = refreshPin && this.username
          ? fetchPinnedTwist(this.username)
          : Promise.resolve(this.pinnedTwist);

        const [result, pinned] = await Promise.all([feedPromise, pinPromise]);

        // fetchRecentPosts returns { posts, nextCursor }; fetchTwistFeed returns array.
        const fresh = Array.isArray(result) ? result : result.posts;
        this.understreamCursor = Array.isArray(result) ? null : (result.nextCursor || null);
        this.monthsLoaded = 1;

        const serverPostKeys = new Set(fresh.map(p => postKey(p)));
        const realTimeOnly = this.twists.filter(
          p => p._firehose && !serverPostKeys.has(postKey(p))
        );
        this.twists      = [...realTimeOnly, ...fresh];
        this.pinnedTwist = pinned;
      } catch (e) {
        this.notify("Could not load twists. Please try again.", "error");
      }
      this.loading = false;
    },

    handlePin(post) {
      this.pinnedTwist = post;
      setPinCache(this.username, post.author, post.permlink);
    },
    handleUnpin() {
      this.pinnedTwist = null;
      setPinCache(this.username, null, null);
    },

    // Fetch the next older page of posts and merge.
    // Twist Stream: fetches the previous calendar month's feed root.
    // Understream:  fetches the next page via cursor from getDiscussionsByCreated.
    async loadOlderMonth() {
      if (this.loadingOlderMonth) return;
      this.loadingOlderMonth = true;
      try {
        if (this.understreamOn) {
          if (this.understreamCursor === null) {
            this.notify("No more posts to load.", "info");
            this.loadingOlderMonth = false;
            return;
          }
          const result = await fetchRecentPosts(50, this.understreamCursor);
          const existingKeys = new Set(this.twists.map(t => postKey(t)));
          const fresh = result.posts.filter(t => !existingKeys.has(postKey(t)));
          if (fresh.length === 0) {
            this.notify("No more posts found.", "info");
          } else {
            this.twists = [...this.twists, ...fresh];
          }
          this.understreamCursor = result.nextCursor;
        } else {
          const root = getMonthlyRootOffset(this.monthsLoaded);
          const older = await fetchTwistFeedPage(root);
          const existingKeys = new Set(this.twists.map(t => postKey(t)));
          const fresh = older.filter(t => !existingKeys.has(postKey(t)));
          if (fresh.length === 0) {
            this.notify("No twists found in that month.", "info");
          } else {
            this.twists = [...this.twists, ...fresh];
          }
          this.monthsLoaded++;
        }
      } catch {
        this.notify("Could not load older posts.", "error");
      }
      this.loadingOlderMonth = false;
    },

    async handlePost(message) {
      if (!message) return;
      this.isPosting = true;
      postTwist(this.username, message, async (res) => {
        this.isPosting = false;
        if (res.success) {
          this.notify("Twist posted! 🌀", "success");
          await new Promise(r => setTimeout(r, 2000));
          await this.loadFeed();
        } else {
          this.notify(res.error || res.message || "Failed to post twist.", "error");
        }
      });
    },

    async handlePostLive({ title, body, code }) {
      if (!code) return;
      this.isPosting = true;
      postLiveTwist(this.username, title, body, code, async (res) => {
        this.isPosting = false;
        if (res.success) {
          this.notify("Live Twist published! ⚡", "success");
          // Clear the live composer draft now that it's on-chain
          try { localStorage.removeItem("st_draft_live_composer"); } catch {}
          await new Promise(r => setTimeout(r, 2000));
          await this.loadFeed();
        } else {
          this.notify(res.error || res.message || "Failed to publish Live Twist.", "error");
        }
      });
    },

    toggleFirehose() {
      this.firehoseOn ? this.stopFirehose() : this.startFirehose();
    },

    startFirehose() {
      this.firehoseError = "";
      this.firehoseOn    = true;

      this.firehoseStream = startFirehose(
        this.monthlyRoot,

        // onTwist — new post or enrichment update
        (post, isUpdate) => {
          if (isUpdate) {
            const idx = this.twists.findIndex(p => p.permlink === post.permlink);
            if (idx !== -1) this.twists.splice(idx, 1, post);
            return;
          }
          if (this.twists.some(p => p.permlink === post.permlink)) return;
          this.twists.push(post);
          setTimeout(() => {
            const p = this.twists.find(t => t.permlink === post.permlink);
            if (p) p._firehose = false;
          }, 2600);
        },

        // onVote — update active_votes in-place so sortedTwists re-ranks in real-time
        (author, permlink, voter, weight) => {
          const post = this.twists.find(
            p => p.author === author && p.permlink === permlink
          );
          if (!post) return;
          const votes = post.active_votes || [];
          const existing = votes.findIndex(v => v.voter === voter);
          if (existing !== -1) {
            votes.splice(existing, 1, { voter, percent: weight });
          } else {
            votes.push({ voter, percent: weight });
          }
          post.active_votes = [...votes];
        },

        // Pass understream flag so the firehose uses the correct filter
        { understream: this.understreamOn }
      );
    },

    stopFirehose() {
      if (this.firehoseStream) {
        this.firehoseStream.stop();
        this.firehoseStream = null;
      }
      this.firehoseOn = false;
    }
  },

  template: `
    <div style="margin-top:20px;">

      <!-- Top bar -->
      <div style="
        display:flex;align-items:center;flex-wrap:wrap;gap:8px;
        font-size:13px;color:#5a4e70;margin-bottom:14px;
      ">
        <span>📅 <strong>{{ monthlyRoot }}</strong></span>

        <button
          @click="loadFeed(true)"
          style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                 border-radius:12px;padding:2px 10px;font-size:12px;"
        >⟳ Refresh</button>

        <!-- Understream toggle -->
        <button
          @click="toggleUnderstream(); loadFeed(true); if(firehoseOn){ stopFirehose(); startFirehose(); }"
          :style="{
            borderRadius:'12px', padding:'2px 12px', fontSize:'12px',
            fontWeight:'600', border:'1px solid',
            background:  understreamOn ? '#0e1a2d' : '#1e1535',
            color:       understreamOn ? '#22d3ee'  : '#9b8db0',
            borderColor: understreamOn ? '#22d3ee'  : '#2e2050'
          }"
          :title="understreamOn ? 'Understream ON — showing all recent Steem posts' : 'Understream OFF — showing Twist Stream only'"
        >🌊 Understream {{ understreamOn ? 'ON' : 'OFF' }}</button>

        <!-- Firehose toggle -->
        <button
          @click="toggleFirehose"
          :style="{
            borderRadius:'12px', padding:'2px 12px', fontSize:'12px',
            fontWeight:'600', border:'1px solid',
            background:  firehoseOn ? '#2d1a00' : '#1e1535',
            color:       firehoseOn ? '#fb923c' : '#9b8db0',
            borderColor: firehoseOn ? '#f97316' : '#2e2050'
          }"
          :title="firehoseOn ? 'Stop real-time stream' : 'Start real-time stream'"
        >{{ firehoseOn ? '🔥 Firehose ON' : '🔥 Firehose OFF' }}</button>

        <!-- Real-time pulse -->
        <span v-if="firehoseOn" style="display:flex;align-items:center;gap:5px;color:#fb923c;font-size:12px;">
          <span style="
            display:inline-block;width:8px;height:8px;border-radius:50%;
            background:#fb923c;animation:twistFlash 1s ease-in-out infinite alternate;
          "></span>
          Real-time
        </span>

        <!-- Sort mode tabs — right-aligned -->
        <div style="margin-left:auto;display:flex;gap:4px;">
          <button
            v-for="mode in [{key:'new',label:'🕒 New'},{key:'hot',label:'🔥 Hot'},{key:'top',label:'⬆ Top'}]"
            :key="mode.key"
            @click="sortMode = mode.key"
            :style="{
              borderRadius:'20px', padding:'2px 12px', fontSize:'12px',
              fontWeight: sortMode === mode.key ? '700' : '400',
              border:'1px solid',
              background:  sortMode === mode.key
                ? 'linear-gradient(135deg,#8b2fc9,#e0187a)'
                : '#1e1535',
              color:       sortMode === mode.key ? '#fff' : '#9b8db0',
              borderColor: sortMode === mode.key ? '#a855f7' : '#2e2050',
              cursor:'pointer', margin:0
            }"
          >{{ mode.label }}</button>
        </div>
      </div>

      <!-- Composer: tabs for 🌀 Twist and ⚡ Live Twist are built into the component -->
      <twist-composer-component
        v-if="username && hasKeychain"
        :username="username"
        :has-keychain="hasKeychain"
        :is-posting="isPosting"
        @post="handlePost"
        @post-live="handlePostLive"
      ></twist-composer-component>

      <!-- CTA for guests — shows @steemtwist cover + avatar as fallback -->
      <div v-if="!username" style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;
        overflow:hidden;max-width:600px;margin:0 auto 20px;
      ">
        <div style="
          height:100px;
          background:linear-gradient(135deg,#1a3af5 0%,#8b2fc9 55%,#e0187a 100%);
          position:relative;
        ">
          <img
            src="https://steemitimages.com/u/steemtwist/avatar"
            style="
              width:64px;height:64px;border-radius:50%;
              border:3px solid #1e1535;position:absolute;
              bottom:-32px;left:16px;background:#1e1535;
            "
            @error="$event.target.src='https://steemitimages.com/u/steemtwist/avatar/small'"
          />
        </div>
        <div style="padding:40px 16px 16px;color:#9b8db0;font-size:14px;">
          Log in with Steem Keychain to post twists and give twist love.
        </div>
      </div>

      <!-- Feed -->
      <loading-spinner-component v-if="loading" message="Loading twists…"></loading-spinner-component>

      <template v-else>
        <!-- Pinned twist — shown above feed, skipped in the sorted list below -->
        <div v-if="pinnedTwist" style="max-width:600px;margin:0 auto 4px;">
          <div style="font-size:12px;color:#4ade80;font-weight:600;margin-bottom:4px;padding-left:4px;">
            📌 Pinned twist
          </div>
          <twist-card-component
            :post="pinnedTwist"
            :username="username"
            :has-keychain="hasKeychain"
            :pinned="true"
            @voted="loadFeed()"
            @unpin="handleUnpin"
          ></twist-card-component>
        </div>

        <div v-if="sortedTwists.filter(p => !pinnedTwist || p.permlink !== pinnedTwist.permlink).length === 0"
             style="color:#5a4e70;padding:40px 0;font-size:15px;text-align:center;">
          No twists yet this month. Be the first! 🌀
        </div>

        <twist-card-component
          v-for="post in pagedTwists"
          :key="post.permlink"
          :post="post"
          :username="username"
          :has-keychain="hasKeychain"
          :pinned="false"
          :class="post._firehose ? 'twist-flash' : ''"
          @voted="loadFeed()"
          @pin="handlePin"
          @deleted="p => twists = twists.filter(t => t.permlink !== p.permlink)"
        ></twist-card-component>

        <!-- Pagination controls -->
        <div v-if="sortedTwists.length > 0 || canLoadOlder"
             style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:16px 0;">
          <button
            v-if="hasMore"
            @click="page++"
            style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                   border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
          >Load more</button>
          <button
            v-if="canLoadOlder"
            @click="loadOlderMonth"
            :disabled="loadingOlderMonth"
            style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                   border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
          >{{ loadingOlderMonth ? "Loading…" : (understreamOn ? "Load more posts" : "Load older months") }}</button>
        </div>
      </template>

    </div>
  `
};

// ---- HomeView ----
// Personalised feed: twists from users the logged-in Twister follows.
// Supports Understream (full blog instead of tw- only) and Firehose
// (real-time stream filtered to followed users).
// Logged-out visitors see a welcome prompt.
// Route: /
const HomeView = {
  name: "HomeView",
  inject: ["username", "hasKeychain", "notify", "understreamOn", "toggleUnderstream"],
  components: { TwistComposerComponent, TwistCardComponent, LoadingSpinnerComponent },

  data() {
    return {
      twists:              [],
      loading:             true,
      isPosting:           false,
      sortMode:            "new",
      emptyFeed:           false,
      followingSet:        new Set(),   // kept for firehose filtering
      firehoseOn:          false,
      firehoseStream:      null,
      page:                1,           // current pagination page
      pageSize:            20,          // posts per page
      monthsLoaded:        1,           // how many calendar months fetched (Twist Stream)
      loadingOlderMonth:   false,       // true while fetching an older page
      understreamCursor:   null         // unused for HomeView (multi-user feed)
    };
  },

  computed: {
    sortedTwists() { return sortTwists(this.twists, this.sortMode); },
    pagedTwists()  { return this.sortedTwists.slice(0, this.page * this.pageSize); },
    hasMore()      { return this.pagedTwists.length < this.sortedTwists.length; },
    canLoadOlder() { return !this.understreamOn; }
  },

  async created() {
    await this.loadFeed();
  },

  unmounted() {
    this.stopFirehose();
  },

  watch: {
    sortMode() { this.page = 1; },
    username() {
      this.stopFirehose();
      this.loadFeed();
    }
  },

  methods: {
    // Fetch the next older calendar month from the blockchain and merge posts.
    async loadOlderMonth() {
      if (this.loadingOlderMonth || this.understreamOn) return;
      this.loadingOlderMonth = true;
      try {
        const root = getMonthlyRootOffset(this.monthsLoaded);
        const older = await fetchTwistFeedPage(root);
        const olderFromFollowing = older.filter(p => this.followingSet.has(p.author));
        const existingKeys = new Set(this.twists.map(t => postKey(t)));
        const fresh = olderFromFollowing.filter(t => !existingKeys.has(postKey(t)));
        if (fresh.length === 0) {
          this.notify("No twists found in that month.", "info");
        } else {
          this.twists = [...this.twists, ...fresh];
        }
        this.monthsLoaded++;
      } catch {
        this.notify("Could not load older month.", "error");
      }
      this.loadingOlderMonth = false;
    },

    async loadFeed() {
      this.loading   = true;
      this.emptyFeed = false;
      this.twists    = [];
      this.page      = 1;
      this.followingSet = new Set();

      if (!this.username) { this.loading = false; return; }

      try {
        const following = await fetchFollowing(this.username);
        if (following.length === 0) {
          this.emptyFeed = true;
          this.loading   = false;
          return;
        }
        this.followingSet = new Set(following);

        // Twist Stream: tw- permlinks this month per followed user
        // Understream:  full blog (all Steem posts) per followed user
        const PER_USER = 10;
        // Cap the number of accounts fetched to avoid overwhelming the RPC
        // node and the browser's connection pool when following thousands of users.
        const MAX_USERS = 100;
        const fetchList = following.slice(0, MAX_USERS);
        const monthlyRoot = getMonthlyRoot();

        // Fetch in small concurrent batches to keep the UI responsive and
        // avoid hammering the node with thousands of simultaneous RPC calls.
        const BATCH = 10;
        const results = [];
        for (let i = 0; i < fetchList.length; i += BATCH) {
          const chunk = fetchList.slice(i, i + BATCH);
          const chunkResults = await Promise.all(
            chunk.map(u =>
              (this.understreamOn
                ? fetchPostsByUser(u, PER_USER).then(r => r.posts)
                : fetchTwistsByUser(u, monthlyRoot, { limit: PER_USER, maxScan: 300 }).then(r => r.posts)
              ).catch(() => [])
            )
          );
          results.push(...chunkResults);
        }

        const seen = new Set();
        const merged = [];
        for (const posts of results) {
          for (const p of posts) {
            const key = postKey(p);
            if (!seen.has(key)) { seen.add(key); merged.push(p); }
          }
        }
        this.twists = merged;
      } catch {
        this.notify("Could not load home feed.", "error");
      }
      this.loading = false;
    },

    async handlePost(message) {
      if (!message) return;
      this.isPosting = true;
      postTwist(this.username, message, async (res) => {
        this.isPosting = false;
        if (res.success) {
          this.notify("Twist posted! 🌀", "success");
          await new Promise(r => setTimeout(r, 2000));
          await this.loadFeed();
        } else {
          this.notify(res.error || res.message || "Failed to post twist.", "error");
        }
      });
    },

    async handlePostLive({ title, body, code }) {
      if (!code) return;
      this.isPosting = true;
      postLiveTwist(this.username, title, body, code, async (res) => {
        this.isPosting = false;
        if (res.success) {
          this.notify("Live Twist published! ⚡", "success");
          // Clear the live composer draft now that it's on-chain
          try { localStorage.removeItem("st_draft_live_composer"); } catch {}
          await new Promise(r => setTimeout(r, 2000));
          await this.loadFeed();
        } else {
          this.notify(res.error || res.message || "Failed to publish Live Twist.", "error");
        }
      });
    },

    toggleFirehose() {
      this.firehoseOn ? this.stopFirehose() : this.startFirehose();
    },

    startFirehose() {
      this.firehoseOn    = true;
      this.firehoseStream = startFirehose(
        getMonthlyRoot(),
        (post, isUpdate) => {
          if (isUpdate) {
            const idx = this.twists.findIndex(p => p.permlink === post.permlink);
            if (idx !== -1) this.twists.splice(idx, 1, post);
            return;
          }
          if (this.twists.some(p => p.permlink === post.permlink)) return;
          this.twists.push(post);
          setTimeout(() => {
            const p = this.twists.find(t => t.permlink === post.permlink);
            if (p) p._firehose = false;
          }, 2600);
        },
        (author, permlink, voter, weight) => {
          const post = this.twists.find(p => p.author === author && p.permlink === permlink);
          if (!post) return;
          const votes = post.active_votes || [];
          const existing = votes.findIndex(v => v.voter === voter);
          if (existing !== -1) votes.splice(existing, 1, { voter, percent: weight });
          else votes.push({ voter, percent: weight });
          post.active_votes = [...votes];
        },
        // understream + followingSet filter — both handled inside startFirehose
        { understream: this.understreamOn, followingSet: this.followingSet }
      );
    },

    stopFirehose() {
      if (this.firehoseStream) { this.firehoseStream.stop(); this.firehoseStream = null; }
      this.firehoseOn = false;
    }
  },

  template: `
    <div style="margin-top:20px;">

      <!-- Top bar -->
      <div style="
        display:flex;align-items:center;flex-wrap:wrap;gap:8px;
        font-size:13px;margin-bottom:14px;
      ">
        <span style="color:#e8e0f0;font-weight:600;font-size:15px;">🏠 Home</span>
        <span style="color:#5a4e70;font-size:12px;">Twists from Twisters you follow</span>

        <button
          @click="loadFeed"
          style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                 border-radius:12px;padding:2px 10px;font-size:12px;margin:0;"
        >⟳ Refresh</button>

        <!-- Understream toggle -->
        <button
          @click="toggleUnderstream(); loadFeed(); if(firehoseOn){ stopFirehose(); startFirehose(); }"
          :style="{
            borderRadius:'12px', padding:'2px 12px', fontSize:'12px',
            fontWeight:'600', border:'1px solid', margin:0,
            background:  understreamOn ? '#0e1a2d' : '#1e1535',
            color:       understreamOn ? '#22d3ee'  : '#9b8db0',
            borderColor: understreamOn ? '#22d3ee'  : '#2e2050'
          }"
          :title="understreamOn ? 'Understream ON — showing full blogs of followed Twisters' : 'Understream OFF — showing Twist Stream only'"
        >🌊 Understream {{ understreamOn ? 'ON' : 'OFF' }}</button>

        <!-- Firehose toggle -->
        <button
          @click="toggleFirehose"
          :style="{
            borderRadius:'12px', padding:'2px 12px', fontSize:'12px',
            fontWeight:'600', border:'1px solid', margin:0,
            background:  firehoseOn ? '#2d1a00' : '#1e1535',
            color:       firehoseOn ? '#fb923c' : '#9b8db0',
            borderColor: firehoseOn ? '#f97316' : '#2e2050'
          }"
          :title="firehoseOn ? 'Stop real-time stream' : 'Start real-time stream (followed Twisters only)'"
        >{{ firehoseOn ? '🔥 Firehose ON' : '🔥 Firehose OFF' }}</button>

        <!-- Real-time pulse -->
        <span v-if="firehoseOn" style="display:flex;align-items:center;gap:5px;color:#fb923c;font-size:12px;">
          <span style="
            display:inline-block;width:8px;height:8px;border-radius:50%;
            background:#fb923c;animation:twistFlash 1s ease-in-out infinite alternate;
          "></span>
          Real-time
        </span>

        <!-- Sort tabs — right-aligned -->
        <div style="margin-left:auto;display:flex;gap:4px;">
          <button
            v-for="mode in [{key:'new',label:'🕒 New'},{key:'hot',label:'🔥 Hot'},{key:'top',label:'⬆ Top'}]"
            :key="mode.key"
            @click="sortMode = mode.key"
            :style="{
              borderRadius:'20px', padding:'2px 12px', fontSize:'12px',
              fontWeight: sortMode === mode.key ? '700' : '400',
              border:'1px solid',
              background:  sortMode === mode.key ? 'linear-gradient(135deg,#8b2fc9,#e0187a)' : '#1e1535',
              color:       sortMode === mode.key ? '#fff' : '#9b8db0',
              borderColor: sortMode === mode.key ? '#a855f7' : '#2e2050',
              cursor:'pointer', margin:0
            }"
          >{{ mode.label }}</button>
        </div>
      </div>

      <!-- Composer: tabs for 🌀 Twist and ⚡ Live Twist are built into the component -->
      <twist-composer-component
        v-if="username && hasKeychain"
        :username="username"
        :has-keychain="hasKeychain"
        :is-posting="isPosting"
        @post="handlePost"
        @post-live="handlePostLive"
      ></twist-composer-component>

      <!-- Logged-out -->
      <div v-if="!username" style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;
        padding:32px 20px;text-align:center;max-width:600px;margin:0 auto 20px;
      ">
        <div style="font-size:36px;margin-bottom:12px;">🌀</div>
        <div style="color:#e8e0f0;font-size:16px;font-weight:600;margin-bottom:8px;">
          Welcome to SteemTwist
        </div>
        <div style="color:#9b8db0;font-size:14px;margin-bottom:16px;">
          Sign in with Steem Keychain to see twists from Twisters you follow.
        </div>
        <a href="#/explore" style="color:#a855f7;font-size:14px;text-decoration:none;">
          Browse the Explore feed instead →
        </a>
      </div>

      <!-- Empty following list -->
      <div v-else-if="emptyFeed && !loading" style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;
        padding:32px 20px;text-align:center;max-width:600px;margin:0 auto;
      ">
        <div style="font-size:32px;margin-bottom:10px;">👤</div>
        <div style="color:#e8e0f0;font-size:15px;font-weight:600;margin-bottom:8px;">Your feed is empty</div>
        <div style="color:#9b8db0;font-size:14px;margin-bottom:14px;">
          Follow some Twisters to see their twists here.
        </div>
        <a href="#/explore" style="color:#a855f7;font-size:14px;text-decoration:none;">
          Discover Twisters on Explore →
        </a>
      </div>

      <!-- Feed -->
      <loading-spinner-component v-else-if="loading" message="Loading your feed…"></loading-spinner-component>

      <template v-else>
        <div v-if="sortedTwists.length === 0"
             style="color:#5a4e70;padding:40px 0;font-size:15px;text-align:center;">
          No twists from followed Twisters this month yet.
        </div>

        <twist-card-component
          v-for="post in pagedTwists"
          :key="post.permlink"
          :post="post"
          :username="username"
          :has-keychain="hasKeychain"
          :pinned="false"
          :class="post._firehose ? 'twist-flash' : ''"
          @voted="loadFeed()"
          @deleted="p => twists = twists.filter(t => t.permlink !== p.permlink)"
        ></twist-card-component>

        <!-- Pagination controls -->
        <div v-if="sortedTwists.length > 0 || canLoadOlder"
             style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:16px 0;">
          <button
            v-if="hasMore"
            @click="page++"
            style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                   border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
          >Load more</button>
          <button
            v-if="canLoadOlder"
            @click="loadOlderMonth"
            :disabled="loadingOlderMonth"
            style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                   border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
          >{{ loadingOlderMonth ? "Loading…" : "Load older months" }}</button>
        </div>
      </template>

    </div>
  `
};

// ---- ProfileView ----
// Displays a Steem user's profile + their twists this month.
// Uses fetchTwistsByUser (account history scan) instead of fetching the
// entire monthly feed and filtering — much faster for individual profiles.
const ProfileView = {
  name: "ProfileView",
  inject: ["username", "hasKeychain", "notify", "understreamOn", "toggleUnderstream"],
  components: { UserProfileComponent, TwistCardComponent, LoadingSpinnerComponent },

  data() {
    return {
      profileData:    null,
      userTwists:     [],
      pinnedTwist:    null,
      loading:        true,
      page:           1,
      pageSize:       20,
      nextCursor:     null,   // account-history cursor for loading older twists
      loadingOlder:   false   // true while fetching older history
    };
  },

  async created() {
    await this.loadProfile();
  },

  computed: {
    monthlyRoot() { return getMonthlyRoot(); },
    pagedTwists() {
      const list = this.pinnedTwist
        ? this.userTwists.filter(p => p.permlink !== this.pinnedTwist.permlink)
        : this.userTwists;
      return list.slice(0, this.page * this.pageSize);
    },
    hasMore() {
      const total = this.pinnedTwist
        ? this.userTwists.filter(p => p.permlink !== this.pinnedTwist.permlink).length
        : this.userTwists.length;
      return this.pagedTwists.length < total;
    },
    canLoadOlder() {
      return this.nextCursor !== null;
    }
  },

  // Reload when navigating between profiles without unmounting the view
  // (e.g. clicking a username while already on a profile page).
  watch: {
    "$route.params.user"() { this.loadProfile(); }
  },

  methods: {
    async loadProfile(refreshPin = true) {
      const user    = this.$route.params.user;
      this.loading  = true;
      this.page     = 1;
      this.userTwists  = [];
      this.profileData = null;
      if (refreshPin) this.pinnedTwist = null;
      try {
        const pinPromise = refreshPin
          ? fetchPinnedTwist(user)
          : Promise.resolve(this.pinnedTwist);

        // Twist Stream: account-history scan for all tw- permlinks (all time)
        // Understream:  full blog (all Steem posts by this user)
        const twistsPromise = this.understreamOn
          ? fetchPostsByUser(user, 50)   // now returns { posts, nextCursor }
          : fetchTwistsByUser(user, null, { limit: 50 });

        const [profile, result, pinned] = await Promise.all([
          fetchAccount(user),
          twistsPromise,
          pinPromise
        ]);
        this.profileData = profile;
        this.userTwists  = result.posts;
        this.nextCursor  = result.nextCursor;
        this.pinnedTwist = pinned;
      } catch {
        this.notify("Failed to load profile.", "error");
      }
      this.loading = false;
    },

    // Continue loading older posts from where loadProfile stopped.
    // Twist Stream: pages backward through account history.
    // Understream:  pages through getDiscussionsByBlog using a cursor.
    async loadOlderTwists() {
      if (this.loadingOlder || this.nextCursor === null) return;
      this.loadingOlder = true;
      try {
        const user = this.$route.params.user;
        const result = this.understreamOn
          ? await fetchPostsByUser(user, 50, this.nextCursor)
          : await fetchTwistsByUser(user, null, { startFrom: this.nextCursor, limit: 50 });
        const existingKeys = new Set(this.userTwists.map(t => postKey(t)));
        const fresh = result.posts.filter(t => !existingKeys.has(postKey(t)));
        if (fresh.length === 0) {
          this.notify("No older posts found.", "info");
        } else {
          this.userTwists = [...this.userTwists, ...fresh];
        }
        this.nextCursor = result.nextCursor;
      } catch {
        this.notify("Could not load older posts.", "error");
      }
      this.loadingOlder = false;
    },

    handlePin(post) {
      this.pinnedTwist = post;
      setPinCache(this.$route.params.user, post.author, post.permlink);
    },
    handleUnpin() {
      this.pinnedTwist = null;
      setPinCache(this.$route.params.user, null, null);
    }
  },

  template: `
    <div style="margin-top:20px;">
      <loading-spinner-component v-if="loading"></loading-spinner-component>

      <div v-else-if="!profileData" style="color:#5a4e70;padding:40px;">
        User @{{ $route.params.user }} not found.
      </div>

      <template v-else>
        <!-- Show profile header only when viewing someone else's profile.
             The logged-in user's own header is already in the global banner. -->
        <!-- Profile card — always shown (own profile or other) -->
        <user-profile-component
          :profile-data="profileData"
          :twist-count="userTwists.length"
        ></user-profile-component>

        <div style="margin-top:12px;">

          <div style="
            max-width:600px;margin:0 auto 12px;
            display:flex;align-items:center;justify-content:space-between;
          ">
            <h3 style="margin:0;color:#e8e0f0;">
              {{ understreamOn ? '🌊 All posts' : '🌀 Twists' }}
            </h3>
            <div style="display:flex;gap:6px;">
              <button
                @click="toggleUnderstream(); loadProfile(true)"
                :style="{
                  borderRadius:'12px', padding:'2px 10px', fontSize:'12px',
                  fontWeight:'600', border:'1px solid', margin:0,
                  background:  understreamOn ? '#0e1a2d' : '#1e1535',
                  color:       understreamOn ? '#22d3ee'  : '#9b8db0',
                  borderColor: understreamOn ? '#22d3ee'  : '#2e2050'
                }"
                :title="understreamOn ? 'Understream ON — showing full Steem blog' : 'Understream OFF — showing Twist Stream only'"
              >🌊 {{ understreamOn ? 'ON' : 'OFF' }}</button>
              <button
                @click="loadProfile"
                style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                       border-radius:12px;padding:2px 10px;font-size:12px;margin:0;"
              >⟳ Refresh</button>
            </div>
          </div>

          <!-- Pinned twist -->
          <div v-if="pinnedTwist" style="max-width:600px;margin:0 auto 4px;">
            <div style="font-size:12px;color:#4ade80;font-weight:600;margin-bottom:4px;padding-left:4px;">
              📌 Pinned twist
            </div>
            <twist-card-component
              :post="pinnedTwist"
              :username="username"
              :has-keychain="hasKeychain"
              :pinned="true"
              @pin="handlePin"
              @unpin="handleUnpin"
            ></twist-card-component>
          </div>

          <div v-if="userTwists.filter(p => !pinnedTwist || p.permlink !== pinnedTwist.permlink).length === 0"
               style="color:#5a4e70;padding:20px;font-size:14px;">
            {{ understreamOn ? 'No posts found.' : 'No twists found for @' + $route.params.user + '.' }}
          </div>

          <twist-card-component
            v-for="post in pagedTwists"
            :key="post.permlink"
            :post="post"
            :username="username"
            :has-keychain="hasKeychain"
            :pinned="false"
            @pin="handlePin"
            @unpin="handleUnpin"
            @deleted="p => userTwists = userTwists.filter(t => t.permlink !== p.permlink)"
          ></twist-card-component>

          <!-- Pagination controls -->
          <div v-if="userTwists.length > 0 || canLoadOlder"
               style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:16px 0;">
            <button
              v-if="hasMore"
              @click="page++"
              style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                     border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
            >Load more</button>
            <button
              v-if="canLoadOlder"
              @click="loadOlderTwists"
              :disabled="loadingOlder"
              style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                     border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
            >{{ loadingOlder ? "Loading…" : (understreamOn ? "Load more posts" : "Load older months") }}</button>
          </div>
          <div v-else-if="userTwists.length > 0 && nextCursor === null"
               style="text-align:center;color:#5a4e70;font-size:12px;padding:12px 0;">
            — end of posts —
          </div>
        </div>
      </template>
    </div>
  `
};

// ---- TwistView ----
// Dedicated page for a single twist at /@author/permlink.
// Shows the full post via TwistCardComponent plus a back link.
const TwistView = {
  name: "TwistView",
  inject: ["username", "hasKeychain", "notify"],
  components: { TwistCardComponent, LoadingSpinnerComponent },

  data() {
    return { post: null, parentPost: null, loading: true };
  },

  async created() {
    await this.loadPost();
  },

  watch: {
    "$route.params"() { this.loadPost(); }
  },

  methods: {
    async loadPost() {
      this.loading    = true;
      this.post       = null;
      this.parentPost = null;
      try {
        const { user, permlink } = this.$route.params;
        const result = await fetchPost(user, permlink);
        if (!result || !result.author) throw new Error("not found");
        this.post = result;

        // Fetch the parent post to show a quoted snippet above, unless
        // this is a root twist whose parent is the monthly feed post
        // (identified by its feed-YYYY-MM permlink pattern).
        const pa = result.parent_author;
        const pp = result.parent_permlink;
        const isFeedRoot = pp && pp.startsWith(TWIST_CONFIG.ROOT_PREFIX);
        if (pa && !isFeedRoot) {
          this.parentPost = await fetchPost(pa, pp).catch(() => null);
        }
      } catch {
        this.notify("Twist not found.", "error");
      }
      this.loading = false;
    },

    // Plain-text snippet: strip markdown / HTML tags, collapse whitespace,
    // truncate to 160 chars so the quote stays compact.
    parentSnippet(body) {
      if (!body) return "";
      const plain = body
        .replace(/\n+<sub>Posted via \[SteemTwist\][^\n]*/i, "") // strip back-link
        .replace(/<[^>]+>/g, "")   // strip HTML tags
        .replace(/[#*`_~>\[\]!]/g, "")  // strip common markdown symbols
        .replace(/\s+/g, " ")
        .trim();
      return plain.length > 160 ? plain.slice(0, 160) + "…" : plain;
    }
  },

  template: `
    <div style="margin-top:20px;max-width:600px;margin-left:auto;margin-right:auto;">

      <!-- Back navigation -->
      <div style="margin-bottom:14px;">
        <a
          href="#"
          @click.prevent="$router.back()"
          style="color:#a855f7;text-decoration:none;font-size:14px;font-weight:600;"
        >← Back</a>
      </div>

      <loading-spinner-component v-if="loading" message="Loading twist…"></loading-spinner-component>

      <div v-else-if="!post" style="color:#5a4e70;padding:40px;text-align:center;">
        Twist not found.
      </div>

      <template v-else>

        <!-- Parent twist quote — shown when this twist is a reply to another twist -->
        <div v-if="parentPost" style="
          background:#16102a;border:1px solid #2e2050;border-radius:12px;
          padding:12px 14px;margin-bottom:6px;
          border-left:3px solid #8b2fc9;
        ">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
            <img
              :src="'https://steemitimages.com/u/' + parentPost.author + '/avatar/small'"
              style="width:24px;height:24px;border-radius:50%;border:1px solid #2e2050;flex-shrink:0;"
              @error="$event.target.src='https://steemitimages.com/u/guest/avatar/small'"
            />
            <span style="font-size:12px;color:#9b8db0;">
              Replying to
              <a
                :href="'#/@' + parentPost.author"
                style="color:#a855f7;text-decoration:none;font-weight:600;"
              >@{{ parentPost.author }}</a>
            </span>
          </div>

          <!-- Quoted snippet -->
          <div style="
            font-size:13px;color:#9b8db0;line-height:1.5;
            font-style:italic;word-break:break-word;
          ">
            "{{ parentSnippet(parentPost.body) }}"
          </div>

          <!-- Link to parent twist page -->
          <div style="margin-top:8px;">
            <a
              :href="'#/@' + parentPost.author + '/' + parentPost.permlink"
              style="font-size:12px;color:#22d3ee;text-decoration:none;font-weight:600;"
            >↗ View original twist</a>
          </div>
        </div>

        <!-- Connector line between quote and twist card -->
        <div v-if="parentPost" style="
          width:2px;height:10px;background:#2e2050;margin:0 0 0 22px;
        "></div>

        <!-- Full twist card -->
        <twist-card-component
          :post="post"
          :username="username"
          :has-keychain="hasKeychain"
        ></twist-card-component>

        <!-- Absolute publish time shown below the card on this page -->
        <div style="
          max-width:600px;margin:6px auto 0;
          text-align:right;font-size:12px;color:#5a4e70;
        ">
          Published {{ new Date(post.created + 'Z').toUTCString().replace(' GMT', ' UTC') }}
        </div>
      </template>

    </div>
  `
};
const AboutView = {
  name: "AboutView",
  inject: ["notify"],
  data() {
    return { html: "", loading: true };
  },
  async created() {
    try {
      const res  = await fetch("README.md");
      if (!res.ok) throw new Error(res.statusText);
      const text = await res.text();
      this.html  = DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }));
    } catch (e) {
      this.notify("Could not load README.md.", "error");
    }
    this.loading = false;
  },
  template: `
    <div style="max-width:700px;margin:30px auto 0;text-align:left;">
      <loading-spinner-component v-if="loading"></loading-spinner-component>
      <div v-else class="twist-body readme-body" v-html="html"></div>
    </div>
  `
};


// ---- SignalsView ----
// Shows all signals (notifications) received by the logged-in user.
// Read/unread state is tracked in localStorage by sequence-number ID.
// Signals are fetched once on mount and all are marked read immediately.
const SignalsView = {
  name: "SignalsView",
  inject: ["username", "notify", "unreadSignals", "refreshUnreadSignals", "understreamOn", "toggleUnderstream"],
  components: { LoadingSpinnerComponent, SignalItemComponent },

  data() {
    return {
      signals:      [],
      loading:      true,
      filter:       "all",
      page:         1,
      pageSize:     30,
      nextCursor:   null,   // account-history cursor for loading older signals
      loadingOlder: false   // true while fetching older history
    };
  },

  computed: {
    readIds() {
      try {
        return new Set(JSON.parse(
          localStorage.getItem("steemtwist_signals_read_" + this.username) || "[]"
        ));
      } catch { return new Set(); }
    },
    // In Twist Stream mode, only show signals for tw- permlinks
    // (or signals with no permlink, like follows).
    // In Understream mode, show all signals.
    streamSignals() {
      if (this.understreamOn) return this.signals;
      return this.signals.filter(s =>
        !s.permlink || s.permlink.startsWith(TWIST_CONFIG.POST_PREFIX)
      );
    },
    filteredSignals() {
      const base = this.streamSignals;
      if (this.filter === "unread") return base.filter(s => !this.readIds.has(s.id));
      return base;
    },
    unreadCount() {
      return this.streamSignals.filter(s => !this.readIds.has(s.id)).length;
    },
    pagedSignals() {
      return this.filteredSignals.slice(0, this.page * this.pageSize);
    },
    hasMore() {
      return this.pagedSignals.length < this.filteredSignals.length;
    }
  },

  watch: {
    filter()        { this.page = 1; },
    understreamOn() { this.page = 1; }
  },

  async created() {
    if (!this.username) { this.loading = false; return; }
    try {
      const result = await fetchSignals(this.username);
      this.signals    = result.signals;
      this.nextCursor = result.nextCursor;
    } catch {
      this.notify("Could not load signals.", "error");
    }
    this.loading = false;
    this.markAllRead();
  },

  methods: {
    // Scan further back in account history for older signals.
    async loadOlderSignals() {
      if (this.loadingOlder || this.nextCursor === null) return;
      this.loadingOlder = true;
      try {
        const result = await fetchSignals(this.username, this.nextCursor);
        const existingIds = new Set(this.signals.map(s => s.id));
        const fresh = result.signals.filter(s => !existingIds.has(s.id));
        if (fresh.length === 0) {
          this.notify("No older signals found.", "info");
        } else {
          this.signals = [...this.signals, ...fresh];
          this.markAllRead();
        }
        this.nextCursor = result.nextCursor;
      } catch {
        this.notify("Could not load older signals.", "error");
      }
      this.loadingOlder = false;
    },

    markAllRead() {
      const ids = this.signals.map(s => s.id);
      try {
        localStorage.setItem(
          "steemtwist_signals_read_" + this.username,
          JSON.stringify(ids)
        );
      } catch {}
      if (typeof this.refreshUnreadSignals === "function") {
        this.refreshUnreadSignals(this.username);
      }
    },
    isRead(signal) {
      return this.readIds.has(signal.id);
    }
  },

  template: `
    <div style="max-width:600px;margin:20px auto 0;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <h2 style="margin:0;color:#e8e0f0;font-size:18px;">🔔 Signals</h2>

        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <!-- Understream toggle -->
          <button
            @click="toggleUnderstream()"
            :style="{
              borderRadius:'20px', padding:'3px 12px', fontSize:'12px',
              fontWeight:'600', border:'1px solid', margin:0,
              background:  understreamOn ? '#0e1a2d' : '#1e1535',
              color:       understreamOn ? '#22d3ee'  : '#9b8db0',
              borderColor: understreamOn ? '#22d3ee'  : '#2e2050'
            }"
            :title="understreamOn ? 'Understream ON — all Steem activity' : 'Understream OFF — SteemTwist only'"
          >🌊 {{ understreamOn ? 'ON' : 'OFF' }}</button>

          <!-- Filter tabs -->
          <button
            v-for="f in [{key:'all',label:'All'},{key:'unread',label:'Unread'}]"
            :key="f.key"
            @click="filter = f.key"
            :style="{
              borderRadius:'20px', padding:'3px 12px', fontSize:'12px',
              fontWeight: filter === f.key ? '700' : '400', border:'1px solid',
              background:  filter === f.key ? 'linear-gradient(135deg,#8b2fc9,#e0187a)' : '#1e1535',
              color:       filter === f.key ? '#fff' : '#9b8db0',
              borderColor: filter === f.key ? '#a855f7' : '#2e2050',
              margin: 0
            }"
          >{{ f.label }}{{ f.key === 'unread' && unreadCount > 0 ? ' (' + unreadCount + ')' : '' }}</button>
        </div>
      </div>

      <!-- Not logged in -->
      <div v-if="!username" style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;
        padding:40px;text-align:center;color:#5a4e70;font-size:15px;
      ">
        Sign in to see your signals.
      </div>

      <!-- Loading -->
      <loading-spinner-component v-else-if="loading" message="Loading signals…"></loading-spinner-component>

      <!-- Empty -->
      <div v-else-if="filteredSignals.length === 0" style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;
        padding:40px;text-align:center;color:#5a4e70;font-size:15px;
      ">
        {{ filter === 'unread' ? 'No unread signals.' : 'No signals yet.' }}
      </div>

      <!-- Signal list -->
      <div v-else style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;overflow:hidden;
      ">
        <signal-item-component
          v-for="signal in pagedSignals"
          :key="signal.id"
          :signal="signal"
          :read="isRead(signal)"
        ></signal-item-component>
      </div>

      <!-- Load More (client-side page through already-fetched signals) -->
      <div v-if="hasMore" style="text-align:center;margin:16px 0;">
        <button
          @click="page++"
          style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                 border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
        >Load more</button>
      </div>
      <!-- Load older signals from blockchain when current pages are exhausted -->
      <div v-else-if="filteredSignals.length > 0 && username && !loading && nextCursor !== null"
           style="text-align:center;margin:16px 0;">
        <button
          @click="loadOlderSignals"
          :disabled="loadingOlder"
          style="background:#1e1535;color:#a855f7;border:1px solid #2e2050;
                 border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
        >{{ loadingOlder ? "Loading…" : "Load older signals" }}</button>
      </div>
      <div v-else-if="filteredSignals.length > 0 && username && !loading && nextCursor === null"
           style="text-align:center;color:#5a4e70;font-size:12px;padding:12px 0;">
        — end of signals —
      </div>

    </div>
  `
};


// ---- SocialView ----
// Shows Followers, Following, and Friends for any user at /@:user/social.
// All three lists are fetched in parallel on load; the Friends list is
// computed client-side as the intersection of followers and following.
// Each user row is enriched with fetchAccount in batches for display names.
const SocialView = {
  name: "SocialView",
  inject: ["username", "hasKeychain", "notify"],
  components: { LoadingSpinnerComponent, UserRowComponent },

  data() {
    return {
      tab:             "followers",

      // Paginated display lists — only what's loaded so far
      followers:       [],
      following:       [],
      followersCursor: "",
      followingCursor: "",
      followersMore:   false,
      followingMore:   false,
      loadingMore:     false,

      // Friends: computed from full lists (fetched lazily when Friends tab is opened)
      allFollowers:    null,   // null = not yet fetched
      allFollowing:    null,
      loadingFriends:  false,

      // The logged-in user's own following list (for Follow buttons)
      myFollowing:     [],

      profiles:        {},
      loading:         true
    };
  },

  computed: {
    viewUser()      { return this.$route.params.user; },
    myFollowingSet(){ return new Set(this.myFollowing); },

    friends() {
      if (!this.allFollowers || !this.allFollowing) return [];
      const followingSet = new Set(this.allFollowing);
      return this.allFollowers.filter(u => followingSet.has(u));
    },

    activeList() {
      if (this.tab === "following") return this.following;
      if (this.tab === "friends")   return this.friends;
      return this.followers;
    },

    hasMore() {
      if (this.tab === "following") return this.followingMore;
      if (this.tab === "friends")   return false;
      return this.followersMore;
    },

    tabs() {
      const friendsCount = (this.allFollowers && this.allFollowing)
        ? this.friends.length : "?";
      return [
        { key: "followers", label: "Followers",
          count: this.followers.length + (this.followersMore ? "+" : "") },
        { key: "following", label: "Following",
          count: this.following.length + (this.followingMore ? "+" : "") },
        { key: "friends",   label: "Friends",    count: friendsCount }
      ];
    }
  },

  async created() {
    await this.load();
  },

  watch: {
    "$route.params.user"() { this.load(); }
  },

  methods: {
    async load() {
      this.loading         = true;
      this.followers       = [];
      this.following       = [];
      this.followersCursor = "";
      this.followingCursor = "";
      this.followersMore   = false;
      this.followingMore   = false;
      this.allFollowers    = null;
      this.allFollowing    = null;
      this.profiles        = {};

      try {
        // Load first page of followers + following in parallel
        const [fp, fg] = await Promise.all([
          fetchFollowersPage(this.viewUser, "", 50),
          fetchFollowingPage(this.viewUser, "", 50)
        ]);
        this.followers       = fp.users;
        this.followersCursor = fp.nextCursor;
        this.followersMore   = fp.hasMore;
        this.following       = fg.users;
        this.followingCursor = fg.nextCursor;
        this.followingMore   = fg.hasMore;

        // Load logged-in user's following list for Follow buttons
        // (only if different from viewUser)
        if (this.username && this.username !== this.viewUser) {
          fetchFollowing(this.username).then(list => { this.myFollowing = list; });
        } else if (this.username === this.viewUser) {
          // If viewing own page, myFollowing = full following list
          fetchFollowing(this.username).then(list => {
            this.myFollowing  = list;
            this.allFollowing = list;
          });
        }

        await this.enrichProfiles(this.activeList);
      } catch {
        this.notify("Could not load social data.", "error");
      }
      this.loading = false;
    },

    async loadMore() {
      if (this.loadingMore || !this.hasMore) return;
      this.loadingMore = true;
      try {
        if (this.tab === "followers") {
          const { users, nextCursor, hasMore } =
            await fetchFollowersPage(this.viewUser, this.followersCursor, 50);
          this.followers.push(...users);
          this.followersCursor = nextCursor;
          this.followersMore   = hasMore;
          await this.enrichProfiles(users);
        } else if (this.tab === "following") {
          const { users, nextCursor, hasMore } =
            await fetchFollowingPage(this.viewUser, this.followingCursor, 50);
          this.following.push(...users);
          this.followingCursor = nextCursor;
          this.followingMore   = hasMore;
          await this.enrichProfiles(users);
        }
      } catch {
        this.notify("Could not load more.", "error");
      }
      this.loadingMore = false;
    },

    // Friends tab: fetch full lists on demand (only once)
    async loadFriends() {
      if (this.allFollowers !== null || this.loadingFriends) return;
      this.loadingFriends = true;
      try {
        const [af, ag] = await Promise.all([
          fetchFollowers(this.viewUser),
          fetchFollowing(this.viewUser)
        ]);
        this.allFollowers = af;
        this.allFollowing = ag;
        if (this.username === this.viewUser) this.myFollowing = ag;
        await this.enrichProfiles(this.friends);
      } catch {
        this.notify("Could not load Friends.", "error");
      }
      this.loadingFriends = false;
    },

    switchTab(key) {
      this.tab = key;
      if (key === "friends") this.loadFriends();
      else this.enrichProfiles(this.activeList);
    },

    async enrichProfiles(usernames) {
      const needed = usernames.filter(u => !this.profiles[u]);
      if (needed.length === 0) return;
      const BATCH = 50;
      for (let i = 0; i < needed.length; i += BATCH) {
        await Promise.all(
          needed.slice(i, i + BATCH).map(u =>
            fetchAccount(u)
              .then(p => { if (p) this.profiles[u] = p; })
              .catch(() => {})
          )
        );
      }
    },

    handleFollow(user) {
      if (!this.myFollowing.includes(user)) this.myFollowing.push(user);
    },
    handleUnfollow(user) {
      this.myFollowing = this.myFollowing.filter(u => u !== user);
    }
  },

  template: `
    <div style="max-width:600px;margin:20px auto 0;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <a :href="'#/@' + viewUser"
           style="color:#a855f7;text-decoration:none;font-size:14px;font-weight:600;"
        >← @{{ viewUser }}</a>
        <h2 style="margin:0;color:#e8e0f0;font-size:18px;">👤 Social</h2>
      </div>

      <!-- Tab bar -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
        <button
          v-for="t in tabs" :key="t.key"
          @click="switchTab(t.key)"
          :style="{
            borderRadius:'20px', padding:'4px 14px', fontSize:'13px',
            fontWeight: tab === t.key ? '700' : '400', border:'1px solid',
            background:  tab === t.key ? 'linear-gradient(135deg,#8b2fc9,#e0187a)' : '#1e1535',
            color:       tab === t.key ? '#fff' : '#9b8db0',
            borderColor: tab === t.key ? '#a855f7' : '#2e2050',
            margin: 0
          }"
        >{{ t.label }} <span style="opacity:0.7;font-weight:400;">({{ t.count }})</span></button>
      </div>

      <!-- Loading initial -->
      <loading-spinner-component v-if="loading" message="Loading…"></loading-spinner-component>

      <!-- Loading Friends -->
      <loading-spinner-component v-else-if="tab === 'friends' && loadingFriends"
        message="Computing friends…"></loading-spinner-component>

      <!-- Empty -->
      <div v-else-if="activeList.length === 0" style="
        background:#1e1535;border:1px solid #2e2050;border-radius:12px;
        padding:40px;text-align:center;color:#5a4e70;font-size:15px;
      ">
        {{ tab === 'followers' ? 'No followers yet.' :
           tab === 'following' ? 'Not following anyone yet.' :
           'No mutual follows yet.' }}
      </div>

      <!-- User list -->
      <template v-else>
        <div style="background:#1e1535;border:1px solid #2e2050;border-radius:12px;overflow:hidden;">
          <user-row-component
            v-for="user in activeList" :key="user"
            :username="user"
            :profile-data="profiles[user] || null"
            :logged-in-user="username"
            :has-keychain="hasKeychain"
            :is-following="myFollowingSet.has(user)"
            @follow="handleFollow"
            @unfollow="handleUnfollow"
          ></user-row-component>
        </div>

        <!-- Load more button -->
        <div v-if="hasMore" style="text-align:center;margin-top:12px;">
          <button
            @click="loadMore"
            :disabled="loadingMore"
            style="background:#1e1535;border:1px solid #2e2050;color:#a855f7;
                   border-radius:20px;padding:6px 24px;font-size:13px;margin:0;"
          >{{ loadingMore ? 'Loading…' : 'Load more' }}</button>
        </div>
      </template>

    </div>
  `
};


// ---- SecretTwistView ----
// Private inbox: shows all Secret Twists sent to or from the logged-in user.
// Fetched via account history scan for "st-" permlinks.
const SecretTwistView = {
  name: "SecretTwistView",
  inject: ["username", "hasKeychain", "notify"],
  components: { LoadingSpinnerComponent, SecretTwistComposerComponent, SecretTwistCardComponent },

  data() {
    return {
      posts:             [],
      loading:           true,
      isSending:         false,
      tab:               "inbox",  // "inbox" | "sent" | "compose"
      page:              1,
      pageSize:          20,
      historyMonthsBack: 0,        // 0=current month, 2=last 3 months, etc.
      monthsLoaded:      1,        // how many calendar months fetched so far
      loadingOlderMonth: false,    // true while fetching an older month
      highlightedParentKey: ""
    };
  },

  computed: {
    // Normalise to lowercase — Steem usernames are always lowercase on-chain.
    usernameLC() {
      return (this.username || "").toLowerCase();
    },
    inbox() {
      return this.posts.filter(p => {
        try {
          const meta = typeof p.json_metadata === "string"
            ? JSON.parse(p.json_metadata || "{}")
            : (p.json_metadata || {});
          return (meta.to || "").toLowerCase() === this.usernameLC;
        } catch { return false; }
      });
    },
    sent() {
      return this.posts.filter(p =>
        (p.author || "").toLowerCase() === this.usernameLC
      );
    },
    activeList() {
      return this.tab === "inbox" ? this.inbox : this.sent;
    },
    pagedList() {
      return this.activeList.slice(0, this.page * this.pageSize);
    },
    hasMore() {
      return this.pagedList.length < this.activeList.length;
    }
  },

  async created() {
    await this.loadPosts();
  },

  // Re-fetch whenever the logged-in user changes (login / logout / switch account).
  // This covers: logging in as a different user, logging out, and navigating
  // back to this page after an account switch without a full page reload.
  watch: {
    username(newVal) {
      this.posts        = [];
      this.tab          = "inbox";
      this.page         = 1;
      this.historyMonthsBack = 0;
      this.monthsLoaded = 1;
      if (newVal) {
        this.loadPosts();
      } else {
        this.loading = false;
      }
    },
    tab() {
      this.page = 1;
      if (this.tab !== "sent") this.highlightedParentKey = "";
    }
  },

  methods: {
    async loadPosts() {
      if (!this.username) { this.loading = false; return; }
      await this.applyHistoryRange(0);
    },

    async applyHistoryRange(monthsBack) {
      if (!this.username) return;
      this.loading = true;
      this.page = 1;
      this.historyMonthsBack = Math.max(0, Number(monthsBack) || 0);
      this.monthsLoaded = this.historyMonthsBack + 1;
      try {
        let posts = await fetchSecretTwistsWithNested(this.username, this.historyMonthsBack);
        // If the current month is empty, automatically widen to recent history
        // so users with older Secret Twists don't land on a blank inbox.
        if (posts.length === 0 && this.historyMonthsBack === 0) {
          posts = await fetchSecretTwistsWithNested(this.username, 2);
          if (posts.length > 0) {
            this.historyMonthsBack = 2;
            this.monthsLoaded = 3;
            this.notify("No Secret Twists this month — showing last 3 months.", "info");
          }
        }
        this.posts = posts;
      } catch {
        this.notify("Could not load Secret Twists.", "error");
      }
      this.loading = false;
    },

    async loadOlderMonth() {
      if (this.loadingOlderMonth) return;
      this.loadingOlderMonth = true;
      try {
        // Fetch one more month back and merge (without resetting scroll/page).
        const nextMonthsBack = this.historyMonthsBack + 1;
        const fresh = await fetchSecretTwistsWithNested(this.username, nextMonthsBack);
        const existingKeys = new Set(this.posts.map(p => postKey(p)));
        const added = fresh.filter(p => !existingKeys.has(postKey(p)));
        if (added.length === 0) {
          this.notify("No older Secret Twists found.", "info");
        } else {
          this.posts = [...this.posts, ...added];
        }
        this.historyMonthsBack = nextMonthsBack;
        this.monthsLoaded++;
      } catch {
        this.notify("Could not load older Secret Twists.", "error");
      }
      this.loadingOlderMonth = false;
    },

    async jumpHistory(monthsStep) {
      if (this.loading) return;
      const next = Math.min(this.historyMonthsBack + Math.max(1, Number(monthsStep) || 1), 120);
      await this.applyHistoryRange(next);
    },

    async handleSend({ recipient, message }) {
      this.isSending = true;
      sendSecretTwist(this.username, recipient, message, async (res) => {
        this.isSending = false;
        if (res.success) {
          this.notify("Secret Twist sent! 🔒", "success");
          this.tab = "sent";
          // Wait for the node to index the new post into account history,
          // then reload the full list.
          await new Promise(r => setTimeout(r, 3000));
          await this.loadPosts();
        } else {
          this.notify(res.error || res.message || "Failed to send Secret Twist.", "error");
        }
      });
    },

    jumpToParentInSent(parent) {
      if (!parent || !parent.key) return;
      const idx = this.sent.findIndex(p => postKey(p) === parent.key);
      if (idx === -1) {
        this.notify("Original Secret Twist not found in loaded Sent history.", "info");
        return;
      }
      this.tab = "sent";
      this.page = Math.max(1, Math.ceil((idx + 1) / this.pageSize));
      this.highlightedParentKey = parent.key;
      setTimeout(() => {
        if (this.highlightedParentKey === parent.key) this.highlightedParentKey = "";
      }, 5000);
    }
  },

  template: `
    <div style="max-width:600px;margin:20px auto 0;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <h2 style="margin:0;color:#e8e0f0;font-size:18px;">🔒 Secret Twists</h2>
        <span style="font-size:13px;color:#5a4e70;">Private Signals</span>
      </div>
      <div style="margin:-6px 0 12px;color:#8f7cab;font-size:12px;">
        Showing current month by default. Use History to revisit older Secret Twists.
      </div>

      <!-- Not logged in -->
      <div v-if="!username" style="
        background:#1a1030;border:1px solid #3b1f5e;border-radius:12px;
        padding:40px;text-align:center;color:#5a4e70;font-size:15px;
      ">
        Sign in to send and receive Secret Twists.
      </div>

      <template v-else>
        <!-- Tab bar -->
        <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
          <button
            v-for="t in [{key:'inbox',label:'📥 Inbox'},{key:'sent',label:'📤 Sent'},{key:'compose',label:'✏️ Compose'}]"
            :key="t.key"
            @click="tab = t.key"
            :style="{
              borderRadius:'20px', padding:'4px 14px', fontSize:'13px',
              fontWeight: tab === t.key ? '700' : '400', border:'1px solid', margin:0,
              background:  tab === t.key ? 'linear-gradient(135deg,#6d28d9,#a21caf)' : '#1a1030',
              color:       tab === t.key ? '#fff' : '#9b8db0',
              borderColor: tab === t.key ? '#a855f7' : '#3b1f5e'
            }"
          >{{ t.label }}{{ t.key === 'inbox' && inbox.length > 0 ? ' (' + inbox.length + ')' : '' }}</button>
        </div>

        <div v-if="tab !== 'compose'" style="display:flex;gap:6px;margin:-8px 0 14px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:12px;color:#8f7cab;margin-right:2px;">History:</span>
          <button
            v-for="r in [
              { label: 'This month', months: 0 },
              { label: 'Last 3 months', months: 2 },
              { label: 'Last 12 months', months: 11 }
            ]"
            :key="r.label"
            @click="applyHistoryRange(r.months)"
            :disabled="loading"
            :style="{
              borderRadius:'999px', padding:'4px 10px', fontSize:'12px', border:'1px solid',
              background: historyMonthsBack === r.months ? '#2a1a46' : '#1a1030',
              color: historyMonthsBack === r.months ? '#d8b4fe' : '#9b8db0',
              borderColor: historyMonthsBack === r.months ? '#a855f7' : '#3b1f5e',
              cursor: loading ? 'wait' : 'pointer'
            }"
          >{{ r.label }}</button>
          <button
            @click="jumpHistory(6)"
            :disabled="loading"
            style="border-radius:999px;padding:4px 10px;font-size:12px;border:1px solid #3b1f5e;
                   background:#1a1030;color:#9b8db0;cursor:pointer;"
            title="Jump back six more months"
          >↩︎ Jump back 6 months</button>
        </div>

        <!-- Compose tab -->
        <secret-twist-composer-component
          v-if="tab === 'compose'"
          :username="username"
          :has-keychain="hasKeychain"
          :is-sending="isSending"
          @send="handleSend"
        ></secret-twist-composer-component>

        <!-- Loading -->
        <loading-spinner-component v-else-if="loading" message="Loading Secret Twists…"></loading-spinner-component>

        <!-- Inbox / Sent lists -->
        <template v-else>
          <div v-if="(tab === 'inbox' ? inbox : sent).length === 0" style="
            background:#1a1030;border:1px solid #3b1f5e;border-radius:12px;
            padding:40px;text-align:center;color:#5a4e70;font-size:15px;
          ">
            {{ tab === 'inbox' ? 'No Secret Twists received yet.' : 'No Secret Twists sent yet.' }}
          </div>

          <secret-twist-card-component
            v-for="post in pagedList"
            :key="post.permlink"
            :post="post"
            :username="username"
            :has-keychain="hasKeychain"
            :show-parent-link="tab === 'inbox'"
            :highlight-key="highlightedParentKey"
            @jump-to-parent="jumpToParentInSent"
          ></secret-twist-card-component>

          <!-- Load More (client-side page) -->
          <div v-if="hasMore" style="text-align:center;margin:16px 0;">
            <button
              @click="page++"
              style="background:#1a1030;color:#a855f7;border:1px solid #3b1f5e;
                     border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
            >Load more</button>
          </div>
	          <!-- Load older month from blockchain -->
	          <div v-else style="text-align:center;margin:16px 0;">
	            <button
	              @click="loadOlderMonth"
	              :disabled="loadingOlderMonth"
	              style="background:#1a1030;color:#a855f7;border:1px solid #3b1f5e;
	                     border-radius:20px;padding:6px 24px;font-size:13px;cursor:pointer;"
	            >{{ loadingOlderMonth ? "Loading…" : "Load older month" }}</button>
	          </div>
        </template>

        <!-- Privacy notice -->
        <div style="
          max-width:600px;margin:20px auto 0;padding:12px 14px;
          background:#0f0a1e;border:1px solid #2e2050;border-radius:10px;
          font-size:12px;color:#5a4e70;line-height:1.6;
        ">
          ⚠️ Secret Twists are encrypted with Steem's memo key scheme. Only the sender and
          recipient can decrypt them. However, the sender, recipient, and timing are visible
          on the public blockchain. This provides <strong style="color:#9b8db0;">content privacy</strong>,
          not communication anonymity.
        </div>
      </template>

    </div>
  `
};

// ============================================================
// ROUTER
// ============================================================

const routes = [
  { path: "/",               component: HomeView    },
  { path: "/explore",        component: ExploreView  },
  { path: "/signals",        component: SignalsView },
  { path: "/secret-twists",  component: SecretTwistView },
  { path: "/about",          component: AboutView   },
  { path: "/@:user/social",    component: SocialView  },
  { path: "/@:user/:permlink", component: TwistView  },
  { path: "/@:user",         component: ProfileView }
];

const router = createRouter({
  history: createWebHashHistory('/steemtwist'),
  routes
});

// ============================================================
// ROOT APP
// ============================================================

const App = {
  components: {
    AppNotificationComponent,
    AuthComponent,
    LoadingSpinnerComponent,
    UserProfileComponent,
    TwistCardComponent,
    TwistComposerComponent
  },

  setup() {
    const username      = ref(localStorage.getItem("steem_user") || "");
    const hasKeychain   = ref(false);
    const keychainReady = ref(false);
    const loginError    = ref("");
    const showLoginForm = ref(false);
    const isLoggingIn   = ref(false);
    const notification  = ref({ message: "", type: "error" });
    const profileData   = ref(null);   // logged-in user's profile, fetched on login/mount
    const currentRoute  = useRoute();

    function notify(message, type = "error") {
      notification.value = { message, type };
    }
    function dismissNotification() {
      notification.value = { message: "", type: "error" };
    }

    // Fetch and cache the logged-in user's profile for the global header.
    // When no user is logged in, falls back to @steemtwist so the header
    // always has a cover image and identity rather than showing empty.
    async function loadProfile(user) {
      const target = user || TWIST_CONFIG.ROOT_ACCOUNT;
      profileData.value = await fetchAccount(target).catch(() => null);
    }

    onMounted(() => {
      setRPC(0);
      // Always load a profile — logged-in user's own, or @steemtwist as fallback
      loadProfile(username.value);
      if (username.value) refreshUnreadSignals(username.value);
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.steem_keychain || attempts > 10) {
          clearInterval(interval);
          hasKeychain.value   = !!window.steem_keychain;
          keychainReady.value = true;
          if (window.steem_keychain) {
            // Log available methods to help diagnose API version issues
            console.log("[SteemTwist] Keychain methods:",
              Object.getOwnPropertyNames(window.steem_keychain)
                .filter(k => typeof window.steem_keychain[k] === "function")
            );
          }
        }
      }, 100);
    });

    function login(user) {
      loginError.value = "";
      if (!window.steem_keychain) {
        loginError.value = "Steem Keychain extension is not installed.";
        return;
      }
      if (!user) return;
      isLoggingIn.value = true;
      keychainLogin(user, (res) => {
        isLoggingIn.value = false;
        if (!res.success) {
          loginError.value = "Keychain sign-in was rejected.";
          return;
        }
        const verified = res.data?.username || res.username;
        if (verified !== user) {
          loginError.value = "Signed account does not match entered username.";
          return;
        }
        username.value      = user;
        hasKeychain.value   = true;
        localStorage.setItem("steem_user", user);
        loginError.value    = "";
        showLoginForm.value = false;
        notify("Logged in as @" + user, "success");
        loadProfile(user);
        refreshUnreadSignals(user);
      });
    }

    function logout() {
      username.value      = "";
      loginError.value    = "";
      showLoginForm.value = false;
      localStorage.removeItem("steem_user");
      notify("Logged out.", "info");
      unreadSignals.value = 0;
      loadProfile("");   // reload @steemtwist as fallback
    }

    // Global Understream toggle — persisted in localStorage.
    // OFF = Twist Stream only (SteemTwist data); ON = full Steem Understream.
    const understreamOn = ref(localStorage.getItem("steemtwist_understream") === "true");
    function toggleUnderstream() {
      understreamOn.value = !understreamOn.value;
      localStorage.setItem("steemtwist_understream", understreamOn.value);
    }

    // Unread signal count — recomputed whenever the user navigates to /signals
    // and marks everything read. Exposed via provide so any component can read it.
    const unreadSignals = ref(0);

    async function refreshUnreadSignals(user) {
      if (!user) { unreadSignals.value = 0; return; }
      try {
        const signals = await fetchSignals(user);
        let readIds;
        try { readIds = new Set(JSON.parse(localStorage.getItem("steemtwist_signals_read_" + user) || "[]")); }
        catch { readIds = new Set(); }
        unreadSignals.value = signals.filter(s => !readIds.has(s.id)).length;
      } catch { unreadSignals.value = 0; }
    }

    provide("username",         username);
    provide("hasKeychain",      hasKeychain);
    provide("notify",           notify);
    provide("unreadSignals",    unreadSignals);
    provide("understreamOn",    understreamOn);
    provide("toggleUnderstream", toggleUnderstream);

    return {
      username, hasKeychain, keychainReady,
      loginError, showLoginForm, isLoggingIn,
      notification, notify, dismissNotification,
      login, logout, profileData, currentRoute,
      unreadSignals, refreshUnreadSignals,
      understreamOn, toggleUnderstream
    };
  },

  template: `
    <!-- ═══════════════════════════════════════════════════════
         GLOBAL HEADER — cover image + nav bar + profile strip
    ══════════════════════════════════════════════════════════ -->
    <div style="position:relative;overflow:hidden;">

      <!-- Cover layer: user cover image, falls back to gradient.
           coverImage is already sanitized to https/http only by fetchAccount,
           but we CSS-encode it here as an extra layer of defence so
           characters like ) ' " cannot break out of the url(...) value. -->
      <div :style="{
        position:'absolute', inset:0,
        backgroundImage: (profileData && profileData.coverImage)
          ? 'url(' + encodeURI(profileData.coverImage) + ')'
          : 'none',
        backgroundSize:'cover', backgroundPosition:'center',
        zIndex:0
      }"></div>

      <!-- Gradient overlay: opaque at top (for nav legibility), fades out toward bottom -->
      <div style="
        position:absolute;inset:0;
        background:linear-gradient(to bottom,
          rgba(30,10,60,0.72) 0%,
          rgba(30,10,60,0.30) 55%,
          rgba(30,10,60,0.08) 100%);
        zIndex:1;
      "></div>

      <!-- ── Top nav bar ─────────────────────────────────── -->
      <div style="
        position:relative;z-index:2;
        padding:12px 20px;
        display:flex;align-items:center;justify-content:space-between;
        flex-wrap:wrap;gap:8px;
        box-shadow:0 2px 16px rgba(168,85,247,0.4);
      ">
        <router-link to="/" style="text-decoration:none;">
          <div>
            <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;
                         text-shadow:0 0 20px rgba(34,211,238,0.6);">
              🌀 SteemTwist
            </span>
            <div style="color:#e0d0ff;font-size:18px;letter-spacing:0.5px;margin-top:2px;font-weight:500;">
              Steem with a Twist
            </div>
          </div>
        </router-link>

        <nav style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <router-link to="/" exact-active-class="nav-active"
            style="color:#fff;text-decoration:none;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:500;background:rgba(0,0,0,0.35);backdrop-filter:blur(6px);"
          >🏠 Home</router-link>

          <router-link to="/explore" exact-active-class="nav-active"
            style="color:#fff;text-decoration:none;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:500;background:rgba(0,0,0,0.35);backdrop-filter:blur(6px);"
          >🔭 Explore</router-link>

          <router-link v-if="username" :to="'/@' + username" exact-active-class="nav-active"
            style="color:#fff;text-decoration:none;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:500;background:rgba(0,0,0,0.35);backdrop-filter:blur(6px);"
          >My Profile</router-link>

          <router-link
            v-if="username"
            to="/signals"
            exact-active-class="nav-active"
            @click="refreshUnreadSignals(username)"
            style="color:#fff;text-decoration:none;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:500;background:rgba(0,0,0,0.35);backdrop-filter:blur(6px);display:inline-flex;align-items:center;gap:5px;"
          >
            🔔 Signals
            <span
              v-if="unreadSignals > 0"
              style="
                background:linear-gradient(135deg,#8b2fc9,#e0187a);
                color:#fff;font-size:10px;font-weight:700;
                padding:1px 5px;border-radius:10px;line-height:1.4;
              "
            >{{ unreadSignals > 99 ? '99+' : unreadSignals }}</span>
          </router-link>

          <router-link
            v-if="username"
            to="/secret-twists"
            exact-active-class="nav-active"
            style="color:#fff;text-decoration:none;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:500;background:rgba(0,0,0,0.35);backdrop-filter:blur(6px);"
          >🔒 Private</router-link>

          <router-link to="/about" exact-active-class="nav-active"
            style="color:#fff;text-decoration:none;padding:5px 12px;border-radius:20px;font-size:14px;font-weight:500;background:rgba(0,0,0,0.35);backdrop-filter:blur(6px);"
          >About</router-link>

          <template v-if="!username">
            <button
              @click="showLoginForm = !showLoginForm"
              style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);
                     color:#fff;padding:5px 16px;border-radius:20px;font-size:14px;
                     backdrop-filter:blur(4px);margin:0;"
            >Sign in</button>
          </template>
          <template v-else>
            <button
              @click="logout"
              style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.35);
                     color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;margin:0;"
            >Logout</button>
          </template>
        </nav>
      </div>

      <!-- ── Profile strip — logged-in user OR @steemtwist fallback ── -->
      <div v-if="profileData" style="
        position:relative;z-index:2;
        padding:0 20px 16px;
        display:flex;align-items:flex-end;gap:14px;
      ">
        <!-- Avatar -->
        <a :href="username ? '#/@' + username : '#/@' + profileData.username"
           style="text-decoration:none;flex-shrink:0;">
          <img
            :src="'https://steemitimages.com/u/' + (username || profileData.username) + '/avatar'"
            style="
              width:72px;height:72px;border-radius:50%;
              border:3px solid rgba(255,255,255,0.5);
              background:#1a1030;
              box-shadow:0 0 20px rgba(168,85,247,0.5);
            "
            @error="$event.target.src='https://steemitimages.com/u/steemtwist/avatar'"
          />
        </a>

        <!-- Name / bio -->
        <div style="min-width:0;padding-bottom:4px;">
          <div style="font-size:17px;font-weight:700;color:#fff;
                      text-shadow:0 1px 6px rgba(0,0,0,0.5);line-height:1.2;">
            {{ profileData.displayName }}
          </div>
          <div style="font-size:13px;color:#e0d0ff;margin-top:1px;">
            @{{ username || profileData.username }}
          </div>
          <div v-if="profileData.about"
               style="font-size:13px;color:#c0b0e0;margin-top:3px;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px;">
            {{ profileData.about }}
          </div>
        </div>
      </div>

      <!-- Fallback spacer while profile is still loading -->
      <div v-else style="height:8px;position:relative;z-index:2;"></div>

    </div><!-- /global header -->

    <!-- Inline login form -->
    <div v-if="!username && showLoginForm" style="
      background:#1a1030;border-bottom:1px solid #2e2050;
      padding:12px;text-align:center;
    ">
      <auth-component
        :username="username"
        :has-keychain="hasKeychain"
        :login-error="loginError"
        :is-logging-in="isLoggingIn"
        @login="login"
        @logout="logout"
        @close="showLoginForm = false"
      ></auth-component>
    </div>

    <!-- Keychain not detected -->
    <div v-if="keychainReady && !hasKeychain" class="keychain-notice" style="text-align:center;">
      <strong style="color:#a855f7;">Read-only mode</strong> — Install the
      <a href="https://www.google.com/search?q=steem+keychain+browser+extension" target="_blank"
         rel="noopener" style="color:#22d3ee;">Steem Keychain</a>
      browser extension to post twists and give twist love.
    </div>

    <!-- Global notification -->
    <app-notification-component
      :message="notification.message"
      :type="notification.type"
      @dismiss="dismissNotification"
    ></app-notification-component>

    <!-- Page content -->
    <div style="padding:0 16px 40px;">
      <router-view></router-view>
    </div>
  `
};

// ============================================================
// MOUNT
// ============================================================

const vueApp = createApp(App);

vueApp.component("AppNotificationComponent", AppNotificationComponent);
vueApp.component("SignalItemComponent",       SignalItemComponent);
vueApp.component("UserRowComponent",             UserRowComponent);
vueApp.component("SecretTwistComposerComponent", SecretTwistComposerComponent);
vueApp.component("SecretTwistCardComponent",     SecretTwistCardComponent);
vueApp.component("AuthComponent",            AuthComponent);
vueApp.component("UserProfileComponent",     UserProfileComponent);
vueApp.component("LoadingSpinnerComponent",  LoadingSpinnerComponent);
vueApp.component("ReplyCardComponent",       ReplyCardComponent);
vueApp.component("ThreadComponent",          ThreadComponent);
vueApp.component("TwistCardComponent",       TwistCardComponent);
vueApp.component("TwistComposerComponent",   TwistComposerComponent);

vueApp.use(router);
vueApp.mount("#app");
