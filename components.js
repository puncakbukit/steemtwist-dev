// ============================================================
// components.js
// Reusable Vue 3 components for a Steem + Vue Router SPA.
// No app-specific logic — extend freely.
// ============================================================

// ---- Draft auto-save helpers ----
// Thin wrappers around localStorage for persisting in-progress composer drafts.
// Keys are namespaced with "st_draft_" to avoid collisions.
// All operations are try/caught so storage quota errors never break the UI.
const draftStorage = {
  save(key, value) {
    try { localStorage.setItem("st_draft_" + key, JSON.stringify(value)); } catch {}
  },
  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem("st_draft_" + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  clear(key) {
    try { localStorage.removeItem("st_draft_" + key); } catch {}
  }
};

// ---- Live Twist Templates ----
const LIVE_TWIST_TEMPLATES = [
  { id: "poll", icon: "\ud83d\uddf3\ufe0f", name: "Poll", desc: "Local interactive poll \u2014 vote tracked in memory",
    code: "// Local Poll \u2014 vote tracked in memory only\nconst options = [\"Option A\", \"Option B\", \"Option C\"];\nlet voted = null;\n\nfunction draw() {\n  const items = options.map((opt, i) => {\n    const sel = voted === i;\n    const style = sel\n      ? \"background:#6d28d9;color:#fff;border:1px solid #a855f7;\"\n      : \"background:#1a1030;color:#e8e0f0;border:1px solid #3b1f5e;\";\n    return \"<button id='v\" + i + \"' style='\" + style +\n      \"border-radius:8px;padding:8px 14px;margin:4px;font-size:14px;'>\" +\n      (sel ? \"\\u2713 \" : \"\") + opt + \"</button>\";\n  }).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>Which do you prefer?</div>\" +\n    \"<div>\" + items + \"</div>\" +\n    (voted !== null ? \"<div style='margin-top:8px;font-size:13px;color:#9b8db0;'>You selected: <b style='color:#e8e0f0;'>\" + options[voted] + \"</b></div>\" : \"\") +\n    \"</div>\"\n  );\n  options.forEach((_, i) => {\n    const btn = document.getElementById(\"v\" + i);\n    if (btn) btn.onclick = () => { voted = i; draw(); };\n  });\n}\ndraw();" },
  { id: "quiz", icon: "\ud83e\udde0", name: "Quiz", desc: "Multiple-choice quiz with instant feedback",
    code: "// Quiz \u2014 instant feedback, no backend needed\nconst questions = [\n  { q: \"What is the capital of Japan?\", choices: [\"Seoul\",\"Beijing\",\"Tokyo\",\"Bangkok\"], answer: 2 },\n  { q: \"How many sides does a hexagon have?\", choices: [\"5\",\"6\",\"7\",\"8\"], answer: 1 },\n  { q: \"What is 7 x 8?\", choices: [\"54\",\"56\",\"58\",\"64\"], answer: 1 }\n];\nlet current = 0, score = 0, picked = null;\n\nfunction draw() {\n  if (current >= questions.length) {\n    app.render(\n      \"<div style='padding:8px;text-align:center;'>\" +\n      \"<div style='font-size:32px;margin-bottom:8px;'>\" + (score === questions.length ? \"\\uD83C\\uDFC6\" : \"\\uD83C\\uDFAF\") + \"</div>\" +\n      \"<div style='font-size:18px;color:#e8e0f0;font-weight:600;'>Score: \" + score + \"/\" + questions.length + \"</div>\" +\n      \"<button id='restart' style='margin-top:12px;'>Restart</button>\" +\n      \"</div>\"\n    );\n    document.getElementById(\"restart\").onclick = () => { current = 0; score = 0; picked = null; draw(); };\n    return;\n  }\n  const q = questions[current];\n  const choices = q.choices.map((c, i) => {\n    let bg = \"#1a1030\", color = \"#e8e0f0\", border = \"#3b1f5e\";\n    if (picked !== null) {\n      if (i === q.answer) { bg = \"#0c2d1a\"; color = \"#4ade80\"; border = \"#166534\"; }\n      else if (i === picked) { bg = \"#2d0a0a\"; color = \"#fca5a5\"; border = \"#7f1d1d\"; }\n    }\n    return \"<button id='c\" + i + \"' style='background:\" + bg + \";color:\" + color +\n      \";border:1px solid \" + border + \";border-radius:8px;padding:7px 12px;margin:3px;font-size:13px;'>\" + c + \"</button>\";\n  }).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-size:12px;color:#9b8db0;margin-bottom:4px;'>Q\" + (current+1) + \"/\" + questions.length + \"</div>\" +\n    \"<div style='font-weight:600;color:#e8e0f0;margin-bottom:8px;'>\" + q.q + \"</div>\" +\n    \"<div>\" + choices + \"</div>\" +\n    (picked !== null ? \"<button id='next' style='margin-top:10px;'>Next</button>\" : \"\") +\n    \"</div>\"\n  );\n  if (picked === null) {\n    q.choices.forEach((_, i) => {\n      const btn = document.getElementById(\"c\" + i);\n      if (btn) btn.onclick = () => { picked = i; if (i === q.answer) score++; draw(); };\n    });\n  } else {\n    const n = document.getElementById(\"next\");\n    if (n) n.onclick = () => { current++; picked = null; draw(); };\n  }\n}\ndraw();" },
  { id: "clicker", icon: "\ud83c\udfae", name: "Clicker Game", desc: "Click as fast as you can in 10 seconds",
    code: "// Clicker game \u2014 score as fast as you can in 10 seconds\nlet score = 0, running = false, timeLeft = 10, timer = null;\n\nfunction draw() {\n  app.render(\n    \"<div style='padding:8px;text-align:center;'>\" +\n    \"<div style='font-size:13px;color:#9b8db0;margin-bottom:8px;'>Click as fast as you can!</div>\" +\n    \"<div style='font-size:32px;font-weight:700;color:#c084fc;margin-bottom:8px;'>\" + score + \"</div>\" +\n    (running\n      ? \"<div style='font-size:13px;color:#fb923c;margin-bottom:8px;'>&#9203; \" + timeLeft + \"s left</div>\" +\n        \"<button id='tap' style='font-size:18px;padding:12px 28px;'>&#128070; Click!</button>\"\n      : \"<div style='font-size:13px;color:#9b8db0;margin-bottom:8px;'>\" +\n        (timeLeft === 0 ? \"Time up! Final score: \" + score : \"Ready?\") + \"</div>\" +\n        \"<button id='start'>&#9654; Start</button>\"\n    ) +\n    \"</div>\"\n  );\n  if (running) {\n    const tap = document.getElementById(\"tap\");\n    if (tap) tap.onclick = () => { score++; draw(); };\n  } else {\n    const start = document.getElementById(\"start\");\n    if (start) start.onclick = () => {\n      score = 0; timeLeft = 10; running = true; draw();\n      timer = setInterval(() => {\n        timeLeft--;\n        if (timeLeft <= 0) { clearInterval(timer); running = false; }\n        draw();\n      }, 1000);\n    };\n  }\n}\ndraw();" },
  { id: "calculator", icon: "\ud83e\uddee", name: "Calculator", desc: "Steem Power curation ROI calculator",
    code: "// Steem Curation ROI Calculator\nlet sp = 1000, apy = 8.5;\n\nfunction calc() {\n  const daily = sp * apy / 100 / 365;\n  const monthly = daily * 30;\n  const yearly = sp * apy / 100;\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-weight:600;color:#c084fc;margin-bottom:10px;'>Steem Curation ROI</div>\" +\n    \"<label style='font-size:12px;color:#9b8db0;'>Steem Power (SP)</label>\" +\n    \"<div style='display:flex;align-items:center;gap:8px;margin:4px 0 10px;'>\" +\n    \"<input id='sp' type='range' min='100' max='100000' step='100' value='\" + sp + \"' style='flex:1;accent-color:#a855f7;'>\" +\n    \"<span style='color:#e8e0f0;font-weight:600;min-width:60px;'>\" + sp.toLocaleString() + \" SP</span></div>\" +\n    \"<label style='font-size:12px;color:#9b8db0;'>Estimated APY (%)</label>\" +\n    \"<div style='display:flex;align-items:center;gap:8px;margin:4px 0 14px;'>\" +\n    \"<input id='apy' type='range' min='1' max='30' step='0.5' value='\" + apy + \"' style='flex:1;accent-color:#a855f7;'>\" +\n    \"<span style='color:#e8e0f0;font-weight:600;min-width:50px;'>\" + apy + \"%</span></div>\" +\n    \"<div style='background:#0f0a1e;border-radius:8px;padding:10px;border:1px solid #3b1f5e;'>\" +\n    \"<div style='display:flex;justify-content:space-between;margin-bottom:4px;'><span style='color:#9b8db0;'>Daily</span><b style='color:#4ade80;'>+\" + daily.toFixed(3) + \" SP</b></div>\" +\n    \"<div style='display:flex;justify-content:space-between;margin-bottom:4px;'><span style='color:#9b8db0;'>Monthly</span><b style='color:#4ade80;'>+\" + monthly.toFixed(2) + \" SP</b></div>\" +\n    \"<div style='display:flex;justify-content:space-between;'><span style='color:#9b8db0;'>Yearly</span><b style='color:#c084fc;font-size:16px;'>+\" + yearly.toFixed(1) + \" SP</b></div>\" +\n    \"</div></div>\"\n  );\n  document.getElementById(\"sp\").oninput = e => { sp = +e.target.value; calc(); };\n  document.getElementById(\"apy\").oninput = e => { apy = +e.target.value; calc(); };\n}\ncalc();" },
  { id: "chart", icon: "\ud83d\udcca", name: "Chart", desc: "Interactive bar chart with slider filter",
    code: "// Interactive bar chart with filter\nconst data = [\n  { label: \"Jan\", value: 42 }, { label: \"Feb\", value: 67 },\n  { label: \"Mar\", value: 55 }, { label: \"Apr\", value: 89 },\n  { label: \"May\", value: 73 }, { label: \"Jun\", value: 95 },\n  { label: \"Jul\", value: 60 }, { label: \"Aug\", value: 82 }\n];\nlet threshold = 0;\n\nfunction draw() {\n  const max = Math.max(...data.map(d => d.value));\n  const filtered = data.filter(d => d.value >= threshold);\n  const bars = filtered.map(d => {\n    const pct = Math.round(d.value / max * 100);\n    const color = d.value >= 80 ? \"#c084fc\" : d.value >= 60 ? \"#a855f7\" : \"#6d28d9\";\n    return \"<div style='display:flex;align-items:center;gap:6px;margin-bottom:5px;'>\" +\n      \"<div style='width:30px;font-size:11px;color:#9b8db0;'>\" + d.label + \"</div>\" +\n      \"<div style='flex:1;background:#1a1030;border-radius:4px;height:20px;overflow:hidden;'>\" +\n      \"<div style='width:\" + pct + \"%;background:\" + color + \";height:100%;border-radius:4px;'></div></div>\" +\n      \"<div style='width:28px;font-size:12px;color:#e8e0f0;text-align:right;'>\" + d.value + \"</div></div>\";\n  }).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>Monthly Activity</div>\" +\n    \"<label style='font-size:12px;color:#9b8db0;'>Min value: <b style='color:#e8e0f0;'>\" + threshold + \"</b></label>\" +\n    \"<input id='thr' type='range' min='0' max='90' value='\" + threshold + \"' style='width:100%;margin:4px 0 10px;accent-color:#a855f7;'>\" +\n    (bars || \"<div style='color:#5a4e70;font-size:13px;'>No data above threshold.</div>\") +\n    \"</div>\"\n  );\n  document.getElementById(\"thr\").oninput = e => { threshold = +e.target.value; draw(); };\n}\ndraw();" },
  { id: "expandable", icon: "\ud83d\udcd6", name: "Expandable", desc: "Tabbed collapsible content sections",
    code: "// Tabbed expandable content\nconst tabs = [\n  { label: \"Overview\", content: \"This is the overview section. Put a summary here to keep the card compact.\" },\n  { label: \"Details\",  content: \"Here are the full details. Add tables, lists, or longer explanations.\" },\n  { label: \"Sources\",  content: \"1. Steem Whitepaper (2016)\\n2. Steem Developer Portal\\n3. Community research.\" }\n];\nlet active = 0;\n\nfunction draw() {\n  const tabBar = tabs.map((t, i) =>\n    \"<button id='tab\" + i + \"' style='padding:5px 12px;font-size:12px;margin-right:4px;\" +\n    \"border-radius:6px 6px 0 0;border:1px solid \" + (active===i ? \"#a855f7\" : \"#3b1f5e\") + \";\" +\n    \"background:\" + (active===i ? \"#2e2050\" : \"none\") + \";color:\" + (active===i ? \"#e8e0f0\" : \"#9b8db0\") + \";'>\" +\n    t.label + \"</button>\"\n  ).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'><div>\" + tabBar + \"</div>\" +\n    \"<div style='background:#0f0a1e;border:1px solid #3b1f5e;border-radius:0 6px 6px 6px;\" +\n    \"padding:10px;font-size:13px;color:#c0b0e0;white-space:pre-wrap;min-height:60px;'>\" +\n    tabs[active].content + \"</div></div>\"\n  );\n  tabs.forEach((_, i) => {\n    const b = document.getElementById(\"tab\" + i);\n    if (b) b.onclick = () => { active = i; draw(); };\n  });\n}\ndraw();" },
  { id: "story", icon: "\ud83d\udcdc", name: "Story", desc: "Branching choose-your-own-adventure",
    code: "// Choose Your Own Adventure\nconst story = {\n  start: {\n    text: \"You stand at a crossroads in a dark forest. The path forks ahead.\",\n    choices: [{ text: \"Take the left path\", next: \"left\" }, { text: \"Take the right path\", next: \"right\" }]\n  },\n  left: {\n    text: \"You find a glowing chest! Inside is 100 STEEM. Lucky!\",\n    choices: [{ text: \"Return to start\", next: \"start\" }]\n  },\n  right: {\n    text: \"You encounter a troll. He demands a riddle: what has keys but no locks?\",\n    choices: [{ text: \"A piano!\", next: \"win\" }, { text: \"A map!\", next: \"lose\" }]\n  },\n  win: {\n    text: \"Correct! The troll bows and lets you pass to the treasure vault: 500 STEEM!\",\n    choices: [{ text: \"Play again\", next: \"start\" }]\n  },\n  lose: {\n    text: \"Wrong! The troll eats your sandwich and chases you away.\",\n    choices: [{ text: \"Try again\", next: \"start\" }]\n  }\n};\nlet scene = \"start\";\n\nfunction draw() {\n  const s = story[scene];\n  const choices = s.choices.map((c, i) =>\n    \"<button id='ch\" + i + \"' style='display:block;width:100%;text-align:left;\" +\n    \"padding:8px 12px;margin:4px 0;border-radius:8px;border:1px solid #3b1f5e;\" +\n    \"background:#1a1030;color:#e8e0f0;font-size:13px;'>\" + c.text + \"</button>\"\n  ).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-size:14px;color:#e8e0f0;line-height:1.6;margin-bottom:12px;\" +\n    \"padding:10px;background:#0f0a1e;border-radius:8px;border:1px solid #2e2050;'>\" + s.text + \"</div>\" +\n    \"<div>\" + choices + \"</div></div>\"\n  );\n  s.choices.forEach((c, i) => {\n    const b = document.getElementById(\"ch\" + i);\n    if (b) b.onclick = () => { scene = c.next; draw(); };\n  });\n}\ndraw();" },
  { id: "demo", icon: "\ud83d\udcbb", name: "Code Demo", desc: "Step-by-step algorithm visualizer",
    code: "// Bubble Sort Visualizer\nconst arr = [64, 34, 25, 12, 22, 11, 90];\nlet steps = [], stepIdx = 0;\n\nfunction generateSteps() {\n  const a = [...arr];\n  steps = [{ arr: [...a], msg: \"Initial array\" }];\n  for (let i = 0; i < a.length - 1; i++) {\n    for (let j = 0; j < a.length - i - 1; j++) {\n      if (a[j] > a[j+1]) {\n        [a[j], a[j+1]] = [a[j+1], a[j]];\n        steps.push({ arr: [...a], msg: \"Swapped positions \" + j + \" and \" + (j+1) });\n      }\n    }\n  }\n  steps.push({ arr: [...a], msg: \"Sorted!\" });\n}\ngenerateSteps();\n\nfunction draw() {\n  const s = steps[stepIdx];\n  const max = Math.max(...s.arr);\n  const bars = s.arr.map(v =>\n    \"<div style='display:inline-flex;flex-direction:column;align-items:center;margin:0 3px;'>\" +\n    \"<div style='width:28px;background:linear-gradient(135deg,#6d28d9,#a855f7);border-radius:4px 4px 0 0;height:\" + Math.round(v/max*120) + \"px;'></div>\" +\n    \"<div style='font-size:11px;color:#9b8db0;margin-top:2px;'>\" + v + \"</div></div>\"\n  ).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-weight:600;color:#c084fc;margin-bottom:6px;'>Bubble Sort</div>\" +\n    \"<div style='display:flex;align-items:flex-end;height:140px;padding:0 4px;margin-bottom:8px;border-bottom:1px solid #2e2050;'>\" + bars + \"</div>\" +\n    \"<div style='font-size:12px;color:#9b8db0;margin-bottom:8px;'>Step \" + (stepIdx+1) + \"/\" + steps.length + \": \" + s.msg + \"</div>\" +\n    \"<div style='display:flex;gap:6px;'>\" +\n    \"<button id='prev' style='padding:4px 12px;font-size:12px;background:#1a1030;border:1px solid #3b1f5e;color:#9b8db0;'\" + (stepIdx===0?\" disabled\":\"\") + \">Prev</button>\" +\n    \"<button id='next' style='padding:4px 12px;font-size:12px;'\" + (stepIdx===steps.length-1?\" disabled\":\"\") + \">Next</button>\" +\n    \"</div></div>\"\n  );\n  const prev = document.getElementById(\"prev\");\n  const next = document.getElementById(\"next\");\n  if (prev) prev.onclick = () => { if (stepIdx > 0) { stepIdx--; draw(); } };\n  if (next) next.onclick = () => { if (stepIdx < steps.length-1) { stepIdx++; draw(); } };\n}\ndraw();" },
  { id: "explorer", icon: "\ud83d\udd0d", name: "Data Explorer", desc: "Filterable and sortable local dataset",
    code: "// Data Explorer \u2014 filter and sort a local dataset\nconst data = [\n  { name: \"Bitcoin\",  symbol: \"BTC\",   price: 65000, change: 2.4  },\n  { name: \"Ethereum\", symbol: \"ETH\",   price: 3200,  change: -1.2 },\n  { name: \"Steem\",    symbol: \"STEEM\", price: 0.28,  change: 5.7  },\n  { name: \"Litecoin\", symbol: \"LTC\",   price: 85,    change: 0.9  },\n  { name: \"Cardano\",  symbol: \"ADA\",   price: 0.45,  change: -0.8 },\n  { name: \"Solana\",   symbol: \"SOL\",   price: 142,   change: 3.1  }\n];\nlet query = \"\", sortBy = \"name\", sortDir = 1;\n\nfunction draw() {\n  const q = query.toLowerCase();\n  let rows = data\n    .filter(d => d.name.toLowerCase().includes(q) || d.symbol.toLowerCase().includes(q))\n    .sort((a, b) => {\n      const av = a[sortBy], bv = b[sortBy];\n      return typeof av === \"string\" ? av.localeCompare(bv) * sortDir : (av - bv) * sortDir;\n    });\n  const cols = [\"name\",\"symbol\",\"price\",\"change\"];\n  const headers = cols.map(c =>\n    \"<th id='h_\" + c + \"' style='padding:6px 8px;text-align:left;color:#a855f7;cursor:pointer;font-size:12px;'>\" +\n    c[0].toUpperCase() + c.slice(1) + (sortBy===c ? (sortDir===1?\" ^\":\" v\") : \"\") + \"</th>\"\n  ).join(\"\");\n  const rowsHtml = rows.map(d =>\n    \"<tr style='border-bottom:1px solid #2e2050;'>\" +\n    \"<td style='padding:5px 8px;color:#e8e0f0;font-size:13px;'>\" + d.name + \"</td>\" +\n    \"<td style='padding:5px 8px;color:#9b8db0;font-size:12px;'>\" + d.symbol + \"</td>\" +\n    \"<td style='padding:5px 8px;color:#e8e0f0;font-size:13px;'>$\" + d.price.toLocaleString() + \"</td>\" +\n    \"<td style='padding:5px 8px;color:\" + (d.change >= 0 ? \"#4ade80\" : \"#fca5a5\") + \";font-size:13px;'>\" +\n    (d.change >= 0 ? \"+\" : \"\") + d.change + \"%</td></tr>\"\n  ).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<input id='q' type='text' placeholder='Search...' value='\" + query.replace(/'/g, \"\") + \"' style='width:100%;margin-bottom:8px;box-sizing:border-box;'>\" +\n    \"<table style='width:100%;border-collapse:collapse;'><thead><tr>\" + headers + \"</tr></thead>\" +\n    \"<tbody>\" + rowsHtml + \"</tbody></table></div>\"\n  );\n  document.getElementById(\"q\").oninput = e => { query = e.target.value; draw(); };\n  cols.forEach(c => {\n    const h = document.getElementById(\"h_\" + c);\n    if (h) h.onclick = () => { sortDir = sortBy===c ? -sortDir : 1; sortBy = c; draw(); };\n  });\n}\ndraw();" },
  { id: "prototype", icon: "\ud83c\udfa8", name: "UI Prototype", desc: "Interactive UI mockup with multiple states",
    code: "// UI Prototype \u2014 dashboard preview with interactive cards\nconst cards = [\n  { title: \"Twist Love\", value: \"2.4K\", icon: \"&#10084;\", trend: \"+12%\", color: \"#e879f9\" },\n  { title: \"Retwists\",   value: \"847\",  icon: \"&#128260;\", trend: \"+8%\",  color: \"#4ade80\" },\n  { title: \"Reputation\", value: \"68\",   icon: \"&#11088;\",  trend: \"+2\",   color: \"#fb923c\" },\n  { title: \"Followers\",  value: \"1.2K\", icon: \"&#128100;\", trend: \"+34\",  color: \"#22d3ee\" }\n];\nlet active = null;\n\nfunction draw() {\n  const grid = cards.map((c, i) => {\n    const on = active === i;\n    return \"<div id='card\" + i + \"' style='background:\" + (on ? \"#2e2050\" : \"#1a1030\") + \";\" +\n      \"border:1px solid \" + (on ? c.color : \"#3b1f5e\") + \";border-radius:10px;padding:12px;cursor:pointer;'>\" +\n      \"<div style='display:flex;justify-content:space-between;align-items:flex-start;'>\" +\n      \"<div><div style='font-size:11px;color:#9b8db0;margin-bottom:4px;'>\" + c.title + \"</div>\" +\n      \"<div style='font-size:20px;font-weight:700;color:#e8e0f0;'>\" + c.value + \"</div></div>\" +\n      \"<span style='font-size:20px;'>\" + c.icon + \"</span></div>\" +\n      \"<div style='font-size:11px;color:\" + c.color + \";margin-top:6px;'>\" + c.trend + \" this month</div></div>\";\n  }).join(\"\");\n  app.render(\n    \"<div style='padding:4px;'>\" +\n    \"<div style='font-weight:600;color:#c084fc;margin-bottom:8px;font-size:13px;'>Dashboard Preview</div>\" +\n    \"<div style='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;'>\" + grid + \"</div>\" +\n    (active !== null\n      ? \"<div style='background:#0f0a1e;border:1px solid \" + cards[active].color + \";border-radius:8px;padding:10px;font-size:12px;color:#9b8db0;'>\" +\n        \"Selected: <b style='color:\" + cards[active].color + \";'>\" + cards[active].title + \"</b> \" + cards[active].value + \" (\" + cards[active].trend + \")</div>\"\n      : \"<div style='font-size:12px;color:#5a4e70;font-style:italic;'>Click a card to inspect</div>\"\n    ) + \"</div>\"\n  );\n  cards.forEach((_, i) => {\n    const el = document.getElementById(\"card\" + i);\n    if (el) el.onclick = () => { active = active===i ? null : i; draw(); };\n  });\n}\ndraw();" },
];

// ---- Greeting / celebration card templates ----
const LIVE_TWIST_GREETINGS = [
  { id: "birthday", icon: "🎂", name: "Birthday Card", desc: "Animated birthday cake with candles",
    code: `let blown = false;
function draw() {
  const flames = blown ? "" : "🕯️🕯️🕯️🕯️🕯️";
  const msg = blown ? "<div style='font-size:20px;color:#4ade80;margin-top:12px;'>🎉 Happy Birthday! 🎉</div>" : "";
  app.render(
    "<div style='text-align:center;padding:12px;'>" +
    "<div style='font-size:48px;'>🎂</div>" +
    "<div style='font-size:22px;margin:4px 0;'>" + flames + "</div>" +
    "<div style='color:#c084fc;font-size:15px;font-weight:600;margin-top:8px;'>🎈 Happy Birthday! 🎈</div>" +
    msg +
    (!blown ? "<button id='blow' style='margin-top:12px;'>💨 Blow out candles!</button>" : "") +
    "</div>"
  );
  if (!blown) {
    const b = document.getElementById("blow");
    if (b) b.onclick = () => { blown = true; draw(); };
  }
}
draw();` },
  { id: "newyear", icon: "🎆", name: "New Year Card", desc: "Countdown and fireworks greeting",
    code: `let launched = false;
const colors = ["#f87171","#fb923c","#facc15","#4ade80","#38bdf8","#a78bfa","#f472b6"];
function firework() {
  const sparks = Array.from({length:12},(_,i)=>{
    const angle = i*30, r = 60 + Math.random()*30;
    const x = 50 + r*Math.cos(angle*Math.PI/180);
    const y = 50 + r*Math.sin(angle*Math.PI/180);
    const c = colors[i%colors.length];
    return "<div style='position:absolute;width:8px;height:8px;border-radius:50%;background:"+c+";left:"+x+"px;top:"+y+"px;'></div>";
  }).join("");
  return "<div style='position:relative;width:160px;height:160px;margin:0 auto;'>"+sparks+"<div style='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:28px;'>🎆</div></div>";
}
function draw() {
  app.render(
    "<div style='text-align:center;padding:8px;'>" +
    (launched ? firework() : "<div style='font-size:48px;margin-bottom:8px;'>🎆</div>") +
    "<div style='color:#facc15;font-size:16px;font-weight:700;margin:8px 0;'>🥂 Happy New Year! 🥂</div>" +
    (!launched ? "<button id='launch'>🎇 Launch fireworks!</button>" : "<div style='color:#4ade80;font-size:13px;margin-top:8px;'>Wishing you a wonderful year ahead!</div>") +
    "</div>"
  );
  if (!launched) {
    const b = document.getElementById("launch");
    if (b) b.onclick = () => { launched = true; draw(); };
  }
}
draw();` },
  { id: "congrats", icon: "🏆", name: "Congratulations", desc: "Trophy reveal with confetti burst",
    code: `let revealed = false;
function confetti() {
  return Array.from({length:20},()=>{
    const left = Math.random()*100;
    const emojis = ["🎊","🎉","⭐","✨","🌟"];
    return "<span style='position:absolute;left:"+left+"%;" +
           "top:"+(Math.random()*80)+"%;" +
           "font-size:"+(12+Math.random()*16)+"px;'>" +
           emojis[Math.floor(Math.random()*emojis.length)] + "</span>";
  }).join("");
}
function draw() {
  app.render(
    "<div style='text-align:center;padding:12px;position:relative;min-height:140px;'>" +
    (revealed ? "<div style='position:absolute;inset:0;overflow:hidden;'>" + confetti() + "</div>" : "") +
    "<div style='position:relative;'>" +
    "<div style='font-size:"+(revealed?52:36)+"px;transition:font-size 0.3s;'>" + (revealed?"🏆":"🎁") + "</div>" +
    (revealed
      ? "<div style='color:#facc15;font-size:16px;font-weight:700;margin-top:8px;'>🎉 Congratulations! 🎉</div><div style='color:#9b8db0;font-size:13px;margin-top:4px;'>You deserve this!</div>"
      : "<button id='reveal' style='margin-top:10px;'>🎁 Reveal your surprise!</button>") +
    "</div></div>"
  );
  if (!revealed) {
    const b = document.getElementById("reveal");
    if (b) b.onclick = () => { revealed = true; draw(); };
  }
}
draw();` },
  { id: "wedding", icon: "💍", name: "Wedding Card", desc: "Heartfelt animated wedding greeting",
    code: `let hearts = [];
let frame = 0;
function addHeart() {
  hearts.push({ x: 20+Math.random()*60, y: 100, age: 0, size: 14+Math.random()*14 });
}
function tick() {
  frame++;
  if (frame % 12 === 0) addHeart();
  hearts = hearts.filter(h => h.age < 40);
  hearts.forEach(h => { h.y -= 1.5; h.age++; });
  const floaters = hearts.map(h =>
    "<span style='position:absolute;left:"+h.x+"%;top:"+h.y+"%;font-size:"+h.size+"px;opacity:"+(1-h.age/40)+";'>❤️</span>"
  ).join("");
  app.render(
    "<div style='text-align:center;padding:12px;position:relative;min-height:150px;overflow:hidden;'>" +
    "<div style='position:absolute;inset:0;'>" + floaters + "</div>" +
    "<div style='position:relative;'>" +
    "<div style='font-size:40px;'>💍</div>" +
    "<div style='color:#f472b6;font-size:15px;font-weight:700;margin-top:8px;'>💒 Wishing you a lifetime of love!</div>" +
    "<div style='color:#9b8db0;font-size:12px;margin-top:4px;'>Congratulations on your wedding day 🌸</div>" +
    "</div></div>"
  );
}
setInterval(tick, 80);
tick();` },
  { id: "graduation", icon: "🎓", name: "Graduation Card", desc: "Cap toss and achievement celebration",
    code: `let tossed = false, caps = [];
function draw() {
  if (tossed) {
    caps = caps.map(c => ({...c, y: c.y - 3, rot: c.rot+8, age: c.age+1})).filter(c=>c.age<40);
    if (caps.length < 15) caps.push({x:20+Math.random()*60, y:80, rot:Math.random()*360, age:0});
  }
  const capHtml = caps.map(c =>
    "<span style='position:absolute;left:"+c.x+"%;top:"+c.y+"%;font-size:20px;transform:rotate("+c.rot+"deg);opacity:"+(1-c.age/40)+";'>🎓</span>"
  ).join("");
  app.render(
    "<div style='text-align:center;padding:12px;position:relative;min-height:150px;overflow:hidden;'>" +
    "<div style='position:absolute;inset:0;'>" + capHtml + "</div>" +
    "<div style='position:relative;'>" +
    "<div style='font-size:44px;'>🎓</div>" +
    "<div style='color:#a78bfa;font-size:15px;font-weight:700;margin-top:8px;'>Congratulations, Graduate!</div>" +
    "<div style='color:#9b8db0;font-size:12px;margin-top:4px;'>Your hard work paid off 🌟</div>" +
    (!tossed ? "<button id='toss' style='margin-top:10px;'>🎓 Toss the cap!</button>" : "") +
    "</div></div>"
  );
  if (!tossed) {
    const b = document.getElementById("toss");
    if (b) b.onclick = () => { tossed = true; setInterval(draw, 60); };
  }
}
draw();` },
  { id: "eid", icon: "🌙", name: "Eid Mubarak", desc: "Eid celebration card with crescent and stars",
    code: `let stars = Array.from({length:20},()=>({x:Math.random()*90,y:Math.random()*60,t:Math.random()*Math.PI*2,s:10+Math.random()*14}));
let t = 0;
function draw() {
  t += 0.05;
  const starHtml = stars.map(s =>
    "<span style='position:absolute;left:"+s.x+"%;top:"+s.y+"%;font-size:"+s.s+"px;opacity:"+(0.4+0.6*Math.abs(Math.sin(s.t+t)))+";'>✨</span>"
  ).join("");
  app.render(
    "<div style='text-align:center;padding:12px;position:relative;min-height:160px;background:#0a0a2e;border-radius:8px;overflow:hidden;'>" +
    "<div style='position:absolute;inset:0;'>" + starHtml + "</div>" +
    "<div style='position:relative;'>" +
    "<div style='font-size:48px;margin-bottom:4px;'>🌙</div>" +
    "<div style='color:#facc15;font-size:18px;font-weight:700;'>Eid Mubarak!</div>" +
    "<div style='color:#fde68a;font-size:13px;margin-top:6px;'>عيد مبارك</div>" +
    "<div style='color:#9b8db0;font-size:12px;margin-top:8px;'>Wishing you peace, joy, and blessings 🌟</div>" +
    "</div></div>"
  );
}
setInterval(draw, 60);
draw();` },
  { id: "christmas", icon: "🎄", name: "Christmas Card", desc: "Festive tree with falling snow",
    code: `let snow = Array.from({length:25},()=>({x:Math.random()*100,y:Math.random()*100,s:8+Math.random()*10,spd:0.3+Math.random()*0.7}));
function draw() {
  snow.forEach(f=>{f.y+=f.spd;if(f.y>102){f.y=0;f.x=Math.random()*100;}});
  const flakes = snow.map(f=>"<span style='position:absolute;left:"+f.x+"%;top:"+f.y+"%;font-size:"+f.s+"px;opacity:0.8;'>❄️</span>").join("");
  app.render(
    "<div style='text-align:center;padding:12px;position:relative;min-height:160px;background:#0c1a2e;border-radius:8px;overflow:hidden;'>" +
    "<div style='position:absolute;inset:0;'>" + flakes + "</div>" +
    "<div style='position:relative;'>" +
    "<div style='font-size:52px;'>🎄</div>" +
    "<div style='color:#4ade80;font-size:16px;font-weight:700;margin-top:4px;'>Merry Christmas!</div>" +
    "<div style='color:#fde68a;font-size:12px;margin-top:6px;'>Wishing you warmth, joy &amp; peace ☃️</div>" +
    "</div></div>"
  );
}
setInterval(draw, 60);
draw();` },
  { id: "thankyou", icon: "🙏", name: "Thank You Card", desc: "Warm animated thank-you message",
    code: `const msgs = ["You made a difference!","Your kindness matters.","So grateful for you!","This means so much!","From the bottom of my heart ❤️"];
let idx = 0, fade = 1, dir = -1;
function draw() {
  fade += dir * 0.03;
  if (fade <= 0) { dir = 1; idx = (idx+1)%msgs.length; }
  if (fade >= 1) dir = -1;
  app.render(
    "<div style='text-align:center;padding:16px;'>" +
    "<div style='font-size:48px;margin-bottom:8px;'>🙏</div>" +
    "<div style='color:#f472b6;font-size:18px;font-weight:700;margin-bottom:12px;'>Thank You!</div>" +
    "<div style='color:#e8e0f0;font-size:14px;opacity:"+Math.max(0,fade)+";min-height:24px;'>"+msgs[idx]+"</div>" +
    "<div style='color:#5a4e70;font-size:11px;margin-top:10px;'>With gratitude 💜</div>" +
    "</div>"
  );
}
setInterval(draw, 50);
draw();` },
  { id: "getwell", icon: "🌻", name: "Get Well Card", desc: "Cheerful get-well-soon message with blooming flower",
    code: `let petals = 0, maxPetals = 8, bloomed = false;
const angles = Array.from({length:8},(_,i)=>i*45);
function draw() {
  if (!bloomed && petals < maxPetals) { petals++; setTimeout(draw, 150); }
  const flower = angles.slice(0,petals).map(a=>{
    const x = 50+28*Math.cos(a*Math.PI/180), y = 50+28*Math.sin(a*Math.PI/180);
    return "<div style='position:absolute;width:18px;height:18px;border-radius:50%;background:#fbbf24;left:"+x+"px;top:"+y+"px;transform:translate(-50%,-50%);'></div>";
  }).join("");
  app.render(
    "<div style='text-align:center;padding:12px;'>" +
    "<div style='position:relative;width:100px;height:100px;margin:0 auto 8px;'>" +
    flower +
    "<div style='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:28px;'>🌻</div>" +
    "</div>" +
    "<div style='color:#4ade80;font-size:16px;font-weight:700;'>Get Well Soon! 💚</div>" +
    "<div style='color:#9b8db0;font-size:12px;margin-top:6px;'>Sending you healing thoughts and warm wishes 🌸</div>" +
    "</div>"
  );
  if (petals >= maxPetals) bloomed = true;
}
draw();` },
  { id: "anniversary", icon: "💑", name: "Anniversary Card", desc: "Heart pulse animation for anniversaries",
    code: `let pulse = 1, dir = 1;
function draw() {
  pulse += dir * 0.015;
  if (pulse > 1.18) dir = -1;
  if (pulse < 0.88) dir = 1;
  const years = ["1st","2nd","3rd","5th","10th","25th","50th"];
  app.render(
    "<div style='text-align:center;padding:16px;'>" +
    "<div style='font-size:54px;display:inline-block;transform:scale("+pulse+");transition:transform 0.05s;'>❤️</div>" +
    "<div style='color:#f472b6;font-size:17px;font-weight:700;margin-top:10px;'>Happy Anniversary!</div>" +
    "<div style='color:#9b8db0;font-size:13px;margin-top:6px;'>Here's to many more beautiful years together 💑</div>" +
    "<div style='margin-top:12px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;'>" +
    years.map(y=>"<span style='background:#3b0764;color:#d8b4fe;border-radius:20px;padding:3px 10px;font-size:11px;cursor:pointer;'>"+y+"</span>").join("") +
    "</div></div>"
  );
}
setInterval(draw, 40);
draw();` }
];

// ---- Blockchain query example templates ----
const LIVE_TWIST_QUERIES = [
  { id: "q_account", icon: "👤", name: "Account Info", desc: "Fetch and display a Steem account profile",
    code: `let result = null, loading = false, searched = false;
let query = "steemtwist";
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>Account Lookup</div>" +
    "<div style='display:flex;gap:6px;margin-bottom:10px;'>" +
    "<input id='u' type='text' placeholder='Steem username' value='" + query + "' style='flex:1;'>" +
    "<button id='go'>Look up</button></div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     !searched ? "" :
     !result ? "<div style='color:#fca5a5;'>Account not found.</div>" :
     "<div style='background:#1a1030;border-radius:8px;padding:10px;border:1px solid #3b1f5e;'>" +
     "<div style='font-size:15px;font-weight:600;color:#e8e0f0;'>" + result.name + "</div>" +
     "<div style='font-size:12px;color:#9b8db0;margin-top:4px;'>Reputation: <b style='color:#c084fc;'>" + (result.reputation||0) + "</b></div>" +
     "<div style='font-size:12px;color:#9b8db0;'>Posts: <b style='color:#e8e0f0;'>" + (result.post_count||0) + "</b></div>" +
     "<div style='font-size:12px;color:#9b8db0;margin-top:4px;word-break:break-all;'>" + ((result.posting_json_metadata&&JSON.parse(result.posting_json_metadata||'{}').profile)||{}).about || "" + "</div>" +
     "</div>") +
    "</div>"
  );
  document.getElementById("go").onclick = () => {
    query = document.getElementById("u").value.trim().toLowerCase();
    if (!query) return;
    loading = true; searched = true; result = null; draw();
    app.query("getAccounts", { names: [query] });
  };
}
app.onResult((ok, data) => {
  loading = false;
  result = (ok && Array.isArray(data) && data[0]) ? data[0] : null;
  draw();
});
draw();` },
  { id: "q_trending", icon: "🔥", name: "Trending Tags", desc: "Show the current top trending Steem tags",
    code: `let tags = [], loading = true;
app.query("getTrendingTags", { afterTag: "", limit: 12 });
app.onResult((ok, data) => {
  loading = false;
  tags = ok && Array.isArray(data) ? data : [];
  draw();
});
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>🔥 Trending Tags</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     "<div style='display:flex;flex-wrap:wrap;gap:6px;'>" +
     tags.map((t,i)=>"<span style='background:#"+(i<3?"7c3aed":"1a1030")+";color:#"+(i<3?"fff":"c084fc")+";border:1px solid #3b1f5e;border-radius:20px;padding:3px 10px;font-size:12px;'>#"+t.name+" <span style='opacity:0.6;font-size:10px;'>"+t.top_posts+"</span></span>").join("") +
     "</div>") +
    "</div>"
  );
}
draw();` },
  { id: "q_price", icon: "💱", name: "STEEM Price", desc: "Live STEEM/SBD market ticker",
    code: `let ticker = null, loading = true;
function load() {
  loading = true; draw();
  app.query("getTicker", {});
}
app.onResult((ok, data) => {
  loading = false;
  ticker = ok ? data : null;
  draw();
});
function draw() {
  const latest = ticker ? parseFloat(ticker.latest).toFixed(6) : "—";
  const sbd_vol = ticker ? parseFloat(ticker.sbd_volume).toFixed(2) : "—";
  const steem_vol = ticker ? parseFloat(ticker.steem_volume).toFixed(2) : "—";
  const pct = ticker ? parseFloat(ticker.percent_change).toFixed(2) : "—";
  const up = ticker && parseFloat(ticker.percent_change) >= 0;
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:10px;'>💱 STEEM / SBD Market</div>" +
    (loading ? "<div style='color:#9b8db0;'>Fetching…</div>" :
     !ticker ? "<div style='color:#fca5a5;'>Could not load ticker.</div>" :
     "<div style='background:#0f0a1e;border-radius:8px;padding:10px;border:1px solid #3b1f5e;'>" +
     "<div style='font-size:22px;font-weight:700;color:#e8e0f0;'>" + latest + " <span style='font-size:13px;color:#9b8db0;'>SBD/STEEM</span></div>" +
     "<div style='font-size:13px;color:"+(up?"#4ade80":"#f87171")+";margin-top:4px;'>"+(up?"▲":"▼")+" "+pct+"%</div>" +
     "<div style='font-size:12px;color:#9b8db0;margin-top:6px;'>STEEM vol: <b style='color:#e8e0f0;'>"+steem_vol+"</b> &nbsp; SBD vol: <b style='color:#e8e0f0;'>"+sbd_vol+"</b></div>" +
     "</div>") +
    "<button id='r' style='margin-top:8px;font-size:12px;'>⟳ Refresh</button>" +
    "</div>"
  );
  const r = document.getElementById("r");
  if (r) r.onclick = load;
}
load();` },
  { id: "q_posts", icon: "📰", name: "Hot Posts", desc: "Show current hot posts from a tag",
    code: `let posts = [], loading = true, tag = "steem";
function load(t) {
  tag = t; loading = true; draw();
  app.query("getDiscussionsByHot", { query: { tag, limit: 5 } });
}
app.onResult((ok, data) => {
  loading = false;
  posts = ok && Array.isArray(data) ? data : [];
  draw();
});
const tags = ["steem","steemit","photography","life","crypto"];
let selTag = "steem";
function draw() {
  const tagBtns = tags.map(t =>
    "<button id='t_"+t+"' style='font-size:11px;padding:3px 8px;background:"+(selTag===t?"#6d28d9":"#1a1030")+";border:1px solid #3b1f5e;border-radius:12px;margin:2px;'>"+t+"</button>"
  ).join("");
  const postHtml = posts.map(p =>
    "<div style='padding:8px 0;border-bottom:1px solid #2e2050;'>" +
    "<div style='font-size:13px;font-weight:600;color:#e8e0f0;'>" + p.title.slice(0,60) + "</div>" +
    "<div style='font-size:11px;color:#9b8db0;margin-top:2px;'>@"+p.author+" &nbsp;❤️ "+p.net_votes+"</div>" +
    "</div>"
  ).join("");
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:6px;'>📰 Hot Posts</div>" +
    "<div style='margin-bottom:8px;'>" + tagBtns + "</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     posts.length === 0 ? "<div style='color:#5a4e70;'>No posts found.</div>" :
     "<div>" + postHtml + "</div>") +
    "</div>"
  );
  tags.forEach(t => {
    const b = document.getElementById("t_"+t);
    if (b) b.onclick = () => { selTag = t; load(t); };
  });
}
load(selTag);` },
  { id: "q_followers", icon: "👥", name: "Follower Count", desc: "Check follow counts for any Steem account",
    code: `let fc = null, loading = false, searched = false, qname = "steemtwist";
function search() {
  loading = true; searched = true; fc = null; draw();
  app.query("getFollowCount", { account: qname });
}
app.onResult((ok, data) => {
  loading = false;
  fc = ok ? data : null;
  draw();
});
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>👥 Follow Count</div>" +
    "<div style='display:flex;gap:6px;margin-bottom:10px;'>" +
    "<input id='n' type='text' placeholder='username' value='" + qname + "' style='flex:1;'>" +
    "<button id='go'>Check</button></div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     !searched ? "" :
     !fc ? "<div style='color:#fca5a5;'>Not found.</div>" :
     "<div style='display:flex;gap:10px;justify-content:center;margin-top:4px;'>" +
     "<div style='background:#1a1030;border:1px solid #3b1f5e;border-radius:10px;padding:12px 20px;text-align:center;'><div style='font-size:22px;font-weight:700;color:#c084fc;'>"+fc.follower_count+"</div><div style='font-size:11px;color:#9b8db0;'>Followers</div></div>" +
     "<div style='background:#1a1030;border:1px solid #3b1f5e;border-radius:10px;padding:12px 20px;text-align:center;'><div style='font-size:22px;font-weight:700;color:#4ade80;'>"+fc.following_count+"</div><div style='font-size:11px;color:#9b8db0;'>Following</div></div>" +
     "</div>") +
    "</div>"
  );
  const go = document.getElementById("go");
  if (go) go.onclick = () => { qname = document.getElementById("n").value.trim(); search(); };
}
draw();` },
  { id: "q_witnesses", icon: "⚙️", name: "Top Witnesses", desc: "Display the current top Steem witnesses",
    code: `let witnesses = [], loading = true;
app.query("getWitnessesByVote", { from: "", limit: 10 });
app.onResult((ok, data) => {
  loading = false;
  witnesses = ok && Array.isArray(data) ? data : [];
  draw();
});
function draw() {
  const rows = witnesses.map((w,i) =>
    "<div style='display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #2e2050;'>" +
    "<span style='color:#5a4e70;font-size:11px;width:18px;text-align:right;'>#"+(i+1)+"</span>" +
    "<span style='color:#e8e0f0;font-size:13px;font-weight:600;flex:1;'>@"+w.owner+"</span>" +
    "<span style='font-size:11px;color:#9b8db0;'>"+parseInt(w.votes/1e9).toLocaleString()+"B VP</span>" +
    "</div>"
  ).join("");
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>⚙️ Top 10 Witnesses</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" : rows) +
    "</div>"
  );
}
draw();` },
  { id: "q_blockchain", icon: "⛓️", name: "Chain Stats", desc: "Show live Steem blockchain global properties",
    code: `let props = null, loading = true;
function load() { loading = true; draw(); app.query("getDynamicGlobalProperties", {}); }
app.onResult((ok, data) => {
  loading = false; props = ok ? data : null; draw();
});
function draw() {
  const p = props;
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>⛓️ Chain Stats</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     !p ? "<div style='color:#fca5a5;'>Could not load.</div>" :
     "<div style='display:grid;grid-template-columns:1fr 1fr;gap:6px;'>" +
     [["Block", "#"+Number(p.head_block_number).toLocaleString()],
      ["Time", p.time ? p.time.slice(11,19)+" UTC" : "—"],
      ["Supply", parseFloat(p.current_supply).toFixed(0)+" STEEM"],
      ["SBD", parseFloat(p.current_sbd_supply||0).toFixed(0)+" SBD"],
      ["Witnesses", p.num_pow_witnesses],
      ["Accounts", Number(p.recent_slots_filled||0)]
     ].map(([k,v])=>
       "<div style='background:#1a1030;border:1px solid #2e2050;border-radius:8px;padding:7px 10px;'>" +
       "<div style='font-size:10px;color:#9b8db0;'>"+k+"</div>" +
       "<div style='font-size:13px;font-weight:600;color:#e8e0f0;'>"+v+"</div></div>"
     ).join("") + "</div>") +
    "<button id='r' style='margin-top:8px;font-size:12px;'>⟳ Refresh</button>" +
    "</div>"
  );
  const r = document.getElementById("r");
  if (r) r.onclick = load;
}
load();` },
  { id: "q_content", icon: "📄", name: "Post Viewer", desc: "Fetch and display any Steem post by author and permlink",
    code: `let post = null, loading = false, searched = false;
let pAuthor = "steemtwist", pPermlink = "feed-2026-03";
function load() {
  loading = true; searched = true; post = null; draw();
  app.query("getContent", { author: pAuthor, permlink: pPermlink });
}
app.onResult((ok, data) => {
  loading = false;
  post = (ok && data && data.author) ? data : null;
  draw();
});
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>📄 Post Viewer</div>" +
    "<input id='a' type='text' placeholder='author' value='" + pAuthor + "' style='margin-bottom:6px;'>" +
    "<input id='p' type='text' placeholder='permlink' value='" + pPermlink + "' style='margin-bottom:6px;'>" +
    "<button id='go'>Fetch</button>" +
    (loading ? "<div style='color:#9b8db0;margin-top:8px;'>Loading…</div>" :
     !searched ? "" :
     !post ? "<div style='color:#fca5a5;margin-top:8px;'>Post not found.</div>" :
     "<div style='margin-top:8px;background:#1a1030;border:1px solid #2e2050;border-radius:8px;padding:8px;'>" +
     "<div style='font-size:13px;font-weight:600;color:#e8e0f0;'>" + post.title + "</div>" +
     "<div style='font-size:11px;color:#9b8db0;margin:3px 0;'>@"+post.author+" &nbsp;❤️ "+post.net_votes+" &nbsp;💬 "+post.children+"</div>" +
     "<div style='font-size:12px;color:#c0b0e0;margin-top:4px;max-height:80px;overflow-y:auto;'>"+post.body.slice(0,300).replace(/[<>]/g,"")+"…</div>" +
     "</div>") +
    "</div>"
  );
  document.getElementById("go").onclick = () => {
    pAuthor = document.getElementById("a").value.trim();
    pPermlink = document.getElementById("p").value.trim();
    load();
  };
}
draw();` },
  { id: "q_orderbook", icon: "📊", name: "Order Book", desc: "View the STEEM internal market order book",
    code: `let book = null, loading = true;
function load() { loading = true; draw(); app.query("getOrderBook", { limit: 5 }); }
app.onResult((ok, data) => {
  loading = false; book = ok ? data : null; draw();
});
function draw() {
  function rows(list, color) {
    return (list||[]).slice(0,5).map(o=>
      "<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:12px;'>" +
      "<span style='color:"+color+";'>" + parseFloat(o.real_price||o.order_price||0).toFixed(5) + "</span>" +
      "<span style='color:#9b8db0;'>" + parseFloat(o.steem||o.steem_sat||0).toFixed(2) + " S</span>" +
      "<span style='color:#9b8db0;'>" + parseFloat(o.sbd||o.sbd_sat||0).toFixed(2) + " SBD</span>" +
      "</div>"
    ).join("");
  }
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>📊 STEEM Order Book</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     !book ? "<div style='color:#fca5a5;'>Could not load.</div>" :
     "<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;'>" +
     "<div><div style='font-size:11px;color:#4ade80;font-weight:600;margin-bottom:4px;'>BIDS (buy)</div>"+rows(book.bids,"#4ade80")+"</div>" +
     "<div><div style='font-size:11px;color:#f87171;font-weight:600;margin-bottom:4px;'>ASKS (sell)</div>"+rows(book.asks,"#f87171")+"</div>" +
     "</div>") +
    "<button id='r' style='margin-top:8px;font-size:12px;'>⟳ Refresh</button>" +
    "</div>"
  );
  const r = document.getElementById("r");
  if (r) r.onclick = load;
}
load();` },
  { id: "q_rewardpool", icon: "💰", name: "Reward Pool", desc: "Show the current Steem reward fund details",
    code: `let fund = null, loading = true;
app.query("getRewardFund", { name: "post" });
app.onResult((ok, data) => {
  loading = false; fund = ok ? data : null; draw();
});
function draw() {
  const f = fund;
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>💰 Reward Fund</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     !f ? "<div style='color:#fca5a5;'>Could not load.</div>" :
     "<div style='display:grid;gap:6px;'>" +
     [["Name", f.name],
      ["Reward Balance", parseFloat(f.reward_balance).toFixed(2)+" STEEM"],
      ["Recent Claims", Number(BigInt(f.recent_claims||0)/BigInt(1e15)).toLocaleString()+"Q"],
      ["Last Update", (f.last_update||"").slice(0,10)]
     ].map(([k,v])=>
       "<div style='display:flex;justify-content:space-between;padding:6px 8px;background:#1a1030;border-radius:6px;border:1px solid #2e2050;'>" +
       "<span style='color:#9b8db0;font-size:12px;'>"+k+"</span>" +
       "<span style='color:#e8e0f0;font-size:12px;font-weight:600;'>"+v+"</span></div>"
     ).join("") + "</div>") +
    "</div>"
  );
}
draw();` }
];

// ---- Blockchain action example templates ----
const LIVE_TWIST_ACTIONS = [
  { id: "a_vote", icon: "❤️", name: "Vote on a Post", desc: "Upvote any post by author and permlink",
    code: `let pAuthor = "", pPermlink = "", weight = 100, done = false, msg = "";
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>❤️ Vote on a Post</div>" +
    "<input id='a' type='text' placeholder='author' value='" + pAuthor + "' style='margin-bottom:6px;'>" +
    "<input id='p' type='text' placeholder='permlink' value='" + pPermlink + "' style='margin-bottom:6px;'>" +
    "<label style='font-size:11px;color:#9b8db0;'>Vote weight: <b style='color:#e8e0f0;'>" + weight + "%</b></label>" +
    "<input id='w' type='range' min='1' max='100' value='" + weight + "' style='width:100%;margin-bottom:8px;accent-color:#a855f7;'>" +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'" + (done?" disabled":"") + ">❤️ Vote</button>" +
    "</div>"
  );
  document.getElementById("w").oninput = e => { weight = +e.target.value; draw(); };
  document.getElementById("go").onclick = () => {
    pAuthor = document.getElementById("a").value.trim();
    pPermlink = document.getElementById("p").value.trim();
    if (!pAuthor || !pPermlink) { msg = "Enter author and permlink."; draw(); return; }
    app.action("vote", { author: pAuthor, permlink: pPermlink, weight: weight * 100 });
  };
}
app.onResult((ok, type) => {
  if (type !== "vote") return;
  done = ok; msg = ok ? "✅ Vote cast successfully!" : "❌ Vote failed.";
  draw();
});
draw();` },
  { id: "a_reply", icon: "💬", name: "Post a Reply", desc: "Reply to a twist with a custom message",
    code: `let pAuthor = "", pPermlink = "", message = "", done = false, msg = "";
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>💬 Post a Reply</div>" +
    "<input id='a' type='text' placeholder='parent author' value='" + pAuthor + "' style='margin-bottom:6px;'>" +
    "<input id='p' type='text' placeholder='parent permlink' value='" + pPermlink + "' style='margin-bottom:6px;'>" +
    "<textarea id='m' placeholder='Your reply…' style='min-height:60px;margin-bottom:8px;'>" + message + "</textarea>" +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'" + (done?" disabled":"") + ">💬 Post Reply</button>" +
    "</div>"
  );
  document.getElementById("go").onclick = () => {
    pAuthor = document.getElementById("a").value.trim();
    pPermlink = document.getElementById("p").value.trim();
    message = document.getElementById("m").value.trim();
    if (!pAuthor || !pPermlink || !message) { msg = "Fill in all fields."; draw(); return; }
    app.action("reply", { parentAuthor: pAuthor, parentPermlink: pPermlink, message });
  };
}
app.onResult((ok, type) => {
  if (type !== "reply") return;
  done = ok; msg = ok ? "✅ Reply posted!" : "❌ Reply failed.";
  draw();
});
draw();` },
  { id: "a_follow", icon: "➕", name: "Follow / Unfollow", desc: "Follow or unfollow a Steem account",
    code: `let target = "", fc = null, done = false, msg = "", mode = "follow";
function lookup() {
  if (!target) return;
  app.query("getFollowCount", { account: target });
}
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>➕ Follow / Unfollow</div>" +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<input id='t' type='text' placeholder='username' value='" + target + "' style='flex:1;'>" +
    "<button id='lu'>Look up</button></div>" +
    (fc ? "<div style='font-size:12px;color:#9b8db0;margin-bottom:8px;'>@"+target+" — Followers: <b style='color:#e8e0f0;'>"+fc.follower_count+"</b></div>" : "") +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<button id='f' style='background:"+(mode==="follow"?"#166534":"#1e1535")+";border:1px solid "+(mode==="follow"?"#4ade80":"#2e2050")+";"+"'>Follow</button>" +
    "<button id='u' style='background:"+(mode==="unfollow"?"#7f1d1d":"#1e1535")+";border:1px solid "+(mode==="unfollow"?"#f87171":"#2e2050")+";"+"'>Unfollow</button>" +
    "</div>" +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'>✓ Confirm " + mode + "</button>" +
    "</div>"
  );
  document.getElementById("lu").onclick = () => { target = document.getElementById("t").value.trim(); fc = null; lookup(); draw(); };
  document.getElementById("f").onclick = () => { mode = "follow"; draw(); };
  document.getElementById("u").onclick = () => { mode = "unfollow"; draw(); };
  document.getElementById("go").onclick = () => {
    target = document.getElementById("t").value.trim();
    if (!target) { msg = "Enter a username."; draw(); return; }
    app.action(mode, { following: target });
  };
}
app.onResult((ok, type) => {
  if (type === "getFollowCount") { fc = ok; draw(); return; }
  if (type === "follow" || type === "unfollow") { done = ok; msg = ok ? "✅ Done!" : "❌ Failed."; draw(); }
});
draw();` },
  { id: "a_transfer", icon: "💸", name: "Transfer STEEM/SBD", desc: "Send STEEM or SBD with an optional memo",
    code: `let to = "", amount = "0.001", currency = "STEEM", memo = "", done = false, msg = "";
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>💸 Transfer</div>" +
    "<input id='to' type='text' placeholder='recipient username' value='" + to + "' style='margin-bottom:6px;'>" +
    "<div style='display:flex;gap:6px;margin-bottom:6px;'>" +
    "<input id='amt' type='number' min='0.001' step='0.001' value='" + amount + "' style='flex:1;'>" +
    "<button id='cs' style='background:"+(currency==="STEEM"?"#6d28d9":"#1e1535")+";padding:5px 10px;'>STEEM</button>" +
    "<button id='cb' style='background:"+(currency==="SBD"?"#6d28d9":"#1e1535")+";padding:5px 10px;'>SBD</button>" +
    "</div>" +
    "<input id='memo' type='text' placeholder='memo (optional)' value='" + memo + "' style='margin-bottom:8px;'>" +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'" + (done?" disabled":"") + ">💸 Send</button>" +
    "</div>"
  );
  document.getElementById("cs").onclick = () => { currency = "STEEM"; draw(); };
  document.getElementById("cb").onclick = () => { currency = "SBD"; draw(); };
  document.getElementById("go").onclick = () => {
    to = document.getElementById("to").value.trim();
    amount = parseFloat(document.getElementById("amt").value).toFixed(3);
    memo = document.getElementById("memo").value.trim();
    if (!to || isNaN(+amount) || +amount <= 0) { msg = "Check recipient and amount."; draw(); return; }
    app.action("transfer", { to, amount, memo, currency });
  };
}
app.onResult((ok, type) => {
  if (type !== "transfer") return;
  done = ok; msg = ok ? "✅ Transfer sent!" : "❌ Transfer failed.";
  draw();
});
draw();` },
  { id: "a_delegate", icon: "🤝", name: "Delegate SP", desc: "Delegate Steem Power to another account",
    code: `let delegatee = "", sp = "1", done = false, msg = "";
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>🤝 Delegate Steem Power</div>" +
    "<input id='d' type='text' placeholder='delegate to (username)' value='" + delegatee + "' style='margin-bottom:6px;'>" +
    "<label style='font-size:11px;color:#9b8db0;display:block;margin-bottom:3px;'>Amount (SP)</label>" +
    "<input id='sp' type='number' min='0' step='1' value='" + sp + "' style='margin-bottom:8px;'>" +
    "<div style='font-size:11px;color:#5a4e70;margin-bottom:8px;'>Set to 0 to cancel an existing delegation.</div>" +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'" + (done?" disabled":"") + ">🤝 Delegate</button>" +
    "</div>"
  );
  document.getElementById("go").onclick = () => {
    delegatee = document.getElementById("d").value.trim();
    sp = document.getElementById("sp").value.trim();
    if (!delegatee) { msg = "Enter a username."; draw(); return; }
    app.action("delegate", { delegatee, amount: sp, unit: "SP" });
  };
}
app.onResult((ok, type) => {
  if (type !== "delegate") return;
  done = ok; msg = ok ? "✅ Delegation updated!" : "❌ Failed.";
  draw();
});
draw();` },
  { id: "a_powerup", icon: "⚡", name: "Power Up", desc: "Convert liquid STEEM to Steem Power",
    code: `let to = "", amount = "1", done = false, msg = "";
let props = null;
app.query("getDynamicGlobalProperties", {});
app.onResult((ok, data) => {
  if (ok && data && data.current_supply) {
    props = data;
    draw();
    return;
  }
  if (typeof ok === "boolean") {
    done = ok; msg = ok ? "✅ Power Up successful!" : "❌ Power Up failed.";
    draw();
  }
});
function draw() {
  const supply = props ? parseFloat(props.current_supply).toFixed(0) + " STEEM in circulation" : "";
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>⚡ Power Up STEEM</div>" +
    "<input id='to' type='text' placeholder='power up to (username)' value='" + to + "' style='margin-bottom:6px;'>" +
    "<input id='amt' type='number' min='0.001' step='1' value='" + amount + "' placeholder='amount in STEEM' style='margin-bottom:6px;'>" +
    (supply ? "<div style='font-size:11px;color:#5a4e70;margin-bottom:8px;'>"+supply+"</div>" : "") +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'" + (done?" disabled":"") + ">⚡ Power Up</button>" +
    "</div>"
  );
  document.getElementById("go").onclick = () => {
    to = document.getElementById("to").value.trim();
    amount = parseFloat(document.getElementById("amt").value).toFixed(3);
    if (!to) { msg = "Enter a username."; draw(); return; }
    app.action("powerUp", { to, amount });
  };
}
draw();` },
  { id: "a_witness", icon: "🗳️", name: "Witness Vote", desc: "Vote for or unvote a Steem witness",
    code: `let witness = "", vote = true, done = false, msg = "";
let wInfo = null;
function lookup() {
  if (!witness) return;
  app.query("getWitnessByAccount", { accountName: witness });
}
function draw() {
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>🗳️ Witness Vote</div>" +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<input id='w' type='text' placeholder='witness username' value='" + witness + "' style='flex:1;'>" +
    "<button id='lu'>Look up</button></div>" +
    (wInfo ? "<div style='font-size:12px;color:#9b8db0;margin-bottom:8px;'>@"+wInfo.owner+" — Votes: <b style='color:#e8e0f0;'>"+parseInt(wInfo.votes/1e9)+"B</b></div>" : "") +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<button id='vt' style='background:"+(vote?"#166534":"#1e1535")+";border:1px solid "+(vote?"#4ade80":"#2e2050")+";"+"'>✅ Vote</button>" +
    "<button id='uv' style='background:"+(!vote?"#7f1d1d":"#1e1535")+";border:1px solid "+(!vote?"#f87171":"#2e2050")+";"+"'>❌ Unvote</button>" +
    "</div>" +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-bottom:6px;'>" + msg + "</div>" : "") +
    "<button id='go'>🗳️ Submit</button>" +
    "</div>"
  );
  document.getElementById("lu").onclick = () => { witness = document.getElementById("w").value.trim(); wInfo = null; lookup(); draw(); };
  document.getElementById("vt").onclick = () => { vote = true; draw(); };
  document.getElementById("uv").onclick = () => { vote = false; draw(); };
  document.getElementById("go").onclick = () => {
    witness = document.getElementById("w").value.trim();
    if (!witness) { msg = "Enter a witness name."; draw(); return; }
    app.action("voteWitness", { witness, vote });
  };
}
app.onResult((ok, data) => {
  if (ok && data && data.owner) { wInfo = data; draw(); return; }
  if (typeof ok === "boolean" && typeof data === "string" && data === "voteWitness") {
    done = ok; msg = ok ? "✅ Witness vote submitted!" : "❌ Failed."; draw();
  }
});
draw();` },
  { id: "a_retwist", icon: "🔁", name: "Retwist", desc: "Resteem a post by looking up a user's recent posts first",
    code: `let author = "", posts = [], selected = null, done = false, msg = "", loading = false;
function loadPosts() {
  if (!author) return;
  loading = true; posts = []; selected = null; done = false; msg = ""; draw();
  app.query("getDiscussionsByBlog", { query: { tag: author, limit: 5 } });
}
function draw() {
  const postList = posts.map((p,i) =>
    "<div id='sel_"+i+"' style='padding:6px 8px;border-radius:6px;margin-bottom:4px;cursor:pointer;" +
    "background:"+(selected===i?"#2e2050":"#1a1030")+";border:1px solid "+(selected===i?"#a855f7":"#2e2050")+";" +
    "font-size:12px;color:#e8e0f0;'>" + p.title.slice(0,60) + "</div>"
  ).join("");
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>🔁 Retwist</div>" +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<input id='a' type='text' placeholder='author' value='"+author+"' style='flex:1;'>" +
    "<button id='load'>Load posts</button></div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" : postList) +
    (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin:6px 0;'>" + msg + "</div>" : "") +
    (selected !== null ? "<button id='go'" + (done?" disabled":"") + ">🔁 Retwist selected</button>" : "") +
    "</div>"
  );
  document.getElementById("load").onclick = () => { author = document.getElementById("a").value.trim(); loadPosts(); };
  posts.forEach((_,i) => {
    const el = document.getElementById("sel_"+i);
    if (el) el.onclick = () => { selected = i; draw(); };
  });
  const go = document.getElementById("go");
  if (go) go.onclick = () => {
    const p = posts[selected];
    app.action("retwist", { author: p.author, permlink: p.permlink });
  };
}
app.onResult((ok, data) => {
  if (Array.isArray(data)) { loading = false; posts = ok ? data : []; draw(); return; }
  if (typeof ok === "boolean") { done = ok; msg = ok ? "✅ Retwisted!" : "❌ Failed."; draw(); }
});
draw();` },
  { id: "a_query_vote", icon: "🔍", name: "Check & Vote", desc: "Look up a post's votes then upvote it",
    code: `let author = "", permlink = "", votes = null, loading = false, voted = false, msg = "";
function loadVotes() {
  if (!author || !permlink) return;
  loading = true; votes = null; draw();
  app.query("getActiveVotes", { author, permlink });
}
function draw() {
  const voteList = (votes||[]).slice(0,8).map(v=>
    "<span style='background:#1a1030;border:1px solid #2e2050;border-radius:12px;padding:2px 8px;font-size:11px;color:#9b8db0;margin:2px;display:inline-block;'>@"+v.voter+"</span>"
  ).join("");
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='font-weight:600;color:#c084fc;margin-bottom:8px;'>🔍 Check Votes &amp; Vote</div>" +
    "<input id='a' type='text' placeholder='author' value='"+author+"' style='margin-bottom:6px;'>" +
    "<input id='p' type='text' placeholder='permlink' value='"+permlink+"' style='margin-bottom:6px;'>" +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<button id='chk'>Check votes</button>" +
    "<button id='vt'" + (voted?" disabled":"") + " style='background:linear-gradient(135deg,#6d28d9,#e0187a);'>❤️ Upvote</button>" +
    "</div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     votes ? "<div style='margin-bottom:8px;'><span style='font-size:12px;color:#9b8db0;'>"+votes.length+" vote(s):</span><br>" + voteList + "</div>" : "") +
    (msg ? "<div style='font-size:12px;color:"+(voted?"#4ade80":"#fca5a5")+";'>" + msg + "</div>" : "") +
    "</div>"
  );
  document.getElementById("chk").onclick = () => { author = document.getElementById("a").value.trim(); permlink = document.getElementById("p").value.trim(); loadVotes(); };
  document.getElementById("vt").onclick = () => {
    author = document.getElementById("a").value.trim();
    permlink = document.getElementById("p").value.trim();
    if (!author||!permlink) { msg = "Enter author and permlink."; draw(); return; }
    app.action("vote", { author, permlink, weight: 10000 });
  };
}
app.onResult((ok, data) => {
  if (Array.isArray(data)) { loading = false; votes = ok ? data : []; draw(); return; }
  if (typeof ok === "boolean") { voted = ok; msg = ok ? "✅ Voted!" : "❌ Vote failed."; draw(); }
});
draw();` },
  { id: "a_profile_follow", icon: "🌐", name: "Profile + Follow", desc: "View a Steem profile and follow/unfollow in one card",
    code: `let uname = "steemtwist", profile = null, fc = null, loading = false, done = false, msg = "", action = "";
function load(u) {
  uname = u; loading = true; profile = null; fc = null; draw();
  app.query("getAccounts", { names: [uname] });
}
app.onResult((ok, data) => {
  if (Array.isArray(data) && data[0] && data[0].name) {
    profile = data[0];
    try { profile._p = JSON.parse(profile.posting_json_metadata||"{}").profile||{}; } catch {}
    app.query("getFollowCount", { account: uname });
    return;
  }
  if (ok && data && data.follower_count !== undefined) {
    loading = false; fc = data; draw(); return;
  }
  if (typeof ok === "boolean" && (action==="follow"||action==="unfollow")) {
    done = ok; msg = ok ? "✅ Done!" : "❌ Failed."; draw();
  }
});
function draw() {
  const p = profile, meta = p && p._p || {};
  app.render(
    "<div style='padding:8px;'>" +
    "<div style='display:flex;gap:6px;margin-bottom:8px;'>" +
    "<input id='u' type='text' value='"+uname+"' placeholder='username' style='flex:1;'>" +
    "<button id='go'>Load</button></div>" +
    (loading ? "<div style='color:#9b8db0;'>Loading…</div>" :
     !p ? "<div style='color:#fca5a5;'>Not found.</div>" :
     "<div style='background:#1a1030;border:1px solid #2e2050;border-radius:8px;padding:10px;'>" +
     "<div style='font-size:14px;font-weight:700;color:#e8e0f0;'>@"+p.name+"</div>" +
     (meta.about ? "<div style='font-size:12px;color:#9b8db0;margin:3px 0;'>"+meta.about.slice(0,80)+"</div>" : "") +
     (fc ? "<div style='font-size:12px;color:#9b8db0;'>Followers: <b style='color:#e8e0f0;'>"+fc.follower_count+"</b> &nbsp; Following: <b style='color:#e8e0f0;'>"+fc.following_count+"</b></div>" : "") +
     "<div style='display:flex;gap:6px;margin-top:8px;'>" +
     "<button id='fo' style='background:#166534;border-color:#4ade80;'>➕ Follow</button>" +
     "<button id='uf' style='background:#7f1d1d;border-color:#f87171;'>➖ Unfollow</button>" +
     "</div>" +
     (msg ? "<div style='font-size:12px;color:"+(done?"#4ade80":"#fca5a5")+";margin-top:6px;'>"+msg+"</div>" : "") +
     "</div>") +
    "</div>"
  );
  document.getElementById("go").onclick = () => { load(document.getElementById("u").value.trim()); };
  const fo = document.getElementById("fo"), uf = document.getElementById("uf");
  if (fo) fo.onclick = () => { action = "follow"; app.action("follow", { following: uname }); };
  if (uf) uf.onclick = () => { action = "unfollow"; app.action("unfollow", { following: uname }); };
}
load(uname);` }
];

// ---- AppNotificationComponent ----
// A slim toast bar rendered at the top of the app.
// Type: "error" | "success" | "info"
// Auto-dismisses after 3.5 s for success/info; errors stay until dismissed.
const AppNotificationComponent = {
  name: "AppNotificationComponent",
  props: {
    message: String,
    type: { type: String, default: "error" }
  },
  emits: ["dismiss"],
  data() {
    return { timer: null };
  },
  watch: {
    message(val) {
      clearTimeout(this.timer);
      if (val && this.type !== "error") {
        this.timer = setTimeout(() => this.$emit("dismiss"), 3500);
      }
    }
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  computed: {
    styles() {
      const base = {
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        margin: "10px auto", padding: "10px 14px",
        borderRadius: "6px", maxWidth: "600px",
        fontSize: "14px", gap: "10px"
      };
      if (this.type === "success")
        return { ...base, background: "#0a2d12", border: "1px solid #166534", color: "#86efac" };
      if (this.type === "info")
        return { ...base, background: "#0a1a2d", border: "1px solid #1e3a5f", color: "#93c5fd" };
      return   { ...base, background: "#2d0a0a", border: "1px solid #7f1d1d", color: "#fca5a5" };
    },
    icon() {
      if (this.type === "success") return "✅";
      if (this.type === "info")    return "ℹ️";
      return "⚠️";
    }
  },
  template: `
    <div v-if="message" :style="styles" role="alert">
      <span>{{ icon }} {{ message }}</span>
      <button
        @click="$emit('dismiss')"
        style="background:none;border:none;cursor:pointer;font-size:16px;padding:0;color:inherit;line-height:1;"
        aria-label="Dismiss"
      >✕</button>
    </div>
  `
};

// ---- AuthComponent ----
// Handles login (via Steem Keychain) and logout.
// Emits: login(username), logout, close
const AuthComponent = {
  name: "AuthComponent",
  props: {
    username:    String,
    hasKeychain: Boolean,
    loginError:  String,
    isLoggingIn: { type: Boolean, default: false }
  },
  emits: ["login", "logout", "close"],
  data() {
    return { usernameInput: "" };
  },
  watch: {
    username(val) {
      if (val) this.$emit("close");
    }
  },
  methods: {
    submit() {
      const val = this.usernameInput.trim().toLowerCase();
      if (!val) return;
      this.$emit("login", val);
    },
    onKeydown(e) {
      if (e.key === "Enter")  this.submit();
      if (e.key === "Escape") this.$emit("close");
    }
  },
  template: `
    <div style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 0;">
      <template v-if="!username">
        <input
          v-model="usernameInput"
          type="text"
          placeholder="Steem username"
          autocomplete="username"
          style="padding:7px 10px;border-radius:20px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:14px;width:180px;"
          @keydown="onKeydown"
        />
        <button @click="submit" :disabled="!usernameInput.trim() || isLoggingIn">Sign in</button>
        <button @click="$emit('close')" style="background:#2e2050;border-radius:20px;">Cancel</button>
        <div v-if="loginError" style="width:100%;color:#c62828;font-size:13px;margin-top:4px;">
          {{ loginError }}
        </div>
      </template>
      <template v-else>
        <span style="font-size:14px;">Logged in as <strong>@{{ username }}</strong></span>
        <button @click="$emit('logout')" style="background:#2e2050;border-radius:20px;">Logout</button>
      </template>
    </div>
  `
};

// ---- UserProfileComponent ----
// Rich profile card: cover, avatar, display name, reputation, bio,
// stats row (followers, following, posts), location, website, join date.
// Receives the enriched profileData object from fetchAccount.
const UserProfileComponent = {
  name: "UserProfileComponent",
  props: {
    profileData: Object,
    // Optional: pass twist count from the parent view
    twistCount:  { type: Number, default: null }
  },
  computed: {
    joinDate() {
      if (!this.profileData?.created) return "";
      const d = new Date(this.profileData.created + "Z");
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    },
    safeWebsite() {
      const url = this.profileData?.website || "";
      try {
        // Normalise bare domains (e.g. "example.com") to https://
        const u = new URL(url.startsWith("http") ? url : "https://" + url);
        // Accept https only — http leaks mixed-content warnings and
        // url.startsWith("http") above would also match "http:" which we drop.
        return u.protocol === "https:" ? u.href : "";
      } catch { return ""; }
    },
    websiteLabel() {
      try {
        return new URL(this.safeWebsite).hostname.replace(/^www\./, "");
      } catch { return this.profileData?.website || ""; }
    },
    socialUrl() {
      return `#/@${this.profileData?.username}/social`;
    }
  },
  methods: {
    safeAvatarUrl(username) {
      return `https://steemitimages.com/u/${username}/avatar`;
    },
  },
  template: `
    <div v-if="profileData" style="max-width:600px;margin:0 auto 16px;">

      <!-- Card body — no cover image here (shown globally in header) -->
      <div style="
        background:#1e1535;border:1px solid #2e2050;
        border-radius:12px;padding:16px;
      ">
        <!-- Avatar row -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <img
            :src="safeAvatarUrl(profileData.username)"
            style="width:72px;height:72px;border-radius:50%;border:3px solid #2e2050;background:#0f0a1e;flex-shrink:0;"
            @error="$event.target.src='https://steemitimages.com/u/guest/avatar'"
          />
          <!-- Reputation badge -->
          <div style="
            background:linear-gradient(135deg,#8b2fc9,#e0187a);
            color:#fff;font-size:12px;font-weight:700;
            padding:3px 10px;border-radius:20px;
          " title="Steem reputation score">
            ⭐ {{ profileData.reputation }}
          </div>
        </div>

        <!-- Name + username -->
        <div style="margin-bottom:8px;">
          <div style="font-size:18px;font-weight:700;color:#e8e0f0;">{{ profileData.displayName }}</div>
          <div style="font-size:13px;color:#a855f7;">@{{ profileData.username }}</div>
        </div>

        <!-- Bio -->
        <div v-if="profileData.about" style="
          font-size:14px;color:#c0b0e0;line-height:1.5;margin-bottom:12px;
        ">{{ profileData.about }}</div>

        <!-- Meta row: location, website, joined -->
        <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:#9b8db0;margin-bottom:14px;">
          <span v-if="profileData.location">
            📍 {{ profileData.location }}
          </span>
          <a
            v-if="safeWebsite"
            :href="safeWebsite"
            target="_blank"
            rel="noopener noreferrer"
            style="color:#22d3ee;text-decoration:none;"
          >🔗 {{ websiteLabel }}</a>
          <span v-if="joinDate">
            📅 Joined {{ joinDate }}
          </span>
        </div>

        <!-- Stats row -->
        <div style="
          display:flex;gap:0;border:1px solid #2e2050;border-radius:10px;
          overflow:hidden;text-align:center;
        ">
          <a
            :href="socialUrl + '?tab=followers'"
            style="flex:1;padding:10px 4px;text-decoration:none;border-right:1px solid #2e2050;
                   transition:background 0.15s;"
            @mouseenter="$event.currentTarget.style.background='#2e2050'"
            @mouseleave="$event.currentTarget.style.background=''"
          >
            <div style="font-size:16px;font-weight:700;color:#e8e0f0;">
              {{ profileData.followerCount !== null ? profileData.followerCount.toLocaleString() : '—' }}
            </div>
            <div style="font-size:11px;color:#9b8db0;margin-top:2px;">Followers</div>
          </a>
          <a
            :href="socialUrl + '?tab=following'"
            style="flex:1;padding:10px 4px;text-decoration:none;border-right:1px solid #2e2050;
                   transition:background 0.15s;"
            @mouseenter="$event.currentTarget.style.background='#2e2050'"
            @mouseleave="$event.currentTarget.style.background=''"
          >
            <div style="font-size:16px;font-weight:700;color:#e8e0f0;">
              {{ profileData.followingCount !== null ? profileData.followingCount.toLocaleString() : '—' }}
            </div>
            <div style="font-size:11px;color:#9b8db0;margin-top:2px;">Following</div>
          </a>
          <div style="flex:1;padding:10px 4px;">
            <div style="font-size:16px;font-weight:700;color:#e8e0f0;">
              {{ profileData.postCount.toLocaleString() }}
            </div>
            <div style="font-size:11px;color:#9b8db0;margin-top:2px;">Posts</div>
          </div>
          <div v-if="twistCount !== null" style="flex:1;padding:10px 4px;border-left:1px solid #2e2050;">
            <div style="font-size:16px;font-weight:700;color:#e8e0f0;">
              {{ twistCount.toLocaleString() }}
            </div>
            <div style="font-size:11px;color:#9b8db0;margin-top:2px;">Twists</div>
          </div>
        </div>

      </div>
    </div>
  `
};

// ---- LoadingSpinnerComponent ----
// Simple centred loading indicator. Show while async data is being fetched.
const LoadingSpinnerComponent = {
  name: "LoadingSpinnerComponent",
  props: {
    message: { type: String, default: "Loading..." }
  },
  template: `
    <div style="text-align:center;padding:30px;color:#5a4e70;">
      <div style="
        display:inline-block;width:32px;height:32px;
        border:4px solid #2e2050;border-top-color:#a855f7;
        border-radius:50%;animation:spin 0.8s linear infinite;
      "></div>
      <p style="margin-top:10px;font-size:14px;">{{ message }}</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `
};

// ============================================================
// STEEMTWIST COMPONENTS
// ============================================================

// Body longer than this, or children count above THREAD_REPLY_THRESHOLD,
// triggers collapsed thread mode. Matches the composer limit so native
// twists never collapse.
const PREVIEW_LENGTH       = 280;
const THREAD_REPLY_THRESHOLD = 3;
const REGULAR_TWIST_MEDIA_LIMIT = 4;
const IMAGE_ALT_TEXT_MAX_LENGTH = 80;

// Shared markdown renderer — configured once, reused everywhere.
// marked.parse() is synchronous and returns sanitised HTML.
const markedOptions = { breaks: true, gfm: true };
function renderMarkdown(text) {
  if (!text) return "";
  return marked.parse(text, markedOptions);
}

// Strip the SteemTwist back-link appended by buildZeroPayoutOps before
// rendering. The link takes the form:
//   \n\n<sub>Posted via [SteemTwist](...)</sub>
// Matching on the opening <sub>Posted via is sufficient and tolerates any URL.
function stripBackLink(text) {
  if (!text) return "";
  return text.replace(/\n+<sub>Posted via \[SteemTwist\][^\n]*/i, "").trimEnd();
}

// Live Twist posts are broadcast with a body that starts with the label
// for Steemit-style UIs: "**Label**\n\nDescription". In SteemTwist we already
// render the label in the card header, so remove that duplicated first line.
function stripLiveTwistLabelPrefix(text, label) {
  let cleaned = stripBackLink(text || "").trim();
  const title = (label || "").trim();
  if (!cleaned || !title) return cleaned;

  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  cleaned = cleaned
    .replace(new RegExp(`^\\*\\*${esc}\\*\\*\\s*\\n+`, "i"), "")
    .replace(new RegExp(`^#\\s*${esc}\\s*\\n+`, "i"), "");

  if (
    cleaned === `**${title}**` ||
    cleaned.toLowerCase() === `# ${title}`.toLowerCase()
  ) return "";

  return cleaned.trim();
}

// ---- ReplyCardComponent ----
// Renders a single reply with its own compose box and a recursive
// ThreadComponent for its children. Declared before ThreadComponent
// so the two can reference each other via the global component registry.
const ReplyCardComponent = {
  name: "ReplyCardComponent",
  liveTemplates: LIVE_TWIST_TEMPLATES,
  liveGreetings: LIVE_TWIST_GREETINGS,
  liveQueries: LIVE_TWIST_QUERIES,
  liveActions: LIVE_TWIST_ACTIONS,
  inject: ["username", "hasKeychain", "notify"],
  props: {
    reply: { type: Object, required: true },
    depth: { type: Number, default: 0 }
  },
  data() {
    return {
      showReplyBox:     false,
      replyMode:        draftStorage.load("reply_mode_" + this.reply.permlink, "twist"),
      replyPreviewMode: false,
      // Auto-expand the first two nesting levels (depth 0 and 1).
      showChildren:  this.depth < 2,
      replyText:     draftStorage.load("reply_" + this.reply.permlink, ""),
      liveReplyTitle: draftStorage.load("live_reply_title_" + this.reply.permlink, ""),
      liveReplyBody:  draftStorage.load("live_reply_body_" + this.reply.permlink, ""),
      liveReplyCode:  draftStorage.load("live_reply_code_" + this.reply.permlink, ""),
      liveReplyTab:   "code",
      liveReplyTemplateSubTab: "simple",
      liveReplyPreviewKey: 0,
      liveReplyIframeHeight: 200,
      isUploadingReplyImage: false,
      replyUploadError: "",
      isReplying:    false,
      isVoting:      false,
      hasVoted:      false,
      isRetwisting:  false,
      hasRetwisted:  false,
      replyCount:    this.reply.children || 0,
      lastError:     "",
      showEditBox:   false,
      editText:      "",
      isEditing:     false,
      showDeleteConfirm: false,
      isDeleting:    false,
      editedBody:    null,
      replyExpanded: false   // true once user clicks "Expand"
    };
  },
  computed: {
    isOwnReply() {
      return !!this.username && this.username === this.reply.author;
    },
    avatarUrl() {
      return `https://steemitimages.com/u/${this.reply.author}/avatar/small`;
    },
    relativeTime() {
      const diff = Date.now() - steemDate(this.reply.created).getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60)  return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60)  return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)  return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    },
    absoluteTime() {
      const d = steemDate(this.reply.created);
      if (isNaN(d)) return "";
      return d.toUTCString().replace(" GMT", " UTC");
    },
    replyUrl() {
      return `#/@${this.reply.author}/${this.reply.permlink}`;
    },
    bodyHtml() { return DOMPurify.sanitize(renderMarkdown(stripBackLink(this.editedBody !== null ? this.editedBody : this.reply.body))); },
    isLiveTwist() {
      try {
        const raw = this.reply.json_metadata;
        const meta = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
        return meta.type === "live_twist" && !!meta.code;
      } catch { return false; }
    },
    isLong() { return stripBackLink(this.reply.body).length > PREVIEW_LENGTH; },
    bodyPreviewHtml() {
      return DOMPurify.sanitize(renderMarkdown(
        stripBackLink(this.editedBody !== null ? this.editedBody : this.reply.body)
          .slice(0, PREVIEW_LENGTH) + "…"
      ));
    },
    replyPreviewHtml() {
      return this.replyText.trim()
        ? DOMPurify.sanitize(renderMarkdown(this.replyText))
        : "<em style='color:#5a4e70'>Nothing to preview.</em>";
    },
    replyCharCount() { return countTwistCharsExcludingMedia(this.replyText); },
    replyOverLimit() { return this.replyCharCount > 280; },
    replyMediaCount() { return countMediaEmbeds(this.replyText); },
    replyMediaLimitExceeded() { return this.replyMediaCount > REGULAR_TWIST_MEDIA_LIMIT; },
    mediaLimit() { return REGULAR_TWIST_MEDIA_LIMIT; },
    canSubmitReply() {
      return !!this.replyText.trim() && !this.isReplying && !this.replyOverLimit && !this.replyMediaLimitExceeded;
    },
    canSubmitLiveReply() {
      return !!this.liveReplyCode.trim() && !this.isReplying;
    },
    canUploadReplyImage() { return this.replyMediaCount < this.mediaLimit; },
    canAct()   { return !!this.username && this.hasKeychain; },
    indent()   { return Math.min(this.depth, 4) * 16; },
    
    upvoteCount() {
  const votes = this.reply.active_votes;

  if (!votes) return this.hasVoted ? 1 : 0;

  const count = votes.filter(v => v.percent > 0).length;

  return count + (this.hasVoted ? 1 : 0);
}
  },
  watch: {
    replyText(v) { draftStorage.save("reply_" + this.reply.permlink, v); },
    replyMode(v) { draftStorage.save("reply_mode_" + this.reply.permlink, v); },
    liveReplyTitle(v) { draftStorage.save("live_reply_title_" + this.reply.permlink, v); },
    liveReplyBody(v)  { draftStorage.save("live_reply_body_" + this.reply.permlink, v); },
    liveReplyCode(v)  { draftStorage.save("live_reply_code_" + this.reply.permlink, v); }
  },
    methods: {
    handleLivePreviewQuery(queryType, params, iframeSource, reqId) {
      return LIVE_TWIST_HANDLER_MIXIN.handleQueryRequest.call(this, queryType, params, iframeSource, reqId);
    },
    handleLivePreviewAction(actionType, params, iframeSource) {
      return LIVE_TWIST_HANDLER_MIXIN.handleActionRequest.call(this, actionType, params, iframeSource);
    },
    vote() {
      if (!this.canAct || this.isVoting || this.hasVoted) return;
      this.isVoting = true;
      voteTwist(this.username, this.reply.author, this.reply.permlink, 10000, (res) => {
        this.isVoting = false;
        if (res.success) {
          this.hasVoted = true;
        } else {
          this.lastError = res.error || res.message || "Vote failed.";
        }
      });
    },
    retwist() {
      if (!this.canAct || this.isRetwisting || this.hasRetwisted) return;
      if (this.reply.author === this.username) {
        this.lastError = "You cannot retwist your own twist.";
        return;
      }
      this.isRetwisting = true;
      retwistPost(this.username, this.reply.author, this.reply.permlink, (res) => {
        this.isRetwisting = false;
        if (res.success) {
          this.hasRetwisted = true;
        } else {
          this.lastError = res.error || res.message || "Retwist failed.";
        }
      });
    },
    toggleReplies() {
      if (this.replyCount > 0) this.showChildren = !this.showChildren;
      if (this.canAct)         this.showReplyBox  = !this.showReplyBox;
    },
    insertReplyAtCursor(text) {
      const ta = this.$refs.replyTextarea;
      if (!ta) {
        this.replyText = (this.replyText ? this.replyText + "\n" : "") + text;
        return;
      }
      const start = ta.selectionStart ?? this.replyText.length;
      const end   = ta.selectionEnd ?? this.replyText.length;
      this.replyText = this.replyText.slice(0, start) + text + this.replyText.slice(end);
      this.$nextTick(() => {
        ta.focus();
        const pos = start + text.length;
        ta.selectionStart = pos;
        ta.selectionEnd = pos;
      });
    },
    onReplyImageSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      event.target.value = "";
      this.uploadReplyImage(file);
    },
    uploadReplyImage(file) {
      if (this.isUploadingReplyImage || !this.canAct) return;
      if (!this.canUploadReplyImage) {
        this.lastError = `Reply can include up to ${this.mediaLimit} images/videos.`;
        return;
      }
      this.replyUploadError = "";
      this.isUploadingReplyImage = true;
      uploadImageToSteemit(this.username, file, (res) => {
        this.isUploadingReplyImage = false;
        if (!res.success) {
          this.replyUploadError = res.error || "Image upload failed.";
          this.lastError = this.replyUploadError;
          return;
        }
        const alt = makeImageAltText(file.name);
        this.insertReplyAtCursor(`![${alt}](${res.url})`);
      });
    },
    runLiveReplyPreview() {
      this.liveReplyTab = "preview";
      this.liveReplyIframeHeight = 80;
      this.liveReplyPreviewKey++;
    },
    useLiveReplyTemplate(tpl) {
      this.liveReplyCode = tpl.code;
      this.liveReplyTitle = tpl.name;
      this.liveReplyBody = tpl.desc || "";
      this.liveReplyTab = "code";
    },
    buildLiveReplySandboxDoc(code) {
      return buildLiveTwistSandboxDoc(code);
    },
    onLiveReplyPreviewMessage(e) {
      const iframe = this.$refs.liveReplyPreview;
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (e?.data?.type === "LIVE_REPLY_PREVIEW_RESIZE") {
        this.liveReplyIframeHeight = Math.max(e.data.height || 80, 80);
      }
      if (e?.data?.type === "LIVE_TWIST_QUERY") {
        this.handleLivePreviewQuery(e.data.queryType, e.data.params, e.source, e.data._reqId);
      }
      if (e?.data?.type === "LIVE_TWIST_ACTION") {
        this.handleLivePreviewAction(e.data.actionType, e.data.params, e.source);
      }
    },
    submitReply() {
      if (this.replyMode === "live") {
        const code = this.liveReplyCode.trim();
        if (!code || !this.canAct) return;
        this.isReplying = true;
        postLiveTwistReply(
          this.username,
          this.liveReplyTitle.trim() || "Live Twist",
          this.liveReplyBody.trim() || "⚡ Live Twist — view on SteemTwist",
          code,
          this.reply.author,
          this.reply.permlink,
          (res) => {
            this.isReplying = false;
            if (res.success) {
              this.liveReplyTitle  = "";
              this.liveReplyBody   = "";
              this.liveReplyCode   = "";
              this.showChildren    = true;
              this.replyCount++;
              draftStorage.clear("live_reply_title_" + this.reply.permlink);
              draftStorage.clear("live_reply_body_" + this.reply.permlink);
              draftStorage.clear("live_reply_code_" + this.reply.permlink);
            } else {
              this.lastError = res.error || res.message || "Live reply failed.";
            }
          }
        );
        return;
      }

      const text = this.replyText.trim();
      if (!text || !this.canAct) return;
      if (this.replyOverLimit) {
        this.lastError = "Reply text exceeds 280 characters (media excluded).";
        return;
      }
      if (this.replyMediaLimitExceeded) {
        this.lastError = `Reply can include up to ${REGULAR_TWIST_MEDIA_LIMIT} images/videos.`;
        return;
      }
      this.isReplying = true;
      postTwistReply(this.username, text, this.reply.author, this.reply.permlink, (res) => {
        this.isReplying = false;
        if (res.success) {
          this.replyText        = "";
          this.replyPreviewMode = false;
          this.showChildren     = true;
          this.replyCount++;
          draftStorage.clear("reply_" + this.reply.permlink);
        } else {
          this.lastError = res.error || res.message || "Reply failed.";
        }
      });
    },

    openEdit() {
      this.editText    = stripBackLink(this.editedBody !== null ? this.editedBody : this.reply.body);
      this.showEditBox = true;
    },
    saveEdit() {
      const text = this.editText.trim();
      if (!text || this.isEditing) return;
      this.isEditing = true;
      editTwist(this.username, this.reply, text, (res) => {
        this.isEditing = false;
        if (res.success) {
          this.editedBody  = text;
          this.showEditBox = false;
        } else {
          this.lastError = res.error || res.message || "Edit failed.";
        }
      });
    },
    confirmDelete() { this.showDeleteConfirm = true; },
    doDelete() {
      if (this.isDeleting) return;
      this.isDeleting = true;
      deleteTwist(this.username, this.reply, (res) => {
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        if (res.success) {
          this.$emit("deleted", this.reply);
        } else {
          this.lastError = res.error || res.message || "Delete failed.";
        }
      });
    }
  },
  mounted() {
    window.addEventListener("message", this.onLiveReplyPreviewMessage);
  },
  unmounted() {
    window.removeEventListener("message", this.onLiveReplyPreviewMessage);
  },
  template: `
    <div :style="{ paddingLeft: indent + 'px' }">
      <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #2e2050;">

        <!-- Avatar -->
        <a :href="'#/@' + reply.author" style="flex-shrink:0;">
          <img
            :src="avatarUrl"
            style="width:28px;height:28px;border-radius:50%;border:2px solid #2e2050;"
            @error="$event.target.src='https://steemitimages.com/u/guest/avatar/small'"
          />
        </a>

        <!-- Content -->
        <div style="flex:1;min-width:0;">

          <!-- Header -->
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
            <a
              :href="'#/@' + reply.author"
              style="font-weight:bold;color:#a855f7;text-decoration:none;font-size:13px;"
            >@{{ reply.author }}</a>
            <!-- Timestamp linked to the reply's own page; absolute time on hover -->
            <a
              :href="replyUrl"
              :title="absoluteTime"
              style="font-size:11px;color:#5a4e70;text-decoration:none;"
            >{{ relativeTime }}</a>
          </div>

          <!-- Body -->
          <live-twist-component
            v-if="isLiveTwist"
            :post="reply"
            style="margin-bottom:8px;"
          ></live-twist-component>
          <div v-else class="twist-body" style="font-size:14px;"
            v-html="isLong && !replyExpanded ? bodyPreviewHtml : bodyHtml"
          ></div>
          <div v-if="isLong && !isLiveTwist" style="margin-bottom:4px;">
            <button
              @click="replyExpanded = !replyExpanded"
              style="background:none;border:none;padding:0;color:#a855f7;font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;"
            >{{ replyExpanded ? "▲ Collapse" : "▼ Expand" }}</button>
          </div>

          <!-- Actions: love + retwist + reply + permalink -->
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap;">

            <!-- Love -->
            <button
              @click="vote"
              :disabled="!canAct || isVoting || hasVoted"
              :style="{
                background: hasVoted ? '#3b0764' : '#1e1535',
                color: hasVoted ? '#e879f9' : '#9b8db0',
                border: hasVoted ? '1px solid #a855f7' : '1px solid #2e2050',
                borderRadius: '20px', padding: '2px 10px',
                cursor: (!canAct || hasVoted) ? 'default' : 'pointer',
                fontSize: '12px'
              }"
            >{{ isVoting ? "…" : (hasVoted ? "❤️" : "🤍") }} {{ upvoteCount }}</button>

            <!-- Retwist -->
            <button
              @click="retwist"
              :disabled="!canAct || isRetwisting || hasRetwisted || reply.author === username"
              :style="{
                background: hasRetwisted ? '#0c2d1a' : '#1e1535',
                color:      hasRetwisted ? '#4ade80'  : '#9b8db0',
                border:     hasRetwisted ? '1px solid #166534' : '1px solid #2e2050',
                borderRadius: '20px', padding: '2px 10px',
                cursor: (!canAct || hasRetwisted || reply.author === username) ? 'default' : 'pointer',
                fontSize: '12px'
              }"
              :title="reply.author === username ? 'Cannot retwist your own twist' : ''"
            >{{ isRetwisting ? "…" : (hasRetwisted ? "🔁 Retwisted" : "🔁") }}</button>

            <!-- Reply -->
            <button
              @click="toggleReplies"
              style="
                background:none;border:none;padding:0;margin:0;
                color:#a855f7;font-size:12px;cursor:pointer;
                text-decoration:underline;font-weight:600;
              "
            >
              💬 {{ replyCount > 0 ? replyCount + ' repl' + (replyCount === 1 ? 'y' : 'ies') : 'Reply' }}
            </button>

            <!-- Permalink -->
            <a
              :href="replyUrl"
              style="font-size:11px;color:#5a4e70;text-decoration:none;"
              title="Open reply page"
            >🔗</a>

            <!-- Edit / Delete — own replies only -->
            <button
              v-if="isOwnReply && hasKeychain"
              @click="openEdit"
              style="background:none;border:none;padding:0;font-size:12px;
                     color:#5a4e70;cursor:pointer;"
              title="Edit this reply"
            >✏️</button>

            <button
              v-if="isOwnReply && hasKeychain"
              @click="confirmDelete"
              style="background:none;border:none;padding:0;font-size:12px;
                     color:#5a4e70;cursor:pointer;"
              title="Delete this reply"
            >🗑️</button>

          </div>

          <!-- Inline edit box -->
          <div v-if="showEditBox" style="margin-top:8px;">
            <textarea
              v-model="editText"
              style="
                width:100%;box-sizing:border-box;padding:7px;border-radius:8px;
                border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;
                font-size:13px;resize:vertical;min-height:52px;
              "
              @keydown.ctrl.enter="saveEdit"
            ></textarea>
            <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:4px;">
              <button
                @click="showEditBox = false"
                style="background:#1e1535;border:1px solid #2e2050;color:#9b8db0;
                       border-radius:20px;padding:2px 10px;font-size:12px;margin:0;"
              >Cancel</button>
              <button
                @click="saveEdit"
                :disabled="!editText.trim() || isEditing"
                style="padding:2px 12px;font-size:12px;margin:0;"
              >{{ isEditing ? "Saving…" : "Save" }}</button>
            </div>
          </div>

          <!-- Delete confirmation -->
          <div v-if="showDeleteConfirm" style="
            margin-top:6px;padding:8px 10px;border-radius:8px;font-size:12px;
            background:#2d0a0a;border:1px solid #7f1d1d;color:#fca5a5;
          ">
            <div style="margin-bottom:6px;">Delete this reply?</div>
            <div style="display:flex;gap:6px;">
              <button
                @click="doDelete"
                :disabled="isDeleting"
                style="background:#7f1d1d;border:none;color:#fff;border-radius:20px;
                       padding:2px 12px;font-size:12px;margin:0;"
              >{{ isDeleting ? "…" : "Delete" }}</button>
              <button
                @click="showDeleteConfirm = false"
                style="background:#1e1535;border:1px solid #2e2050;color:#9b8db0;
                       border-radius:20px;padding:2px 10px;font-size:12px;margin:0;"
              >Cancel</button>
            </div>
          </div>

          <!-- Compose box -->
          <div v-if="showReplyBox && canAct" style="margin-top:8px;">
            <div style="display:flex;gap:4px;margin-bottom:6px;">
              <button
                @click="replyMode = 'twist'"
                :style="{
                  background: replyMode === 'twist' ? '#2e2050' : '#0f0a1e',
                  color:      replyMode === 'twist' ? '#e8e0f0' : '#9b8db0',
                  border:'1px solid #2e2050', borderRadius:'999px',
                  padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer'
                }"
              >🌀 Reply</button>
              <button
                @click="replyMode = 'live'"
                :style="{
                  background: replyMode === 'live' ? '#3b1a07' : '#0f0a1e',
                  color:      replyMode === 'live' ? '#fdba74' : '#9b8db0',
                  border:'1px solid #2e2050', borderRadius:'999px',
                  padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer'
                }"
              >⚡ Live Reply</button>
            </div>

            <template v-if="replyMode === 'twist'">
            <div style="display:flex;gap:4px;margin-bottom:4px;">
              <button
                @click="replyPreviewMode = false"
                :style="{
                  background: !replyPreviewMode ? '#2e2050' : 'none',
                  color:      !replyPreviewMode ? '#e8e0f0' : '#9b8db0',
                  border:'1px solid #2e2050', borderRadius:'6px 6px 0 0',
                  padding:'2px 8px', fontSize:'11px', margin:0, cursor:'pointer'
                }"
              >Write</button>
              <button
                @click="replyPreviewMode = true"
                :style="{
                  background: replyPreviewMode ? '#2e2050' : 'none',
                  color:      replyPreviewMode ? '#e8e0f0' : '#9b8db0',
                  border:'1px solid #2e2050', borderRadius:'6px 6px 0 0',
                  padding:'2px 8px', fontSize:'11px', margin:0, cursor:'pointer'
                }"
              >Preview</button>
            </div>
            <textarea
              v-show="!replyPreviewMode"
              ref="replyTextarea"
              v-model="replyText"
              placeholder="Write a reply… (markdown supported)"
              maxlength="1000"
              style="
                width:100%;box-sizing:border-box;
                padding:7px;border-radius:0 8px 8px 8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;
                font-size:13px;resize:vertical;min-height:52px;
              "
            ></textarea>
            <div v-show="!replyPreviewMode" style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
              <input ref="replyImageInput" type="file" accept="image/*" style="display:none;" @change="onReplyImageSelected" />
              <button
                @click="$refs.replyImageInput.click()"
                :disabled="isUploadingReplyImage || !canUploadReplyImage"
                style="padding:3px 10px;margin:0;background:#1a1030;border:1px solid #3b1f5e;color:#c084fc;font-size:11px;"
              >{{ isUploadingReplyImage ? "Uploading…" : "📷 Upload image" }}</button>
              <span v-if="replyUploadError" style="font-size:11px;color:#fca5a5;">{{ replyUploadError }}</span>
            </div>
            <div
              v-show="replyPreviewMode"
              class="twist-body"
              v-html="replyPreviewHtml"
              style="
                min-height:52px;padding:7px;border-radius:0 8px 8px 8px;
                border:1px solid #2e2050;background:#0f0a1e;
                font-size:13px;color:#e8e0f0;line-height:1.6;word-break:break-word;
              "
            ></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span :style="{ fontSize:'11px', color: (replyOverLimit || replyMediaLimitExceeded) ? '#fca5a5' : '#5a4e70' }">
                {{ replyCharCount }} / 280 (media excluded) · media {{ replyMediaCount }}/{{ mediaLimit }}
              </span>
              <button
                @click="submitReply"
                :disabled="!canSubmitReply"
                style="font-size:12px;padding:4px 12px;"
              >{{ isReplying ? "Posting…" : "Reply" }}</button>
            </div>
            </template>

            <template v-else>
              <input
                v-model="liveReplyTitle"
                type="text"
                maxlength="80"
                placeholder="Live Twist"
                style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:12px;margin-bottom:6px;"
              />
              <input
                v-model="liveReplyBody"
                type="text"
                maxlength="280"
                placeholder="⚡ Live Twist — view on SteemTwist"
                style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:12px;margin-bottom:6px;"
              />
              <div style="display:flex;gap:4px;margin-bottom:0;">
                <button @click="liveReplyTab = 'code'"
                  :style="{ background: liveReplyTab==='code' ? '#2e2050' : 'none', color: liveReplyTab==='code' ? '#e8e0f0' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer' }">Code</button>
                <button @click="runLiveReplyPreview"
                  :style="{ background: liveReplyTab==='preview' ? '#2e2050' : 'none', color: liveReplyTab==='preview' ? '#fb923c' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer' }">▶ Preview</button>
                <button @click="liveReplyTab = 'templates'"
                  :style="{ background: liveReplyTab==='templates' ? '#2e2050' : 'none', color: liveReplyTab==='templates' ? '#22d3ee' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer' }">📄 Templates</button>
              </div>
              <textarea
                v-show="liveReplyTab === 'code'"
                v-model="liveReplyCode"
                spellcheck="false"
                placeholder="app.render('Hello from a Live Reply!')"
                style="width:100%;box-sizing:border-box;padding:7px;border-radius:0 8px 8px 8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:12px;font-family:monospace;resize:vertical;min-height:90px;line-height:1.5;"
              ></textarea>
              <div v-if="liveReplyTab === 'preview'" style="border-radius:0 8px 8px 8px;border:1px solid #2e2050;overflow:hidden;">
                <iframe :key="liveReplyPreviewKey" ref="liveReplyPreview" sandbox="allow-scripts"
                  :srcdoc="buildLiveReplySandboxDoc(liveReplyCode)"
                  :style="{ width:'100%', border:'none', display:'block', height: liveReplyIframeHeight + 'px', background:'#0f0a1e' }"
                  scrolling="no"></iframe>
              </div>
              <div v-if="liveReplyTab === 'templates'" style="border:1px solid #2e2050;border-radius:0 8px 8px 8px;background:#0a0616;padding:8px;">
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
                  <button v-for="st in [{k:'simple',label:'🔧 Simple'},{k:'greetings',label:'🎉 Greetings'},{k:'queries',label:'🔍 Queries'},{k:'actions',label:'⚡ Actions'}]"
                    :key="st.k" @click="liveReplyTemplateSubTab = st.k"
                    :style="{ borderRadius:'20px', padding:'2px 8px', fontSize:'10px', border:'1px solid', background: liveReplyTemplateSubTab===st.k ? '#2e2050' : 'none', color: liveReplyTemplateSubTab===st.k ? '#e8e0f0' : '#9b8db0', borderColor: liveReplyTemplateSubTab===st.k ? '#a855f7' : '#2e2050', margin:0, cursor:'pointer' }"
                  >{{ st.label }}</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                  <div v-for="tpl in (liveReplyTemplateSubTab==='simple' ? $options.liveTemplates : liveReplyTemplateSubTab==='greetings' ? $options.liveGreetings : liveReplyTemplateSubTab==='queries' ? $options.liveQueries : $options.liveActions)"
                    :key="tpl.id" @click="useLiveReplyTemplate(tpl)"
                    style="background:#1a1030;border:1px solid #2e2050;border-radius:8px;padding:8px;cursor:pointer;">
                    <div style="font-size:14px;">{{ tpl.icon }}</div>
                    <div style="font-size:11px;color:#e8e0f0;font-weight:600;">{{ tpl.name }}</div>
                  </div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <span style="font-size:11px;color:#5a4e70;">Code {{ liveReplyCode.length }} / 10000</span>
                <button
                  @click="submitReply"
                  :disabled="!canSubmitLiveReply"
                  style="font-size:12px;padding:4px 12px;"
                >{{ isReplying ? "Posting…" : "Publish ⚡" }}</button>
              </div>
            </template>
          </div>

          <!-- Error -->
          <div v-if="lastError" style="
            margin-top:6px;padding:6px 8px;border-radius:6px;font-size:12px;
            background:#2d0a0a;border:1px solid #7f1d1d;color:#fca5a5;
            display:flex;justify-content:space-between;align-items:center;
          ">
            <span>⚠️ {{ lastError }}</span>
            <button
              @click="lastError = ''"
              style="background:none;border:none;cursor:pointer;font-size:14px;
                     padding:0;color:#fca5a5;line-height:1;"
            >✕</button>
          </div>

          <!-- Nested children -->
          <thread-component
            v-if="showChildren"
            :author="reply.author"
            :permlink="reply.permlink"
            :depth="depth + 1"
          ></thread-component>

        </div>
      </div>
    </div>
  `
};

// ---- ThreadComponent ----
// Lazy-loads direct replies and renders each as a ReplyCardComponent.
// Used recursively: TwistCardComponent → ThreadComponent → ReplyCardComponent
//                                                        → ThreadComponent → …
const ThreadComponent = {
  name: "ThreadComponent",
  components: { ReplyCardComponent },
  props: {
    author:   { type: String,  required: true },
    permlink: { type: String,  required: true },
    depth:    { type: Number,  default: 0 },
    // Bumped by parent after posting a reply so this component re-fetches.
    refreshKey: { type: Number, default: 0 }
  },
  data() {
    return {
      replies:   [],
      loading:   false,
      loadError: ""
    };
  },
  async created() {
    await this.loadReplies();
  },
  watch: {
    // Re-fetch replies when parent signals new activity.
    async refreshKey() {
      await this.loadReplies({ force: true, retry: true });
    }
  },
  methods: {
    async loadReplies(options = {}) {
      const force = !!options.force;
      const retry = !!options.retry;
      if (this.loading && !force) return;
      this.loading = true;
      this.loadError = "";
      try {
        const hydrateReplies = async (items) => Promise.all(
          items.map(r =>
            fetchPost(r.author, r.permlink)
              .then(full => ({ ...r, active_votes: full.active_votes || [] }))
              .catch(() => r)
          )
        );
        const replies = await fetchReplies(this.author, this.permlink);
        // getContentReplies returns empty active_votes (a Steem node quirk that
        // affects both the feed root and individual posts). Enrich active_votes
        // only via a parallel getContent call so the Love count is correct.
        // All other fields (body, children, etc.) are already populated.
        const hydrated = await hydrateReplies(replies);
        this.replies = hydrated;

        // Steem nodes can lag briefly after a successful broadcast; retry a
        // few times so the new reply appears without requiring a full refresh.
        if (retry && this.refreshKey > 0 && hydrated.length < this.refreshKey) {
          let attempts = 0;
          const maxAttempts = 4;
          const retryDelayMs = 1200;
          while (attempts < maxAttempts && this.replies.length < this.refreshKey) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            const later = await fetchReplies(this.author, this.permlink);
            this.replies = await hydrateReplies(later);
          }
        }
      } catch (e) {
        this.loadError = "Could not load replies.";
      }
      this.loading = false;
    }
  },
  template: `
    <div style="margin-top:8px;border-top:2px solid #2e2050;padding-top:8px;">

      <div v-if="loading" style="color:#5a4e70;font-size:13px;padding:6px 0;">
        Loading replies…
      </div>

      <div v-else-if="loadError" style="color:#fca5a5;font-size:13px;">
        ⚠️ {{ loadError }}
      </div>

      <div v-else-if="replies.length === 0" style="color:#5a4e70;font-size:13px;">
        No replies yet.
      </div>

      <reply-card-component
        v-else
        v-for="reply in replies"
        :key="reply.permlink"
        :reply="reply"
        :depth="depth"
      ></reply-card-component>

    </div>
  `
};

// ---- LiveTwistComponent ----
// Renders a "Live Twist" — user-authored JavaScript running in a strict
// iframe sandbox. The sandbox has NO access to the parent page, the wallet,
// cookies, localStorage, or the network.
//
// Security layers (defence-in-depth):
//   1. <iframe sandbox="allow-scripts"> — isolated null origin, no same-origin
//   2. DOMPurify sanitises every HTML string the code tries to render
//   3. fetch / XHR / WebSocket overridden to throw inside the iframe
//   4. User must click ▶ Run — never auto-executed
//   5. Payload size limit: 10 KB (enforced before Run is allowed)
//   6. Parent validates event.origin === "null" on every message
//   7. User can manually stop execution at any time with the ⏹ Stop button
//
// Note: There is intentionally no auto-kill timeout. Live Twists are designed
// for interactive apps (games, dashboards, forms) that run indefinitely. The
// iframe sandbox already fully isolates runaway code from the parent page.
//
// Live Twist json_metadata shape:
//   { type: "live_twist", version: 1, code: "<JS string>", title: "My App" }
//   `code` receives a single argument `app` with the restricted API.
//
// Restricted API (app.*):
//   app.render(html)  — sanitise + set body innerHTML
//   app.text(str)     — set body as plain text (no HTML)
//   app.resize(h)     — tell parent to resize the iframe
//   app.log(msg)      — append a line to the built-in console panel
//
// ---- Shared DOMPurify config for Live Twist sandboxes ----
// Used verbatim by both LiveTwistComponent.sandboxDoc and
// LiveTwistComposerComponent.buildSandboxDoc so the viewer and the
// author's preview apply identical sanitisation rules.
// Serialised to JSON here so it can be embedded as a JS literal inside
// the srcdoc string without any escaping gymnastics.
const LIVE_TWIST_PURIFY_CONFIG = JSON.stringify({
  ALLOWED_TAGS: ["div","span","p","br","b","i","strong","em","u","s",
                 "h1","h2","h3","h4","ul","ol","li","pre","code",
                 "table","thead","tbody","tr","th","td","button",
                 "input","textarea","label","select","option",
                 "hr","blockquote","a","img"],
  ALLOWED_ATTR: ["id","class","style","type","value","placeholder",
                 "checked","disabled","readonly","href","src","alt",
                 "width","height","rows","cols","for","name","max",
                 "min","step","multiple"],
  FORBID_TAGS:  ["script","iframe","object","embed","form","frame"],
  FORBID_ATTR:  ["onclick","onerror","onload","onmouseover","onfocus",
                 "onblur","onchange","onsubmit"],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true
});

// ---- Shared query/action handler mixin ----
// Both LiveTwistComponent and LiveTwistComposerComponent need these
// methods to dispatch iframe postMessage queries/actions to steem.api
// and Steem Keychain. Defined once here and spread into both components.
const LIVE_TWIST_HANDLER_MIXIN = {
    handleQueryRequest(query, params, iframeSource, reqId) {
      // Helper to message the specific iframe running this twist.
      // iframeSource is passed in (not closed over) to avoid stale-event bugs.
      // Target origin "null" is required for sandbox="allow-scripts" iframes —
      // their origin is the opaque string "null", so wildcard "*" would broadcast
      // QUERY_RESULT to any window; "null" restricts delivery to the sandbox only.
      // reqId is echoed back so app.ask() can route results to the right Promise.
      const sendResult = (error, result) => {
        // Post directly to iframeSource — it was already validated as the
        // correct iframe window in onMessage() at event-receive time.
        // Do NOT re-read liveRef.contentWindow here: the async RPC callback
        // may fire after Vue has recycled the iframe element (e.g. a reactive
        // update increments :key), making liveRef.contentWindow stale and
        // causing the guard to silently drop every query reply.
        try {
          iframeSource.postMessage({
            type: "QUERY_RESULT",
            success: error ? false : true,
            result: result,
            _reqId: reqId || null
          }, "*");
        } catch (_) {
          // iframeSource may have been GC'd if the iframe was destroyed
          // before the RPC returned — ignore silently.
        }
      };

      // ── Param sanitisation helpers ──────────────────────────────
      // Prevents a Live Twist from passing extreme limits that would cause
      // the RPC node to return huge payloads and clog the main thread.
      const MAX_LIMIT = 100;
      const safeLimit = (v) => Math.min(Math.max(parseInt(v) || 20, 1), MAX_LIMIT);
      // Coerce to string and cap length to prevent oversized RPC payloads.
      const safeStr   = (v) => (typeof v === "string" ? v.slice(0, 256) : "");
      // Generic integer coercion with a fallback default.
      const safeInt   = (v, def = 0) => (Number.isFinite(parseInt(v)) ? parseInt(v) : def);

      // Queries are usually safe, so you might not need a confirm() dialog
      if (query === "getTrendingTags") {
				// Tags
				steem.api.getTrendingTags(safeStr(params.afterTag), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getBlog") {
				steem.api.getBlog(safeStr(params.account), safeInt(params.entryId), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getBlogAuthors") {
				steem.api.getBlogAuthors(safeStr(params.blogAccount), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getBlogEntries") {
				steem.api.getBlogEntries(safeStr(params.account), safeInt(params.entryId), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByTrending30") {
				steem.api.getDiscussionsByTrending30((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByCreated") {
				steem.api.getDiscussionsByCreated((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByActive") {
				steem.api.getDiscussionsByActive((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByCashout") {
				steem.api.getDiscussionsByCashout((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByPayout") {
				steem.api.getDiscussionsByPayout((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByVotes") {
				steem.api.getDiscussionsByVotes((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByChildren") {
				steem.api.getDiscussionsByChildren((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByHot") {
				steem.api.getDiscussionsByHot((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByFeed") {
				steem.api.getDiscussionsByFeed((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByBlog") {
				steem.api.getDiscussionsByBlog((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByComments") {
				steem.api.getDiscussionsByComments((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByPromoted") {
				steem.api.getDiscussionsByPromoted((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getCommentDiscussionsByPayout") {
				steem.api.getCommentDiscussionsByPayout((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getPostDiscussionsByPayout") {
				steem.api.getPostDiscussionsByPayout((params.query && typeof params.query === 'object') ? {...params.query, tag: safeStr(params.query.tag), limit: safeLimit(params.query.limit)} : {}, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getBlockHeader") {
				// Blocks and transactions

				steem.api.getBlockHeader(safeInt(params.blockNum), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getBlock") {
				steem.api.getBlock(safeInt(params.blockNum), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getOpsInBlock") {
				steem.api.getOpsInBlock(safeInt(params.blockNum), !!params.onlyVirtual, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getStateWithPath") {
				steem.api.getStateWith(safeStr(params.path), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getStateWithOptions") {
				steem.api.getStateWith(safeStr(params.options), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getTrendingCategories") {
				steem.api.getTrendingCategories(safeStr(params.after), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getBestCategories") {
				steem.api.getBestCategories(safeStr(params.after), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getActiveCategories") {
				steem.api.getActiveCategories(safeStr(params.after), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRecentCategories") {
				steem.api.getRecentCategories(safeStr(params.after), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getConfig") {
				// Globals

				steem.api.getConfig(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDynamicGlobalProperties") {
				steem.api.getDynamicGlobalProperties(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getChainProperties") {
				steem.api.getChainProperties(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getFeedEntries") {
				steem.api.getFeedEntries(safeStr(params.account), safeInt(params.entryId), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getFeedHistory") {
				steem.api.getFeedHistory(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getCurrentMedianHistoryPrice") {
				steem.api.getCurrentMedianHistoryPrice(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getTicker") {
				steem.api.getTicker(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getTradeHistory") {
				steem.api.getTradeHistory(safeStr(params.start), safeStr(params.end), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getVersion") {
				steem.api.getVersion(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getVolume") {
				steem.api.getVolume(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getHardforkVersion") {
				steem.api.getHardforkVersion(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getNextScheduledHardfork") {
				steem.api.getNextScheduledHardfork(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRewardFund") {
				steem.api.getRewardFund(safeStr(params.name), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getVestingDelegations") {
				steem.api.getVestingDelegations(safeStr(params.account), safeStr(params.from), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccounts") {
				// Accounts

				steem.api.getAccounts(Array.isArray(params.names) ? params.names.slice(0,10).map(n=>safeStr(n)) : [], function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountReferences") {
				steem.api.getAccountReferences(safeInt(params.accountId), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "lookupAccountNames") {
				steem.api.lookupAccountNames(Array.isArray(params.accountNames) ? params.accountNames.slice(0,10).map(n=>safeStr(n)) : [], function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "lookupAccounts") {
				steem.api.lookupAccounts(safeStr(params.lowerBoundName), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountCount") {
				steem.api.getAccountCount(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getConversionRequests") {
				steem.api.getConversionRequests(safeStr(params.accountName), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountHistory") {
				steem.api.getAccountHistory(safeStr(params.account), safeInt(params.from, -1), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getOwnerHistory") {
				steem.api.getOwnerHistory(safeStr(params.account), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRecoveryRequest") {
				steem.api.getRecoveryRequest(safeStr(params.account), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountBandwidth") {
				steem.api.getAccountBandwidth(safeStr(params.account), safeStr(params.bandwidthType), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountBandwidthWith") {
				steem.api.getAccountBandwidthWith(safeStr(params.options), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountReputations") {
				steem.api.getAccountReputations(safeStr(params.lowerBoundName), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "findChangeRecoveryAccountRequests") {
				steem.api.findChangeRecoveryAccountRequests(Array.isArray(params.names) ? params.names.slice(0,10).map(n=>safeStr(n)) : [], function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getOrderBook") {
				// Market

				steem.api.getOrderBook(safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getMarketOrderBook") {
				steem.api.getMarketOrderBook(safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getMarketOrderBookWith") {
				steem.api.getMarketOrderBookWith(safeStr(params.options), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getOpenOrders") {
				steem.api.getOpenOrders(safeStr(params.owner), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getLiquidityQueue") {
				steem.api.getLiquidityQueue(safeStr(params.startAccount), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getMarketHistoryBuckets") {
				steem.api.getMarketHistoryBuckets(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getTransactionHex") {
				// Authority / validation

				steem.api.getTransactionHex(params.trx, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getTransaction") {
				steem.api.getTransaction(safeStr(params.trxId), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRequiredSignatures") {
				steem.api.getRequiredSignatures(params.trx, params.availableKeys, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getPotentialSignatures") {
				steem.api.getPotentialSignatures(params.trx, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "verifyAuthority") {
				steem.api.verifyAuthority(params.trx, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "verifyAccountAuthority") {
				steem.api.verifyAccountAuthority(params.nameOrId, params.signers, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getTagsUsedByAuthor") {
				steem.api.getTagsUsedByAuthor(safeStr(params.author), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getActiveVotes") {
				// Votes

				steem.api.getActiveVotes(safeStr(params.author), safeStr(params.permlink), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getAccountVotes") {
				steem.api.getAccountVotes(safeStr(params.voter), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getContent") {
				steem.api.getContent(safeStr(params.author), safeStr(params.permlink), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getContentReplies") {
				steem.api.getContentReplies(safeStr(params.author), safeStr(params.permlink), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getDiscussionsByAuthorBeforeDate") {
				steem.api.getDiscussionsByAuthorBeforeDate(safeStr(params.author), safeStr(params.startPermlink), safeStr(params.beforeDate), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRebloggedBy") {
				steem.api.getRebloggedBy(safeStr(params.author), safeStr(params.permlink), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRepliesByLastUpdate") {
				steem.api.getRepliesByLastUpdate(safeStr(params.startAuthor), safeStr(params.startPermlink), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getWitnesses") {
				// Witnesses

				steem.api.getWitnesses(Array.isArray(params.witnessIds) ? params.witnessIds.slice(0,10).map(n=>safeStr(n)) : [], function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getWitnessByAccount") {
				steem.api.getWitnessByAccount(safeStr(params.accountName), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getWitnessesByVote") {
				steem.api.getWitnessesByVote(safeStr(params.from), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "lookupWitnessAccounts") {
				steem.api.lookupWitnessAccounts(safeStr(params.lowerBoundName), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getWitnessCount") {
				steem.api.getWitnessCount(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getActiveWitnesses") {
				steem.api.getActiveWitnesses(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getWitnessSchedule") {
				steem.api.getWitnessSchedule(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getMinerQueue") {
				steem.api.getMinerQueue(function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getApiByName") {
				steem.api.getApiByName(params.apiName, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getFollowers") {
				// Follow API
				steem.api.getFollowers(safeStr(params.following), safeStr(params.startFollower), safeStr(params.followType), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getFollowing") {
				steem.api.getFollowing(safeStr(params.follower), safeStr(params.startFollowing), safeStr(params.followType), safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getFollowCount") {
				steem.api.getFollowCount(safeStr(params.account), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getWithdrawRoutes") {
				steem.api.getWithdrawRoutes(safeStr(params.account), safeStr(params.withdrawRouteType), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getRecentTrades") {
				steem.api.getRecentTrades(safeLimit(params.limit), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getSavingsWithdrawFrom") {
				steem.api.getSavingsWithdrawFrom(safeStr(params.account), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "getSavingsWithdrawTo") {
				steem.api.getSavingsWithdrawTo(safeStr(params.account), function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "amount") {
				try {
					const res = steem.formatter.amount(params._amount, safeStr(params.asset));
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "vestingSteem") {
				steem.formatter.vestingSteem(safeStr(params.account), params.gprops, function(err, res) {
          sendResult(err, res);
				});
      } else if (query === "numberWithCommas") {
				try {
					const res = steem.formatter.numberWithCommas(params.x);
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "estimateAccountValue") {
				try {
					const res = steem.formatter.estimateAccountValue(safeStr(params.account));
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "createSuggestedPassword") {
				try {
					const res = steem.formatter.createSuggestedPassword();
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "commentPermlink") {
				try {
					const res = steem.formatter.commentPermlink(safeStr(params.parentAuthor), safeStr(params.parentPermlink));
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "reputation") {
				try {
					const res = steem.formatter.reputation(safeInt(params.reputation));
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "vestToSteem") {
				try {
					const res = steem.formatter.vestToSteem(params.vestingShares, params.totalVestingShares, params.totalVestingFundSteem);
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "validateAccountName") {
				try {
					const res = steem.utils.validateAccountName(safeStr(params.account));
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else if (query === "camelCase") {
				try {
					const res = steem.utils.camelCase(safeStr(params.str));
          sendResult(null, res);
				} catch (error) {
          sendResult(error, null);
				}
      } else {
        console.log(query + " is unsupported.");
      }
    },
    
    // Helper method to HANDLE ACTIONS to access blockchain
    handleActionRequest(action, params, iframeSource) {
      // Helper to message the specific iframe running this twist.
      // iframeSource is passed in (not closed over) to avoid stale-event bugs.
      // Target origin "null" is required for sandbox="allow-scripts" iframes —
      // their origin is the opaque string "null", so wildcard "*" would broadcast
      // ACTION_RESULT to any window; "null" restricts delivery to the sandbox only.
      const sendBack = (success) => {
        // Post directly to iframeSource — already validated at event-receive
        // time. Avoid re-reading liveRef.contentWindow asynchronously; after
        // Keychain returns the iframe may have been recycled by Vue, making the
        // ref stale and silently dropping the ACTION_RESULT reply.
        try {
          iframeSource.postMessage({
            type: "ACTION_RESULT",
            success: success,
            action: action
          }, "*");
        } catch (_) {
          // iframeSource GC'd — ignore.
        }
      };
      // Check the global window object for Keychain
      if (!window.steem_keychain) {
        this.notify("Steem Keychain extension is not installed.", "error");
        sendBack(false);
		return;
      }
      // Access injected Vue state via 'this'
      const currentUsername = this.username;
      if (!currentUsername) {
        this.notify("Please log in first to use this Live Twist feature.", "error");
        sendBack(false);
		return;
      }

      // ── Param sanitisation ────────────────────────────────────────────────
      // Validate and coerce all action params before use to prevent a crafted
      // Live Twist from passing unexpected types or visually spoofed values.
      // _VALID_STEEM_NAME and safeStr are defined in blockchain.js / above.
      const safeActionStr  = (v, max = 256) => (typeof v === "string" ? v.slice(0, max) : "");
      const safeActionName = (v) => {
        const s = safeActionStr(v, 16).toLowerCase();
        return _VALID_STEEM_NAME.test(s) ? s : "";
      };
      const safeActionAmount = (v) => {
        // Accept "1.000" or "1" — reject anything that isn't a non-negative decimal string.
        const s = safeActionStr(v, 32);
        return /^\d+(\.\d+)?$/.test(s) ? s : "0";
      };
      const ALLOWED_CURRENCIES = ["STEEM", "SBD"];

      // Build a human-readable, spoofing-resistant summary of what the action
      // will do, then show it in a styled in-page modal instead of confirm().
      // The modal renders labelled rows so unusual unicode / newlines in values
      // are visually obvious to the user before they approve.
      let rows = [];   // [{ label, value }] displayed in the modal
      let execAction;  // () => void — runs the actual Keychain call on approval

      if (action === "vote") {
        const author   = safeActionName(params.author);
        const permlink = safeActionStr(params.permlink, 255);
        const weight   = Math.min(Math.max(parseInt(params.weight) || 10000, -10000), 10000);
        if (!author) { this.notify("vote: invalid author.", "error"); return; }
        rows = [
          { label: "Action",   value: "❤️ Vote" },
          { label: "Author",   value: "@" + author },
          { label: "Permlink", value: permlink },
          { label: "Weight",   value: (weight / 100).toFixed(0) + "%" }
        ];
        execAction = (cb) => this.voteTwist(currentUsername, permlink, author, weight, cb);

      } else if (action === "reply") {
        const parentAuthor   = safeActionName(params.parentAuthor);
        const parentPermlink = safeActionStr(params.parentPermlink, 255);
        const message        = safeActionStr(params.message, 2000);
        if (!message) { this.notify("reply: empty message.", "error"); return; }
        rows = [
          { label: "Action",        value: "💬 Reply" },
          { label: "Replying to",   value: "@" + parentAuthor + "/" + parentPermlink },
          { label: "Message",       value: message.slice(0, 120) + (message.length > 120 ? "…" : "") }
        ];
        execAction = (cb) => this.postTwistReply(currentUsername, message, parentAuthor, parentPermlink, cb);

      } else if (action === "retwist") {
        const author   = safeActionName(params.author);
        const permlink = safeActionStr(params.permlink, 255);
        if (!author) { this.notify("retwist: invalid author.", "error"); return; }
        rows = [
          { label: "Action",   value: "🔁 Retwist" },
          { label: "Author",   value: "@" + author },
          { label: "Permlink", value: permlink }
        ];
        execAction = (cb) => this.retwistPost(currentUsername, author, permlink, cb);

      } else if (action === "follow") {
        const following = safeActionName(params.following);
        if (!following) { this.notify("follow: invalid username.", "error"); return; }
        rows = [
          { label: "Action",  value: "➕ Follow" },
          { label: "Account", value: "@" + following }
        ];
        execAction = (cb) => this.followUser(currentUsername, following, cb);

      } else if (action === "unfollow") {
        const following = safeActionName(params.following);
        if (!following) { this.notify("unfollow: invalid username.", "error"); return; }
        rows = [
          { label: "Action",  value: "➖ Unfollow" },
          { label: "Account", value: "@" + following }
        ];
        execAction = (cb) => this.unfollowUser(currentUsername, following, cb);

      } else if (action === "transfer") {
        const to       = safeActionName(params.to);
        const amount   = safeActionAmount(params.amount);
        const currency = ALLOWED_CURRENCIES.includes(params.currency) ? params.currency : "STEEM";
        const memo     = safeActionStr(params.memo || "", 2048);
        if (!to)              { this.notify("transfer: invalid recipient.", "error"); return; }
        if (amount === "0")   { this.notify("transfer: invalid amount.", "error"); return; }
        rows = [
          { label: "Action",   value: "💸 Transfer" },
          { label: "To",       value: "@" + to },
          { label: "Amount",   value: amount + " " + currency },
          { label: "Memo",     value: memo ? memo.slice(0, 120) + (memo.length > 120 ? "…" : "") : "(none)" }
        ];
        execAction = (cb) => window.steem_keychain.requestTransfer(currentUsername, to, amount, memo, currency, cb);

      } else if (action === "delegate") {
        const delegatee = safeActionName(params.delegatee);
        const amount    = safeActionAmount(params.amount);
        const unit      = params.unit === "SP" ? "SP" : "VEST";
        if (!delegatee)     { this.notify("delegate: invalid delegatee.", "error"); return; }
        if (amount === "0") { this.notify("delegate: invalid amount.", "error"); return; }
        rows = [
          { label: "Action",    value: "🤝 Delegate" },
          { label: "To",        value: "@" + delegatee },
          { label: "Amount",    value: amount + " " + unit }
        ];
        execAction = (cb) => window.steem_keychain.requestDelegation(currentUsername, delegatee, amount, unit, cb);

      } else if (action === "voteWitness") {
        const witness  = safeActionName(params.witness);
        const vote     = !!params.vote;
        if (!witness) { this.notify("voteWitness: invalid witness.", "error"); return; }
        rows = [
          { label: "Action",  value: vote ? "✅ Approve witness" : "❌ Remove witness vote" },
          { label: "Witness", value: "@" + witness }
        ];
        execAction = (cb) => window.steem_keychain.requestWitnessVote(currentUsername, witness, vote, cb);

      } else if (action === "powerUp") {
        const to     = safeActionName(params.to) || currentUsername;
        const amount = safeActionAmount(params.amount);
        if (amount === "0") { this.notify("powerUp: invalid amount.", "error"); return; }
        rows = [
          { label: "Action", value: "⚡ Power Up" },
          { label: "To",     value: "@" + to },
          { label: "Amount", value: amount + " STEEM" }
        ];
        execAction = (cb) => window.steem_keychain.requestPowerUp(currentUsername, to, amount, cb);

      } else if (action === "powerDown") {
        const amount = safeActionAmount(params.amount);
        if (amount === "0") { this.notify("powerDown: invalid amount.", "error"); return; }
        rows = [
          { label: "Action", value: "🔽 Power Down" },
          { label: "Amount", value: amount + " VESTS" }
        ];
        execAction = (cb) => window.steem_keychain.requestPowerDown(currentUsername, amount, cb);

      } else {
        console.log(action + " is unsupported.");
        sendBack(false);
		return;
      }

      // ── In-page confirmation modal ────────────────────────────────────────
      // Replaces confirm() with a styled overlay that clearly labels each
      // field so spoofed unicode / misleading values are visually apparent.
      const modalId = "lt-action-modal-" + Date.now();
      const rowsHtml = rows.map(r =>
        `<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #2e2050;font-size:13px;">
           <span style="color:#9b8db0;min-width:80px;flex-shrink:0;">${r.label}</span>
           <span style="color:#e8e0f0;word-break:break-all;">${
             String(r.value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
           }</span>
         </div>`
      ).join("");

      const overlay = document.createElement("div");
      overlay.id = modalId;
      overlay.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;
                    display:flex;align-items:center;justify-content:center;">
          <div style="background:#1e1535;border:1px solid #a855f7;border-radius:12px;
                      padding:20px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.6);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <span style="font-size:18px;">⚡</span>
              <span style="font-weight:700;color:#c084fc;font-size:15px;">Live Twist Action Request</span>
            </div>
            <div style="font-size:12px;color:#9b8db0;margin-bottom:10px;">
              This Live Twist is requesting a blockchain action on your behalf:
            </div>
            <div style="background:#0f0a1e;border-radius:8px;padding:10px;margin-bottom:16px;">
              ${rowsHtml}
            </div>
            <div style="font-size:12px;color:#fbbf24;margin-bottom:16px;padding:8px;
                        background:#2d1f00;border-radius:6px;border:1px solid #78350f;">
              ⚠️ Verify all details carefully before approving. You will be asked to
              confirm again in Steem Keychain.
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
              <button id="${modalId}-deny"
                style="background:#2d0a0a;color:#fca5a5;border:1px solid #7f1d1d;
                       border-radius:8px;padding:8px 20px;font-size:14px;cursor:pointer;margin:0;">
                ✕ Deny
              </button>
              <button id="${modalId}-approve"
                style="background:linear-gradient(135deg,#6d28d9,#e0187a);color:#fff;
                       border:none;border-radius:8px;padding:8px 20px;font-size:14px;
                       font-weight:600;cursor:pointer;margin:0;">
                ✓ Approve
              </button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const cleanup = () => { try { document.body.removeChild(overlay); } catch {} };

      document.getElementById(modalId + "-deny").onclick = () => {
        cleanup();
        sendBack(false);
      };
      document.getElementById(modalId + "-approve").onclick = () => {
        cleanup();
        execAction((res) => {
          if (res.success) {
            this.notify(action + " succeeded", "success");
          } else {
            this.notify(res.error || res.message || action + " failed.", "error");
          }
          sendBack(res.success);
        });
      };
    }
};

const LiveTwistComponent = {
  name: "LiveTwistComponent",
  inject: ["username", "hasKeychain", "notify", "voteTwist", "postTwistReply", "retwistPost", "followUser", "unfollowUser"],
  props: {
    post: { type: Object, required: true }
  },
  data() {
    return {
      running:    false,
      error:      "",
      iframeKey:  0   // increment to force iframe recreation on re-run
    };
  },
  computed: {
    meta() {
      try {
        const raw = this.post.json_metadata;
        return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
      } catch { return {}; }
    },
    code()    { return (this.meta.code  || "").trim(); },
    title()   { return (this.meta.title || "Live Twist").trim(); },
    // Body is the human-readable description written by the author.
    // Strip the SteemTwist back-link appended by buildZeroPayoutOps before display.
    bodyText() {
      const raw = stripLiveTwistLabelPrefix(this.post.body || "", this.title);
      // Also skip the generic placeholder that means "no real description was provided"
      const placeholder = "\u26a1 Live Twist \u2014 view on SteemTwist";
      return (raw === placeholder || raw === "\u26a1 Live Twist - view on SteemTwist") ? "" : raw;
    },
    bodyHtml() {
      return this.bodyText
        ? DOMPurify.sanitize(renderMarkdown(this.bodyText))
        : "";
    },
    codeSize(){ return new TextEncoder().encode(this.code).length; },
    tooBig()  { return this.codeSize > 10240; },   // 10 KB limit
    // The srcdoc injected into the sandboxed iframe.
    // DOMPurify is inlined so the iframe never needs to load external scripts.
    sandboxDoc() {
      // We encode the user code as a JSON string so it survives
      // the srcdoc attribute escaping without any eval trickery.
      const escapedCode = JSON.stringify(this.code);
      // Embed the shared DOMPurify config so viewer and composer use identical rules.
      const escapedPurifyConfig = LIVE_TWIST_PURIFY_CONFIG;
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js" integrity="sha256-wIRQlqfEpnQfNirFBslMHH0n3GA7zBv2Slh/dvLb46E=" crossorigin="anonymous"></script>
<style>
  body { margin:0; padding:8px; font-family:system-ui,sans-serif;
         font-size:14px; background:#0f0a1e; color:#e8e0f0;
         box-sizing:border-box; word-break:break-word; }
  * { box-sizing:border-box; }
  button { cursor:pointer; padding:5px 12px; border-radius:6px;
           background:#6d28d9; color:#fff; border:none; font-size:13px; }
  input,textarea { background:#1a1030; color:#e8e0f0; border:1px solid #3b1f5e;
                   border-radius:6px; padding:5px 8px; font-size:13px; width:100%; }
  #_console { margin-top:8px; padding:6px; background:#0a0616;
              border-radius:6px; font-family:monospace; font-size:12px;
              color:#9b8db0; max-height:80px; overflow-y:auto;
              border:1px solid #2e1060; display:none; }
</style>
</head>
<body>
<div id="_root"></div>
<div id="_console"></div>
<script>
const PARENT_ORIGIN = "https://puncakbukit.github.io";
const purify = DOMPurify;
(function() {
  // ── Kill the network ─────────────────────────────────────────
  window.fetch       = () => Promise.reject(new Error("Network blocked"));
  window.XMLHttpRequest = function() { throw new Error("Network blocked"); };
  window.WebSocket   = function() { throw new Error("Network blocked"); };
  window.open        = () => null;

  const _purifyConfig = ${escapedPurifyConfig};
  function sanitize(html) {
    if (typeof html !== "string") return "";
    // Use the shared config injected from LIVE_TWIST_PURIFY_CONFIG so the
    // viewer and the composer preview apply identical sanitisation rules.
    if (purify) return purify.sanitize(html, _purifyConfig);
    // Sandbox is already fully isolated — return html as-is when DOMPurify unavailable
    return html;
  }

  // ── Restricted API exposed to Live Twist code ─────────────────
  const _cons = document.getElementById("_console");
  const _root = document.getElementById("_root");

  const app = {
    render(html) {
      _root.innerHTML = sanitize(String(html));
      // Resize after a microtask so the DOM has fully settled before measuring.
      setTimeout(function() {
        var h = document.body.scrollHeight;
        if (h > 40) parent.postMessage({ type: "resize", height: h + 16 }, PARENT_ORIGIN);
      }, 0);
    },
    text(str) {
      _root.textContent = String(str).slice(0, 2000);
    },
    resize(h) {
      const height = Math.min(Math.max(parseInt(h) || 200, 40), 600);
      parent.postMessage({ type: "resize", height }, PARENT_ORIGIN);
    },
    log(...args) {
      _cons.style.display = "block";
      const line = document.createElement("div");
      line.textContent = args.map(a =>
        typeof a === "object" ? JSON.stringify(a) : String(a)
      ).join(" ");
      _cons.appendChild(line);
      _cons.scrollTop = _cons.scrollHeight;
    },
    // --- Queries to access blockchain ---	
	query(type, params = []) {
	  parent.postMessage({ 
	    type: "LIVE_TWIST_QUERY", 
		queryType: type, 
		params: params 
	  }, PARENT_ORIGIN);
    },
    // --- Actions to access blockchain ---
    action(type, params = {}) {
      parent.postMessage({ 
        type: "LIVE_TWIST_ACTION", 
        actionType: type, 
        params: params 
      }, PARENT_ORIGIN);
    },
    onResult(callback) {
      // Replace-not-accumulate: remove any previous onResult listener before
      // registering the new one, so multiple app.onResult() calls within one
      // run don't stack up and fire the callback multiple times per result.
      if (app._onResultHandler) {
        window.removeEventListener("message", app._onResultHandler);
      }
      app._onResultHandler = (e) => {
        if (e.data.type === "QUERY_RESULT") {
          callback(e.data.success, e.data.result);
        } else if (e.data.type === "ACTION_RESULT") {
          callback(e.data.success, e.data.action);
        }
      };
      window.addEventListener("message", app._onResultHandler);
    },
    // --- Request-ID-correlated query for concurrent use ---
    // app.ask(type, params) returns a Promise that resolves/rejects with
    // the result of that specific request, regardless of other in-flight
    // requests. Use this instead of app.query()+app.onResult() when you
    // need to fire multiple queries concurrently without callback collisions.
    // Example: const [tags, props] = await Promise.all([
    //            app.ask("getTrendingTags", { limit: 5 }),
    //            app.ask("getDynamicGlobalProperties") ]);
    ask(type, params = {}) {
      const reqId = Math.random().toString(36).slice(2);
      return new Promise((resolve, reject) => {
        const handler = (e) => {
          const d = e.data;
          if (d.type === "QUERY_RESULT" && d._reqId === reqId) {
            window.removeEventListener("message", handler);
            if (d.success) resolve(d.result);
            else reject(new Error("Query failed: " + type));
          }
        };
        window.addEventListener("message", handler);
        parent.postMessage({
          type: "LIVE_TWIST_QUERY",
          queryType: type,
          params: params,
          _reqId: reqId
        }, PARENT_ORIGIN);
      });
    }
  };

  // ── Handle kill signal from parent (future timeout support) ──
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "kill") {
      _root.innerHTML = "<em style='color:#fca5a5'>Execution timed out.</em>";
    }
  });

  // ── Execute user code ─────────────────────────────────────────
  const userCode = ${escapedCode};
  try {
    const fn = new Function("app", userCode);
    const result = fn(app);
    // Support async code
    if (result && typeof result.catch === "function") {
      result.catch(err => {
        _root.innerHTML = "<em style='color:#fca5a5'>Error: " +
          String(err).replace(/</g,"&lt;") + "</em>";
      });
    }
    // Signal parent that execution started
    parent.postMessage({ type: "running" }, PARENT_ORIGIN);
  } catch (err) {
    _root.innerHTML = "<em style='color:#fca5a5'>Error: " +
      String(err).replace(/</g,"&lt;") + "</em>";
    parent.postMessage({ type: "error", message: String(err) }, PARENT_ORIGIN);
  }

  // Auto-resize based on content height
  setTimeout(() => {
    const h = document.body.scrollHeight;
    if (h > 40) parent.postMessage({ type: "resize", height: h + 16 }, PARENT_ORIGIN);
  }, 100);
})();
${'<'}/script>
</body>
</html>`;
    }
  },
  methods: {
    run() {
      if (this.tooBig) {
        this.error = "Live Twist code exceeds the 10 KB size limit.";
        return;
      }
      this.error   = "";
      this.running = true;
      this.iframeKey++;  // forces Vue to recreate the iframe element
    },

    stop() {
      this.running  = false;
      this.iframeKey++;
    },

    onMessage(e) {
      // Only accept messages from the sandboxed iframe (origin === "null")
      if (e.origin !== "null") return;
      // Capture the source window immediately — async callbacks must not
      // close over `e` directly because the event object may be recycled.
      const iframeSource = e.source;
      const { type, height, queryType, actionType, params, _reqId } = e.data || {};
      const iframe = this.$refs.sandbox;
      if (!iframe || iframeSource !== iframe.contentWindow) return;
      if (type === "resize") {
        if (height) {
          iframe.style.height = Math.min(height, 600) + "px";
		}
      } else if (type === "kill") {
	    console.warn("Live Twist killed due to timeout");
        // Forcefully reset iframe
        iframe.srcdoc = "<html><body>Execution terminated</body></html>";
	  } else if (type === "LIVE_TWIST_QUERY") {
      // --- HANDLE QUERIES to the blockchain ---
        this.handleQueryRequest(queryType, params, iframeSource, _reqId);
      } else if (type === "LIVE_TWIST_ACTION") {
      // --- HANDLE ACTIONS to access blockchain ---
        this.handleActionRequest(actionType, params, iframeSource);
      }
    },
    
    // Helper method to HANDLE QUERIES to the blockchain
    ...LIVE_TWIST_HANDLER_MIXIN,
  },

  mounted() {
    window.addEventListener("message", this.onMessage);
  },
  unmounted() {
    window.removeEventListener("message", this.onMessage);
  },

  template: `
    <div style="
      background:#0f0a1e;border:1px solid #2e1060;border-radius:8px;
      overflow:hidden;margin-top:4px;
    ">
      <!-- Header bar -->
      <div style="
        display:flex;align-items:center;justify-content:space-between;
        padding:6px 10px;background:#1a1030;border-bottom:1px solid #2e1060;
      ">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:14px;">⚡</span>
          <span style="font-size:13px;font-weight:600;color:#c084fc;">{{ title }}</span>
          <span style="font-size:11px;color:#5a4e70;">Live Twist</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span v-if="tooBig" style="font-size:11px;color:#fca5a5;">⚠ Too large</span>
          <span v-else style="font-size:11px;color:#5a4e70;">{{ (codeSize/1024).toFixed(1) }} KB</span>
          <button
            v-if="!running"
            @click="run"
            :disabled="tooBig"
            style="
              background:linear-gradient(135deg,#6d28d9,#e0187a);
              color:#fff;border:none;border-radius:6px;
              padding:3px 12px;font-size:12px;font-weight:600;margin:0;cursor:pointer;
            "
          >▶ Run</button>
          <button
            v-else
            @click="stop"
            style="
              background:#2d0a0a;color:#fca5a5;border:1px solid #7f1d1d;
              border-radius:6px;padding:3px 12px;font-size:12px;margin:0;cursor:pointer;
            "
          >■ Stop</button>
        </div>
      </div>

      <!-- Author description — shown when body is not just the generic placeholder -->
      <div v-if="bodyText" style="
        padding:8px 10px;font-size:13px;color:#c0b0e0;line-height:1.6;
        border-bottom:1px solid #1a0a30;background:#120820;word-break:break-word;
      " v-html="bodyHtml"></div>

      <!-- Sandbox iframe (only mounted when running) -->
      <div v-if="running" style="padding:0;">
        <iframe
          :key="iframeKey"
          ref="sandbox"
          sandbox="allow-scripts"
		  allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'"
          :srcdoc="sandboxDoc"
          style="
            width:100%;border:none;display:block;
            min-height:60px;height:200px;
            background:#0f0a1e;
          "
          scrolling="no"
        ></iframe>
      </div>

      <!-- Idle placeholder -->
      <div v-else style="
        padding:12px;font-size:13px;color:#5a4e70;font-style:italic;
      ">
        Click ▶ Run to execute this Live Twist in a secure sandbox.
      </div>

      <!-- Error message -->
      <div v-if="error" style="
        padding:8px 10px;font-size:12px;color:#fca5a5;
        background:#2d0a0a;border-top:1px solid #7f1d1d;
      ">⚠️ {{ error }}</div>

      <!-- Security notice -->
      <div style="
        padding:4px 10px;font-size:11px;color:#3b2060;
        border-top:1px solid #1a0a30;
      ">
        🔒 Runs in isolated sandbox — no wallet, network, or page access
      </div>
    </div>
  `
};

// ---- TwistCardComponent ----
// Renders a single twist.
// Long-body posts (> PREVIEW_LENGTH) or busy threads (children > THREAD_REPLY_THRESHOLD)
// are shown collapsed with a preview and an "Expand thread" button.
// The 💬 reply button independently toggles ThreadComponent for any post that has replies,
// fixing the case where short posts with replies never showed them.
const TwistCardComponent = {
  name: "TwistCardComponent",
  liveTemplates: LIVE_TWIST_TEMPLATES,
  liveGreetings: LIVE_TWIST_GREETINGS,
  liveQueries: LIVE_TWIST_QUERIES,
  liveActions: LIVE_TWIST_ACTIONS,
  inject: ["notify"],
  components: { ThreadComponent, LiveTwistComponent },
  props: {
    post:        { type: Object,  required: true },
    username:    { type: String,  default: "" },
    hasKeychain: { type: Boolean, default: false },
    pinned:      { type: Boolean, default: false }   // true when this card is the pinned twist
  },
  emits: ["voted", "replied", "pin", "unpin", "deleted"],
  data() {
    return {
      showReplyBox:     false,
      replyMode:        draftStorage.load("reply_mode_" + this.post.permlink, "twist"),
      replyPreviewMode: false,
      // Auto-expand replies if the post already has some.
      showReplies:     (this.post.children || 0) > 0,
      replyText:       draftStorage.load("reply_" + this.post.permlink, ""),
      liveReplyTitle:  draftStorage.load("live_reply_title_" + this.post.permlink, ""),
      liveReplyBody:   draftStorage.load("live_reply_body_" + this.post.permlink, ""),
      liveReplyCode:   draftStorage.load("live_reply_code_" + this.post.permlink, ""),
      liveReplyTab:    "code",
      liveReplyTemplateSubTab: "simple",
      liveReplyPreviewKey: 0,
      liveReplyIframeHeight: 200,
      isUploadingReplyImage: false,
      replyUploadError: "",
      isReplying:      false,
      isVoting:        false,
      hasVoted:        false,
      isRetwisting:    false,
      hasRetwisted:    false,
      replyCount:      this.post.children || 0,
      lastError:       "",
      threadExpanded:  false,
      isPinning:       false,
      showEditBox:     false,
      isLiveEditBox:   false,   // true when editing a Live Twist
      editText:        "",
      editCode:        "",      // live twist code being edited
      editTitle:       "",      // live twist card label being edited
      editBody:        "",      // live twist body being edited
      isEditing:       false,
      showDeleteConfirm: false,
      isDeleting:      false,
      editedBody:      null,    // local override after successful edit
      editedCode:      null,    // local code override after live twist edit
      // ── Live Twist flag (downvote + reason reply) ──────────────────
      showFlagPanel:   false,   // flag panel open/closed
      flagReason:      null,    // selected reason id or null
      isFlagging:      false,   // broadcast in progress
      hasFlagged:      false,   // optimistic: flag has been cast this session
      flagCount:       0        // derived from active_votes on mount
    };
  },
  computed: {
    isOwnPost() {
      return !!this.username && this.username === this.post.author;
    },
    isSecretTwist() {
      try { return JSON.parse(this.post.json_metadata || "{}").type === "secret_twist"; }
      catch { return false; }
    },
    isLiveTwist() {
      try {
        const raw = this.post.json_metadata;
        const meta = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
        return meta.type === "live_twist" && !!meta.code;
      } catch { return false; }
    },
    avatarUrl() {
      return `https://steemitimages.com/u/${this.post.author}/avatar/small`;
    },
    relativeTime() {
      const diff = Date.now() - steemDate(this.post.created).getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60)  return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60)  return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)  return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    },
    // Full UTC timestamp shown as tooltip and on the twist page link
    absoluteTime() {
      const d = steemDate(this.post.created);
      if (isNaN(d)) return "";
      return d.toUTCString().replace(" GMT", " UTC");
    },
    // Hash-router link to the dedicated twist page
    twistUrl() {
      return `#/@${this.post.author}/${this.post.permlink}`;
    },
    upvoteCount() {
      const votes = this.post.active_votes || [];
      // active_votes is only populated by getContent (single post fetch).
      // getContentReplies returns it empty, so fall back to net_votes which
      // is always present and equals upvotes minus downvotes.
      const count = votes.length > 0
        ? votes.filter(v => v.percent > 0).length
        : Math.max(0, this.post.net_votes || 0);
      return count + (this.hasVoted ? 1 : 0);
    },
    canAct() {
      return !!this.username && this.hasKeychain;
    },
    // Count of negative votes already recorded on this post.
    // Incremented optimistically after a successful flag.
    downvoteCount() {
      const votes = this.post.active_votes || [];
      const count = votes.filter(v => v.percent < 0).length;
      return count + (this.hasFlagged ? 1 : 0);
    },
    // Expose the shared reasons list so the template can iterate it.
    flagReasons() {
      return typeof LIVE_TWIST_FLAG_REASONS !== "undefined"
        ? LIVE_TWIST_FLAG_REASONS
        : [];
    },
    isLong() {
      return stripBackLink(this.post.body).length > PREVIEW_LENGTH ||
             (this.post.children || 0) > THREAD_REPLY_THRESHOLD;
    },
    bodyPreview() {
      return stripBackLink(this.post.body).slice(0, PREVIEW_LENGTH) + "…";
    },
    bodyHtml() {
      if (this.isSecretTwist) return "<em style='color:#5a4e70'>🔒 Secret Twist — view in Private Signals</em>";
      if (this.isLiveTwist)   return "";   // rendered by LiveTwistComponent
      return DOMPurify.sanitize(renderMarkdown(stripBackLink(this.editedBody !== null ? this.editedBody : this.post.body)));
    },
    bodyPreviewHtml() {
      if (this.isSecretTwist) return "<em style='color:#5a4e70'>🔒 Secret Twist — view in Private Signals</em>";
      if (this.isLiveTwist)   return "";
      return DOMPurify.sanitize(renderMarkdown(stripBackLink(this.editedBody !== null ? this.editedBody : this.post.body).slice(0, PREVIEW_LENGTH) + "…"));
    },
    replyPreviewHtml() {
      return this.replyText.trim()
        ? DOMPurify.sanitize(renderMarkdown(this.replyText))
        : "<em style='color:#5a4e70'>Nothing to preview.</em>";
    },
    replyCharCount() { return countTwistCharsExcludingMedia(this.replyText); },
    replyOverLimit() { return this.replyCharCount > 280; },
    replyMediaCount() { return countMediaEmbeds(this.replyText); },
    replyMediaLimitExceeded() { return this.replyMediaCount > REGULAR_TWIST_MEDIA_LIMIT; },
    mediaLimit() { return REGULAR_TWIST_MEDIA_LIMIT; },
    canSubmitReply() {
      return !!this.replyText.trim() && !this.isReplying && !this.replyOverLimit && !this.replyMediaLimitExceeded;
    },
    canSubmitLiveReply() {
      return !!this.liveReplyCode.trim() && !this.isReplying;
    },
    canUploadReplyImage() { return this.replyMediaCount < this.mediaLimit; },
    showThread() {
      return this.threadExpanded || this.showReplies;
    }
  },
  watch: {
    replyText(v) { draftStorage.save("reply_" + this.post.permlink, v); },
    replyMode(v) { draftStorage.save("reply_mode_" + this.post.permlink, v); },
    liveReplyTitle(v) { draftStorage.save("live_reply_title_" + this.post.permlink, v); },
    liveReplyBody(v)  { draftStorage.save("live_reply_body_" + this.post.permlink, v); },
    liveReplyCode(v)  { draftStorage.save("live_reply_code_" + this.post.permlink, v); },
    editText(v)  { if (this.showEditBox) draftStorage.save("edit_" + this.post.permlink, { editText: v }); },
    editCode(v)  { if (this.isLiveEditBox) draftStorage.save("live_edit_" + this.post.permlink, { editCode: v, editTitle: this.editTitle, editBody: this.editBody }); },
    editTitle(v) { if (this.isLiveEditBox) draftStorage.save("live_edit_" + this.post.permlink, { editCode: this.editCode, editTitle: v, editBody: this.editBody }); },
    editBody(v)  { if (this.isLiveEditBox) draftStorage.save("live_edit_" + this.post.permlink, { editCode: this.editCode, editTitle: this.editTitle, editBody: v }); }
  },
  methods: {
    ...LIVE_TWIST_HANDLER_MIXIN,
    vote() {
      if (!this.canAct || this.isVoting || this.hasVoted) return;
      this.isVoting = true;
      voteTwist(this.username, this.post.author, this.post.permlink, 10000, (res) => {
        this.isVoting = false;
        if (res.success) {
          this.hasVoted = true;
          this.$emit("voted", this.post);
        } else {
          this.lastError = res.error || res.message || "Twist love failed.";
        }
      });
    },
    retwist() {
      if (!this.canAct || this.isRetwisting || this.hasRetwisted) return;
      // Cannot retwist your own post
      if (this.post.author === this.username) {
        this.lastError = "You cannot retwist your own twist.";
        return;
      }
      this.isRetwisting = true;
      retwistPost(this.username, this.post.author, this.post.permlink, (res) => {
        this.isRetwisting = false;
        if (res.success) {
          this.hasRetwisted = true;
        } else {
          this.lastError = res.error || res.message || "Retwist failed.";
        }
      });
    },
    toggleReplies() {
      // Always toggle the reply list — even if replyCount is 0, the user
      // may want to see "No replies yet" or post the first reply.
      // This also fixes the case where children=0 but replies exist on-chain.
      this.showReplies = !this.showReplies;
      if (this.canAct) {
        this.showReplyBox = !this.showReplyBox;
      }
    },
    insertReplyAtCursor(text) {
      const ta = this.$refs.replyTextarea;
      if (!ta) {
        this.replyText = (this.replyText ? this.replyText + "\n" : "") + text;
        return;
      }
      const start = ta.selectionStart ?? this.replyText.length;
      const end   = ta.selectionEnd ?? this.replyText.length;
      this.replyText = this.replyText.slice(0, start) + text + this.replyText.slice(end);
      this.$nextTick(() => {
        ta.focus();
        const pos = start + text.length;
        ta.selectionStart = pos;
        ta.selectionEnd = pos;
      });
    },
    onReplyImageSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      event.target.value = "";
      this.uploadReplyImage(file);
    },
    uploadReplyImage(file) {
      if (this.isUploadingReplyImage || !this.canAct) return;
      if (!this.canUploadReplyImage) {
        this.lastError = `Reply can include up to ${this.mediaLimit} images/videos.`;
        return;
      }
      this.replyUploadError = "";
      this.isUploadingReplyImage = true;
      uploadImageToSteemit(this.username, file, (res) => {
        this.isUploadingReplyImage = false;
        if (!res.success) {
          this.replyUploadError = res.error || "Image upload failed.";
          this.lastError = this.replyUploadError;
          return;
        }
        const alt = makeImageAltText(file.name);
        this.insertReplyAtCursor(`![${alt}](${res.url})`);
      });
    },
    runLiveReplyPreview() {
      this.liveReplyTab = "preview";
      this.liveReplyIframeHeight = 80;
      this.liveReplyPreviewKey++;
    },
    useLiveReplyTemplate(tpl) {
      this.liveReplyCode = tpl.code;
      this.liveReplyTitle = tpl.name;
      this.liveReplyBody = tpl.desc || "";
      this.liveReplyTab = "code";
    },
    buildLiveReplySandboxDoc(code) {
      return buildLiveTwistSandboxDoc(code);
    },
    onLiveReplyPreviewMessage(e) {
      const iframe = this.$refs.liveReplyPreview;
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (e?.data?.type === "LIVE_REPLY_PREVIEW_RESIZE") {
        this.liveReplyIframeHeight = Math.max(e.data.height || 80, 80);
      }
      if (e?.data?.type === "LIVE_TWIST_QUERY") {
        this.handleQueryRequest(e.data.queryType, e.data.params, e.source, e.data._reqId);
      }
      if (e?.data?.type === "LIVE_TWIST_ACTION") {
        this.handleActionRequest(e.data.actionType, e.data.params, e.source);
      }
    },
    pinPost() {
      if (!this.isOwnPost || this.isPinning) return;
      this.isPinning = true;
      pinTwist(this.username, this.post.author, this.post.permlink, (res) => {
        this.isPinning = false;
        if (res.success) this.$emit("pin", this.post);
        else this.lastError = res.error || res.message || "Pin failed.";
      });
    },
    unpinPost() {
      if (!this.isOwnPost || this.isPinning) return;
      this.isPinning = true;
      unpinTwist(this.username, (res) => {
        this.isPinning = false;
        if (res.success) this.$emit("unpin", this.post);
        else this.lastError = res.error || res.message || "Unpin failed.";
      });
    },
    submitReply() {
      if (this.replyMode === "live") {
        const code = this.liveReplyCode.trim();
        if (!code || !this.canAct) return;
        this.isReplying = true;
        postLiveTwistReply(
          this.username,
          this.liveReplyTitle.trim() || "Live Twist",
          this.liveReplyBody.trim() || "⚡ Live Twist — view on SteemTwist",
          code,
          this.post.author,
          this.post.permlink,
          (res) => {
            this.isReplying = false;
            if (res.success) {
              this.liveReplyTitle  = "";
              this.liveReplyBody   = "";
              this.liveReplyCode   = "";
              this.showReplyBox    = false;
              this.threadExpanded  = true;
              this.showReplies     = true;
              this.replyCount++;
              draftStorage.clear("live_reply_title_" + this.post.permlink);
              draftStorage.clear("live_reply_body_" + this.post.permlink);
              draftStorage.clear("live_reply_code_" + this.post.permlink);
              this.$emit("replied", this.post);
            } else {
              this.lastError = res.error || res.message || "Live reply failed.";
            }
          }
        );
        return;
      }

      const text = this.replyText.trim();
      if (!text || !this.canAct) return;
      if (this.replyOverLimit) {
        this.lastError = "Reply text exceeds 280 characters (media excluded).";
        return;
      }
      if (this.replyMediaLimitExceeded) {
        this.lastError = `Reply can include up to ${REGULAR_TWIST_MEDIA_LIMIT} images/videos.`;
        return;
      }
      this.isReplying = true;
      postTwistReply(this.username, text, this.post.author, this.post.permlink, (res) => {
        this.isReplying = false;
        if (res.success) {
          this.replyText        = "";
          this.replyPreviewMode = false;
          this.showReplyBox     = false;
          this.threadExpanded   = true;
          this.showReplies      = true;
          this.replyCount++;
          draftStorage.clear("reply_" + this.post.permlink);
          this.$emit("replied", this.post);
        } else {
          this.lastError = res.error || res.message || "Reply failed.";
        }
      });
    },

    submitFlag() {
      if (!this.canAct || this.isFlagging || this.hasFlagged) return;
      if (!this.flagReason) {
        this.lastError = "Please select a reason before flagging.";
        return;
      }
      // Prevent self-flagging
      if (this.post.author === this.username) {
        this.lastError = "You cannot flag your own Live Twist.";
        return;
      }
      this.isFlagging = true;
      flagLiveTwist(
        this.username,
        this.post.author,
        this.post.permlink,
        this.flagReason,
        (res) => {
          this.isFlagging = false;
          if (res.success) {
            this.hasFlagged    = true;
            this.showFlagPanel = false;
            this.flagReason    = null;
            this.replyCount++;   // the flag reply counts as a child
          } else {
            this.lastError = res.error || res.message || "Flag failed.";
          }
        }
      );
    },

    openEdit() {
      if (this.isLiveTwist) {
        const raw = this.post.json_metadata;
        const meta = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
        const savedLive = draftStorage.load("live_edit_" + this.post.permlink, {});
        this.editCode      = savedLive.editCode  !== undefined ? savedLive.editCode  : (this.editedCode !== null ? this.editedCode : (meta.code || ""));
        this.editTitle     = savedLive.editTitle !== undefined ? savedLive.editTitle : (meta.title || "");
        this.editBody      = savedLive.editBody  !== undefined ? savedLive.editBody  : stripBackLink(this.editedBody !== null ? this.editedBody : this.post.body);
        this.isLiveEditBox = true;
      } else {
        const saved = draftStorage.load("edit_" + this.post.permlink, {});
        this.editText    = saved.editText !== undefined ? saved.editText : stripBackLink(this.editedBody !== null ? this.editedBody : this.post.body);
        this.showEditBox = true;
      }
    },
    saveEdit() {
      const text = this.editText.trim();
      if (!text || this.isEditing) return;
      this.isEditing = true;
      editTwist(this.username, this.post, text, (res) => {
        this.isEditing = false;
        if (res.success) {
          this.editedBody  = text;
          this.showEditBox = false;
          draftStorage.clear("edit_" + this.post.permlink);
        } else {
          this.lastError = res.error || res.message || "Edit failed.";
        }
      });
    },
    saveLiveEdit() {
      const c = this.editCode.trim();
      if (!c || this.isEditing) return;
      this.isEditing = true;
      // Re-broadcast with updated json_metadata containing the new code
      const raw = this.post.json_metadata;
      const meta = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
      const newMeta = Object.assign({}, meta, {
        title: this.editTitle.trim() || "Live Twist",
        code:  c
      });
      // Use editTwist which re-broadcasts the comment op — body stays the same
      const fakePost = Object.assign({}, this.post, {
        json_metadata: JSON.stringify(newMeta)
      });
      const bodyText = this.editBody.trim() || "⚡ Live Twist — view on SteemTwist";
      editTwist(this.username, fakePost, bodyText, (res) => {
        this.isEditing = false;
        if (res.success) {
          this.editedCode    = c;
          this.isLiveEditBox = false;
          this.post.json_metadata = JSON.stringify(newMeta);
          draftStorage.clear("live_edit_" + this.post.permlink);
        } else {
          this.lastError = res.error || res.message || "Edit failed.";
        }
      });
    },
    confirmDelete() {
      this.showDeleteConfirm = true;
    },
    doDelete() {
      if (this.isDeleting) return;
      this.isDeleting = true;
      deleteTwist(this.username, this.post, (res) => {
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        if (res.success) {
          this.$emit("deleted", this.post);
        } else {
          this.lastError = res.error || res.message || "Delete failed.";
        }
      });
    }
  },
  mounted() {
    window.addEventListener("message", this.onLiveReplyPreviewMessage);
  },
  unmounted() {
    window.removeEventListener("message", this.onLiveReplyPreviewMessage);
  },
  template: `
    <div style="
      background:#1e1535;border:1px solid #2e2050;border-radius:12px;
      padding:14px 16px;margin:10px auto;max-width:600px;text-align:left;
    ">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <a :href="'#/@' + post.author">
          <img
            :src="avatarUrl"
            style="width:40px;height:40px;border-radius:50%;border:2px solid #2e2050;"
            @error="$event.target.src='https://steemitimages.com/u/guest/avatar/small'"
          />
        </a>
        <div>
          <a
            :href="'#/@' + post.author"
            style="font-weight:bold;color:#a855f7;text-decoration:none;font-size:14px;"
          >@{{ post.author }}</a>
          <div style="font-size:12px;color:#5a4e70;">
            <a
              :href="twistUrl"
              :title="absoluteTime"
              style="color:#5a4e70;text-decoration:none;"
            >{{ relativeTime }}</a>
          </div>
        </div>
      </div>

      <!-- Body -->
      <live-twist-component
        v-if="isLiveTwist"
        :post="post"
        style="margin-bottom:12px;"
      ></live-twist-component>
      <div
        v-else
        class="twist-body"
        v-html="isLong && !threadExpanded ? bodyPreviewHtml : bodyHtml"
        style="margin-bottom:12px;"
      ></div>

      <!-- Expand / Collapse thread button (long posts only) -->
      <div v-if="isLong" style="margin-bottom:12px;">
        <button
          @click="threadExpanded = !threadExpanded"
          style="
            background:none;border:none;padding:0;
            color:#a855f7;font-size:13px;font-weight:600;
            cursor:pointer;text-decoration:underline;
          "
        >
          {{ threadExpanded ? "▲ Collapse thread" : "▼ Expand thread" }}
        </button>
      </div>

      <!-- Footer actions -->
      <div style="display:flex;align-items:center;gap:12px;font-size:13px;margin-top:12px;flex-wrap:wrap;">

        <!-- Love -->
        <button
          @click="vote"
          :disabled="!canAct || isVoting || hasVoted"
          :style="{
            background: hasVoted ? '#3b0764' : '#1e1535',
            color:      hasVoted ? '#e879f9' : '#9b8db0',
            border:     hasVoted ? '1px solid #a855f7' : '1px solid #2e2050',
            borderRadius:'20px', padding:'4px 12px',
            cursor: (!canAct || hasVoted) ? 'default' : 'pointer',
            fontSize:'13px', margin:0
          }"
        >{{ isVoting ? "…" : (hasVoted ? "❤️" : "🤍") }} {{ upvoteCount }}</button>

        <!-- Retwist -->
        <button
          @click="retwist"
          :disabled="!canAct || isRetwisting || hasRetwisted || post.author === username"
          :style="{
            background: hasRetwisted ? '#0c2d1a' : '#1e1535',
            color:      hasRetwisted ? '#4ade80' : '#9b8db0',
            border:     hasRetwisted ? '1px solid #166534' : '1px solid #2e2050',
            borderRadius:'20px', padding:'4px 12px',
            cursor: (!canAct || hasRetwisted || post.author === username) ? 'default' : 'pointer',
            fontSize:'13px', margin:0
          }"
          :title="post.author === username ? 'Cannot retwist your own twist' : ''"
        >{{ isRetwisting ? "…" : (hasRetwisted ? "🔁 Retwisted" : "🔁") }}</button>

        <!-- Replies -->
        <button
          @click="toggleReplies"
          style="background:#1e1535;color:#9b8db0;border:1px solid #2e2050;
                 border-radius:20px;padding:4px 12px;font-size:13px;margin:0;"
        >💬 {{ replyCount }}</button>

        <!-- Flag — Live Twists only, other users only -->
        <button
          v-if="isLiveTwist && !isOwnPost && canAct"
          @click="showFlagPanel = !showFlagPanel"
          :disabled="hasFlagged"
          :style="{
            background:   hasFlagged ? '#2d0a0a' : (showFlagPanel ? '#3b0000' : '#1e1535'),
            color:        hasFlagged ? '#fca5a5' : (showFlagPanel ? '#f87171' : '#9b8db0'),
            border:       hasFlagged ? '1px solid #7f1d1d' : (showFlagPanel ? '1px solid #f87171' : '1px solid #2e2050'),
            borderRadius: '20px', padding: '4px 10px',
            cursor:       hasFlagged ? 'default' : 'pointer',
            fontSize:     '12px', margin: 0
          }"
          :title="hasFlagged ? 'You have already flagged this Live Twist' : 'Flag this Live Twist as harmful'"
        >{{ hasFlagged ? '🚩 Flagged' : '🚩' }}{{ downvoteCount > 0 ? ' ' + downvoteCount : '' }}</button>

        <!-- Permalink -->
        <a
          :href="twistUrl"
          style="margin-left:auto;font-size:12px;color:#2e2050;text-decoration:none;"
          title="Open twist page"
        >🔗</a>

        <!-- Pin / Unpin — own posts only -->
        <button
          v-if="isOwnPost && hasKeychain"
          @click="pinned ? unpinPost() : pinPost()"
          :disabled="isPinning"
          :style="{
            background: pinned ? '#1a2a0a' : '#1e1535',
            color:      pinned ? '#86efac' : '#9b8db0',
            border:     pinned ? '1px solid #166534' : '1px solid #2e2050',
            borderRadius:'20px', padding:'4px 10px',
            fontSize:'12px', margin:0,
            cursor: isPinning ? 'default' : 'pointer'
          }"
          :title="pinned ? 'Unpin this twist' : 'Pin to top of your profile'"
        >{{ isPinning ? '…' : (pinned ? '📌 Pinned' : '📌') }}</button>

        <!-- Edit / Delete — own posts only -->
        <button
          v-if="isOwnPost && hasKeychain"
          @click="openEdit"
          style="background:#1e1535;color:#9b8db0;border:1px solid #2e2050;
                 border-radius:20px;padding:4px 10px;font-size:12px;margin:0;"
          title="Edit this twist"
        >✏️</button>

        <button
          v-if="isOwnPost && hasKeychain"
          @click="confirmDelete"
          style="background:#1e1535;color:#9b8db0;border:1px solid #2e2050;
                 border-radius:20px;padding:4px 10px;font-size:12px;margin:0;"
          title="Delete this twist"
        >🗑️</button>

      </div>

      <!-- Inline edit box — regular twist -->
      <div v-if="showEditBox" style="margin-top:12px;">
        <textarea
          v-model="editText"
          style="
            width:100%;box-sizing:border-box;padding:8px;border-radius:8px;
            border:1px solid #2e2050;background:#0f0a1e;
            color:#e8e0f0;font-size:14px;resize:vertical;min-height:80px;
          "
          @keydown.ctrl.enter="saveEdit"
        ></textarea>
        <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:4px;">
          <button @click="showEditBox = false"
            style="background:#1e1535;border:1px solid #2e2050;color:#9b8db0;
                   border-radius:20px;padding:4px 12px;font-size:12px;margin:0;"
          >Cancel</button>
          <button @click="saveEdit" :disabled="!editText.trim() || isEditing"
            style="padding:4px 14px;font-size:12px;margin:0;"
          >{{ isEditing ? "Saving…" : "Save" }}</button>
        </div>
      </div>

      <!-- Inline edit box — Live Twist -->
      <div v-if="isLiveEditBox" style="margin-top:12px;background:#0a0616;border:1px solid #2e2050;border-radius:8px;padding:10px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <span style="font-size:13px;">&#9889;</span>
          <span style="font-size:12px;font-weight:600;color:#fb923c;">Edit Live Twist</span>
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:11px;color:#9b8db0;display:block;margin-bottom:2px;">Card label</label>
          <input v-model="editTitle" type="text" placeholder="Live Twist" maxlength="80"
            style="width:100%;box-sizing:border-box;padding:5px 8px;border-radius:6px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:13px;" />
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:11px;color:#9b8db0;display:block;margin-bottom:2px;">Body <span style="color:#5a4e70;">(shown on Steemit)</span></label>
          <input v-model="editBody" type="text" placeholder="Live Twist — view on SteemTwist" maxlength="280"
            style="width:100%;box-sizing:border-box;padding:5px 8px;border-radius:6px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:13px;" />
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:11px;color:#9b8db0;display:block;margin-bottom:2px;">Code</label>
          <textarea v-model="editCode" spellcheck="false"
            style="width:100%;box-sizing:border-box;padding:7px;border-radius:6px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:12px;font-family:monospace;resize:vertical;min-height:120px;line-height:1.5;"
            @keydown.ctrl.enter="saveLiveEdit"
          ></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:6px;">
          <button @click="isLiveEditBox = false"
            style="background:#1e1535;border:1px solid #2e2050;color:#9b8db0;border-radius:20px;padding:4px 12px;font-size:12px;margin:0;"
          >Cancel</button>
          <button @click="saveLiveEdit" :disabled="!editCode.trim() || isEditing"
            style="padding:4px 14px;font-size:12px;margin:0;background:linear-gradient(135deg,#c2410c,#ea580c);"
          >{{ isEditing ? "Saving…" : "Save &#9889;" }}</button>
        </div>
      </div>

      <!-- Delete confirmation -->
      <div v-if="showDeleteConfirm" style="
        margin-top:10px;padding:10px 12px;border-radius:8px;font-size:13px;
        background:#2d0a0a;border:1px solid #7f1d1d;color:#fca5a5;
      ">
        <div style="margin-bottom:8px;">Delete this twist? This cannot be undone.</div>
        <div style="display:flex;gap:6px;">
          <button
            @click="doDelete"
            :disabled="isDeleting"
            style="background:#7f1d1d;border:none;color:#fff;border-radius:20px;
                   padding:4px 14px;font-size:12px;margin:0;"
          >{{ isDeleting ? "Deleting…" : "Delete" }}</button>
          <button
            @click="showDeleteConfirm = false"
            style="background:#1e1535;border:1px solid #2e2050;color:#9b8db0;
                   border-radius:20px;padding:4px 12px;font-size:12px;margin:0;"
          >Cancel</button>
        </div>
      </div>

      <!-- Live Twist flag panel — reason selector + confirm ──────────────── -->
      <div v-if="showFlagPanel && isLiveTwist && !isOwnPost && canAct && !hasFlagged"
           style="margin-top:10px;padding:12px 14px;border-radius:10px;
                  background:#1a0808;border:1px solid #7f1d1d;">

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:15px;">🚩</span>
          <span style="font-size:13px;font-weight:600;color:#fca5a5;">Flag Live Twist as harmful</span>
          <button
            @click="showFlagPanel = false; flagReason = null"
            style="margin-left:auto;background:none;border:none;cursor:pointer;
                   font-size:15px;color:#7f1d1d;padding:0;line-height:1;"
          >✕</button>
        </div>

        <div style="font-size:12px;color:#9b8db0;margin-bottom:8px;">
          Select the reason that best describes the problem with this Live Twist.
          Your flag will be cast as a downvote and the reason will be posted as a
          reply on-chain so the community can review it.
        </div>

        <!-- Reason chips -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <button
            v-for="r in flagReasons"
            :key="r.id"
            @click="flagReason = (flagReason === r.id ? null : r.id)"
            :title="r.desc"
            :style="{
              borderRadius: '20px', padding: '4px 12px', fontSize: '12px',
              fontWeight: flagReason === r.id ? '700' : '400',
              border: '1px solid',
              background:   flagReason === r.id ? '#7f1d1d' : '#1e1535',
              color:        flagReason === r.id ? '#fecaca' : '#9b8db0',
              borderColor:  flagReason === r.id ? '#ef4444'  : '#2e2050',
              cursor: 'pointer', margin: 0
            }"
          >{{ r.emoji }} {{ r.label }}</button>
        </div>

        <!-- Confirm row -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span v-if="!flagReason" style="font-size:12px;color:#5a4e70;font-style:italic;">
            Choose a reason above to enable the flag button.
          </span>
          <span v-else style="font-size:12px;color:#fca5a5;">
            Flag as: <strong>{{ flagReasons.find(r => r.id === flagReason)?.emoji }}
            {{ flagReasons.find(r => r.id === flagReason)?.label }}</strong>
          </span>
          <button
            @click="submitFlag"
            :disabled="!flagReason || isFlagging"
            style="margin-left:auto;padding:5px 16px;font-size:12px;margin:0;
                   background:#7f1d1d;border:none;color:#fff;border-radius:20px;
                   font-weight:600;cursor:pointer;opacity:1;"
            :style="{ opacity: (!flagReason || isFlagging) ? 0.4 : 1, cursor: (!flagReason || isFlagging) ? 'default' : 'pointer' }"
          >{{ isFlagging ? "Flagging…" : "🚩 Confirm flag" }}</button>
        </div>
      </div>

      <!-- Inline reply compose box -->
      <div v-if="showReplyBox && canAct" style="margin-top:12px;">
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button
            @click="replyMode = 'twist'"
            :style="{
              background: replyMode === 'twist' ? '#2e2050' : '#0f0a1e',
              color:      replyMode === 'twist' ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #2e2050', borderRadius:'999px',
              padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer'
            }"
          >🌀 Reply</button>
          <button
            @click="replyMode = 'live'"
            :style="{
              background: replyMode === 'live' ? '#3b1a07' : '#0f0a1e',
              color:      replyMode === 'live' ? '#fdba74' : '#9b8db0',
              border:'1px solid #2e2050', borderRadius:'999px',
              padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer'
            }"
          >⚡ Live Reply</button>
        </div>
        <template v-if="replyMode === 'twist'">
        <div style="display:flex;gap:4px;margin-bottom:4px;">
          <button
            @click="replyPreviewMode = false"
            :style="{
              background: !replyPreviewMode ? '#2e2050' : 'none',
              color:      !replyPreviewMode ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #2e2050', borderRadius:'6px 6px 0 0',
              padding:'3px 10px', fontSize:'12px', margin:0, cursor:'pointer'
            }"
          >Write</button>
          <button
            @click="replyPreviewMode = true"
            :style="{
              background: replyPreviewMode ? '#2e2050' : 'none',
              color:      replyPreviewMode ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #2e2050', borderRadius:'6px 6px 0 0',
              padding:'3px 10px', fontSize:'12px', margin:0, cursor:'pointer'
            }"
          >Preview</button>
        </div>
        <textarea
          v-show="!replyPreviewMode"
          ref="replyTextarea"
          v-model="replyText"
          placeholder="Write a reply… (markdown supported)"
          maxlength="1000"
          style="
            width:100%;box-sizing:border-box;
            padding:8px;border-radius:0 8px 8px 8px;
            border:1px solid #2e2050;background:#0f0a1e;
            color:#e8e0f0;font-size:14px;resize:vertical;min-height:60px;
          "
        ></textarea>
        <div v-show="!replyPreviewMode" style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <input ref="replyImageInput" type="file" accept="image/*" style="display:none;" @change="onReplyImageSelected" />
          <button
            @click="$refs.replyImageInput.click()"
            :disabled="isUploadingReplyImage || !canUploadReplyImage"
            style="padding:5px 12px;margin:0;background:#1a1030;border:1px solid #3b1f5e;color:#c084fc;font-size:12px;"
          >{{ isUploadingReplyImage ? "Uploading…" : "📷 Upload image" }}</button>
          <span v-if="replyUploadError" style="font-size:12px;color:#fca5a5;">{{ replyUploadError }}</span>
        </div>
        <div
          v-show="replyPreviewMode"
          class="twist-body"
          v-html="replyPreviewHtml"
          style="
            min-height:60px;padding:8px;border-radius:0 8px 8px 8px;
            border:1px solid #2e2050;background:#0f0a1e;
            font-size:14px;color:#e8e0f0;line-height:1.6;word-break:break-word;
          "
        ></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span :style="{ fontSize:'12px', color: (replyOverLimit || replyMediaLimitExceeded) ? '#fca5a5' : '#5a4e70' }">
            {{ replyCharCount }} / 280 (media excluded) · media {{ replyMediaCount }}/{{ mediaLimit }}
          </span>
          <button
            @click="submitReply"
            :disabled="!canSubmitReply"
            style="font-size:13px;padding:5px 14px;"
          >{{ isReplying ? "Posting…" : "Reply" }}</button>
        </div>
        </template>
        <template v-else>
          <input
            v-model="liveReplyTitle"
            type="text"
            maxlength="80"
            placeholder="Live Twist"
            style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:13px;margin-bottom:6px;"
          />
          <input
            v-model="liveReplyBody"
            type="text"
            maxlength="280"
            placeholder="⚡ Live Twist — view on SteemTwist"
            style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:13px;margin-bottom:6px;"
          />
          <div style="display:flex;gap:4px;margin-bottom:0;">
            <button @click="liveReplyTab = 'code'"
              :style="{ background: liveReplyTab==='code' ? '#2e2050' : 'none', color: liveReplyTab==='code' ? '#e8e0f0' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer' }">Code</button>
            <button @click="runLiveReplyPreview"
              :style="{ background: liveReplyTab==='preview' ? '#2e2050' : 'none', color: liveReplyTab==='preview' ? '#fb923c' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer' }">▶ Preview</button>
            <button @click="liveReplyTab = 'templates'"
              :style="{ background: liveReplyTab==='templates' ? '#2e2050' : 'none', color: liveReplyTab==='templates' ? '#22d3ee' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer' }">📄 Templates</button>
          </div>
          <textarea
            v-show="liveReplyTab === 'code'"
            v-model="liveReplyCode"
            spellcheck="false"
            placeholder="app.render('Hello from a Live Reply!')"
            style="width:100%;box-sizing:border-box;padding:8px;border-radius:0 8px 8px 8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:12px;font-family:monospace;resize:vertical;min-height:110px;line-height:1.5;"
          ></textarea>
          <div v-if="liveReplyTab === 'preview'" style="border-radius:0 8px 8px 8px;border:1px solid #2e2050;overflow:hidden;">
            <iframe :key="liveReplyPreviewKey" ref="liveReplyPreview" sandbox="allow-scripts"
              :srcdoc="buildLiveReplySandboxDoc(liveReplyCode)"
              :style="{ width:'100%', border:'none', display:'block', height: liveReplyIframeHeight + 'px', background:'#0f0a1e' }"
              scrolling="no"></iframe>
          </div>
          <div v-if="liveReplyTab === 'templates'" style="border:1px solid #2e2050;border-radius:0 8px 8px 8px;background:#0a0616;padding:10px;">
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
              <button v-for="st in [{k:'simple',label:'🔧 Simple'},{k:'greetings',label:'🎉 Greetings'},{k:'queries',label:'🔍 Queries'},{k:'actions',label:'⚡ Actions'}]"
                :key="st.k" @click="liveReplyTemplateSubTab = st.k"
                :style="{ borderRadius:'20px', padding:'3px 10px', fontSize:'11px', border:'1px solid', background: liveReplyTemplateSubTab===st.k ? '#2e2050' : 'none', color: liveReplyTemplateSubTab===st.k ? '#e8e0f0' : '#9b8db0', borderColor: liveReplyTemplateSubTab===st.k ? '#a855f7' : '#2e2050', margin:0, cursor:'pointer' }"
              >{{ st.label }}</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div v-for="tpl in (liveReplyTemplateSubTab==='simple' ? $options.liveTemplates : liveReplyTemplateSubTab==='greetings' ? $options.liveGreetings : liveReplyTemplateSubTab==='queries' ? $options.liveQueries : $options.liveActions)"
                :key="tpl.id" @click="useLiveReplyTemplate(tpl)"
                style="background:#1a1030;border:1px solid #2e2050;border-radius:8px;padding:8px;cursor:pointer;">
                <div style="font-size:16px;">{{ tpl.icon }}</div>
                <div style="font-size:12px;color:#e8e0f0;font-weight:600;">{{ tpl.name }}</div>
              </div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
            <span style="font-size:12px;color:#5a4e70;">Code {{ liveReplyCode.length }} / 10000</span>
            <button
              @click="submitReply"
              :disabled="!canSubmitLiveReply"
              style="font-size:13px;padding:5px 14px;"
            >{{ isReplying ? "Posting…" : "Publish ⚡" }}</button>
          </div>
        </template>
      </div>

      <!-- Blockchain error -->
      <div v-if="lastError" style="
        margin-top:10px;padding:8px 10px;border-radius:8px;font-size:13px;
        background:#2d0a0a;border:1px solid #7f1d1d;color:#fca5a5;
        display:flex;justify-content:space-between;align-items:center;gap:8px;
      ">
        <span>⚠️ {{ lastError }}</span>
        <button
          @click="lastError = ''"
          style="background:none;border:none;cursor:pointer;font-size:15px;
                 padding:0;color:#fca5a5;line-height:1;margin:0;"
        >✕</button>
      </div>

      <!-- Thread replies — below actions so the action bar never moves -->
      <thread-component
        v-if="showThread"
        :author="post.author"
        :permlink="post.permlink"
        :refresh-key="replyCount"
      ></thread-component>

    </div>
  `
};

// ---- LiveTwistComposerComponent ----
// Specialised editor for composing Live Twists.
// Three-pane layout: Title + Code editor + live sandbox preview.
// The preview uses the same sandboxDoc builder as LiveTwistComponent
// so what you see in the editor is exactly what viewers will see.
const LiveTwistComposerComponent = {
  name: "LiveTwistComposerComponent",
  templates:  LIVE_TWIST_TEMPLATES,   // Simple tab — accessed via $options.templates
  greetings:  LIVE_TWIST_GREETINGS,  // Greetings tab
  queries:    LIVE_TWIST_QUERIES,    // Queries tab
  actions:    LIVE_TWIST_ACTIONS,    // Actions tab
  props: {
    username:    { type: String,  default: "" },
    hasKeychain: { type: Boolean, default: false },
    isPosting:   { type: Boolean, default: false }
  },
  // Inject the same blockchain helpers that LiveTwistComponent uses so that
  // handleQueryRequest / handleActionRequest work identically in the preview.
  inject: ["notify", "voteTwist", "postTwistReply", "retwistPost", "followUser", "unfollowUser"],
  emits: ["post", "cancel"],
  data() {
    const draft = draftStorage.load("live_composer", {});
    return {
      title:        draft.title || "",
      body:         draft.body  || "",
      code:         draft.code  || "",
      activeTab:      "code",  // "code" | "preview" | "templates"
      templateSubTab: "simple", // "simple" | "greetings" | "queries" | "actions"
      previewKey:  0,
      iframeHeight: 200
    };
  },
  computed: {
    codeBytes() { return new TextEncoder().encode(this.code).length; },
    tooBig()    { return this.codeBytes > 10240; },
    sizeLabel() { return (this.codeBytes / 1024).toFixed(1) + " / 10 KB"; },
    // Title + body combined character count and limit.
    // Mirrors the 280-char cap of regular twists across both fields together.
    headerCharCount() { return this.title.length + this.body.length; },
    headerOverLimit() { return this.headerCharCount > 280; },
    headerLabel() {
      const rem = 280 - this.headerCharCount;
      return rem >= 0
        ? `${rem} chars left (label + body)`
        : `${Math.abs(rem)} chars over limit`;
    },
    canPost() {
      return !!this.username && this.hasKeychain &&
             this.code.trim().length > 0 && !this.tooBig &&
             !this.headerOverLimit && !this.isPosting;
    }
  },
  watch: {
    title(v) { draftStorage.save("live_composer", { title: v, body: this.body, code: this.code }); },
    body(v)  { draftStorage.save("live_composer", { title: this.title, body: v, code: this.code }); },
    code(v)  { draftStorage.save("live_composer", { title: this.title, body: this.body, code: v }); }
  },
  methods: {
    ...LIVE_TWIST_HANDLER_MIXIN,
    buildSandboxDoc(userCode) {
      const escaped = JSON.stringify(userCode);
      // Embed the shared DOMPurify config so the composer preview uses
      // identical sanitisation rules to what viewers see.
      const escapedPurifyConfig = LIVE_TWIST_PURIFY_CONFIG;
      return "<!DOCTYPE html><html><head><meta charset='utf-8'>" + 
		"<script src='https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js' integrity='sha256-wIRQlqfEpnQfNirFBslMHH0n3GA7zBv2Slh/dvLb46E=' crossorigin='anonymous'></script><style>" +
        "body{margin:0;padding:8px;font-family:system-ui,sans-serif;font-size:14px;" +
        "background:#0f0a1e;color:#e8e0f0;box-sizing:border-box;word-break:break-word}" +
        "*{box-sizing:border-box}" +
        "button{cursor:pointer;padding:5px 12px;border-radius:6px;background:#6d28d9;" +
        "color:#fff;border:none;font-size:13px}" +
        "input,textarea{background:#1a1030;color:#e8e0f0;border:1px solid #3b1f5e;" +
        "border-radius:6px;padding:5px 8px;font-size:13px;width:100%}" +
        "#_log{margin-top:8px;padding:6px;background:#0a0616;border-radius:6px;" +
        "font-family:monospace;font-size:12px;color:#9b8db0;max-height:80px;" +
        "overflow-y:auto;border:1px solid #2e1060;display:none}" +
        "</style></head><body>" +
        "<div id='_root'></div><div id='_log'></div>" +
        "<script>const PARENT_ORIGIN = 'https://puncakbukit.github.io';(function(){" +
        "window.fetch=()=>Promise.reject(new Error('Network blocked'));" +
        "window.XMLHttpRequest=function(){throw new Error('Network blocked');};" +
        "window.WebSocket=function(){throw new Error('Network blocked');};" +
        "window.open=()=>null;" +
        "var purify=DOMPurify;" +
        "var _purifyConfig=" + escapedPurifyConfig + ";" +
        "function sanitize(h){if(typeof h!=='string')return '';if(purify)return purify.sanitize(h,_purifyConfig);return h.replace(/<script[\\s\\S]*?<\\/script>/gi,'');}" +
        "var _log=document.getElementById('_log');" +
        "var _root=document.getElementById('_root');" +
        "var app={" +
        "render:function(h){_root.innerHTML=sanitize(String(h));setTimeout(function(){var rh=document.body.scrollHeight;if(rh>40)parent.postMessage({type:'resize',height:rh+16},PARENT_ORIGIN);},0);}," +
        "text:function(s){_root.textContent=String(s).slice(0,2000);}," +
        "resize:function(h){var px=Math.min(Math.max(parseInt(h)||200,40),600);parent.postMessage({type:'resize',height:px},PARENT_ORIGIN);}," +
        "log:function(){var a=Array.prototype.slice.call(arguments);_log.style.display='block';var l=document.createElement('div');l.textContent=a.map(function(x){return typeof x==='object'?JSON.stringify(x):String(x);}).join(' ');_log.appendChild(l);_log.scrollTop=_log.scrollHeight;}," +
		"query:function(type,params){params=params||{};parent.postMessage({type:'LIVE_TWIST_QUERY',queryType:type,params:params},PARENT_ORIGIN);}," +
        "action:function(type,params){params=params||{};parent.postMessage({type:'LIVE_TWIST_ACTION',actionType:type,params:params},PARENT_ORIGIN);}," +
	    "onResult:function(callback){if(app._onResultHandler)window.removeEventListener('message',app._onResultHandler);app._onResultHandler=function(e){if(e.data.type==='QUERY_RESULT'){callback(e.data.success,e.data.result);}else if(e.data.type==='ACTION_RESULT'){callback(e.data.success,e.data.action);}};window.addEventListener('message',app._onResultHandler);}," +
        "ask:function(type,params){params=params||{};var reqId=Math.random().toString(36).slice(2);return new Promise(function(resolve,reject){var h=function(e){var d=e.data;if(d.type==='QUERY_RESULT'&&d._reqId===reqId){window.removeEventListener('message',h);if(d.success)resolve(d.result);else reject(new Error('Query failed: '+type));}};window.addEventListener('message',h);parent.postMessage({type:'LIVE_TWIST_QUERY',queryType:type,params:params,_reqId:reqId},PARENT_ORIGIN);});}," +
        "};" +
        "var userCode=" + escaped + ";" +
        "try{var fn=new Function('app',userCode);var r=fn(app);if(r&&typeof r.catch==='function')r.catch(function(e){_root.innerHTML='<em style=\"color:#fca5a5\">Error: '+String(e)+'</em>';});parent.postMessage({type:'running'},PARENT_ORIGIN);}catch(e){_root.innerHTML='<em style=\"color:#fca5a5\">Error: '+String(e)+'</em>';}" +
        "setTimeout(function(){var h=document.body.scrollHeight;if(h>40)parent.postMessage({type:'resize',height:h+16},PARENT_ORIGIN);},150);" +
        "})();<\/script></body></html>";
    },
    runPreview() {
      this.activeTab = "preview";
      this.iframeHeight = 60;   // reset so each run grows from scratch
      this.previewKey++;
    },
    onMessage(e) {
	  if (e.origin !== "null") return;
      const iframeSource = e.source;
      const { type, height, queryType, actionType, params, _reqId } = e.data || {};
      const iframe = this.$refs.previewSandbox;
      if (!iframe || iframeSource !== iframe.contentWindow) return;

	  if (type === "resize") {
        this.iframeHeight = Math.max(height || 200, this.iframeHeight);
      }
      // Forward blockchain queries from the preview iframe to the shared handlers.
      // Without this, app.query() calls in template previews hang forever because
      // the composer's iframe sends the postMessage but nothing was listening.
      if (type === "LIVE_TWIST_QUERY") {
        this.handleQueryRequest(queryType, params, e.source, _reqId);
      }
      if (type === "LIVE_TWIST_ACTION") {
        this.handleActionRequest(actionType, params, e.source);
      }
    },
    submit() {
      if (!this.canPost) return;
      this.$emit("post", {
        title: this.title.trim() || "Live Twist",
        body:  this.body.trim()  || "Live Twist — view on SteemTwist",
        code:  this.code.trim()
      });
      // Draft cleared by parent (HomeView/ExploreView) on confirmed success
    },
    clearDraft() {
      draftStorage.clear("live_composer");
      this.title = ""; this.body = ""; this.code = "";
      this.activeTab = "code"; this.previewKey++;
    },
    useTemplate(tpl) {
      // Always overwrite all three fields so switching templates is a clean swap.
      this.code      = tpl.code;
      this.title     = tpl.name;
      this.body      = tpl.desc || "";
      this.activeTab = "code";
    }
  },
  mounted()   { window.addEventListener("message", this.onMessage); },
  unmounted() { window.removeEventListener("message", this.onMessage); },
  template: `
    <div style="background:#1e1535;border:1px solid #2e2050;border-radius:0 8px 8px 8px;padding:16px;text-align:left;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:16px;">&#9889;</span>
          <span style="color:#fb923c;font-weight:700;font-size:14px;">Live Twist Editor</span>
        </div>
        <button @click="$emit('cancel')"
          style="background:none;border:none;color:#5a4e70;font-size:18px;padding:0;margin:0;cursor:pointer;line-height:1;">&#10005;</button>
      </div>

      <!-- Card label (stored in json_metadata.title, shown in the ⚡ card header) -->
      <div style="margin-bottom:8px;">
        <label style="font-size:12px;color:#9b8db0;display:block;margin-bottom:3px;">
          Card label <span style="color:#5a4e70;">(optional — shown next to &#9889; in the card)</span>
        </label>
        <input v-model="title" type="text" placeholder="Live Twist"
          style="width:100%;box-sizing:border-box;padding:6px 10px;border-radius:8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:14px;" />
      </div>

      <!-- Body — shown on Steemit and other non-SteemTwist clients (max 280 chars) -->
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#9b8db0;display:block;margin-bottom:3px;">
          Body <span style="color:#5a4e70;">(shown on Steemit — max 280 chars, like a regular twist)</span>
        </label>
        <input v-model="body" type="text" placeholder="&#9889; Live Twist — view on SteemTwist"
          style="width:100%;box-sizing:border-box;padding:6px 10px;border-radius:8px;border:1px solid #2e2050;background:#0f0a1e;color:#e8e0f0;font-size:14px;" />
      </div>

      <!-- Code / Preview / Templates tabs -->
      <div style="display:flex;gap:4px;margin-bottom:0;">
        <button @click="activeTab = 'code'"
          :style="{ background: activeTab==='code' ? '#2e2050' : 'none', color: activeTab==='code' ? '#e8e0f0' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'4px 14px', fontSize:'12px', margin:0, cursor:'pointer' }">Code</button>
        <button @click="runPreview"
          :style="{ background: activeTab==='preview' ? '#2e2050' : 'none', color: activeTab==='preview' ? '#fb923c' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'4px 14px', fontSize:'12px', margin:0, cursor:'pointer' }">&#9654; Preview</button>
        <button @click="activeTab = 'templates'"
          :style="{ background: activeTab==='templates' ? '#2e2050' : 'none', color: activeTab==='templates' ? '#22d3ee' : '#9b8db0', border:'1px solid #2e2050', borderRadius:'6px 6px 0 0', padding:'4px 14px', fontSize:'12px', margin:0, cursor:'pointer' }">&#128196; Templates</button>
      </div>

      <!-- Code editor -->
      <textarea v-show="activeTab === 'code'" v-model="code"
        placeholder="// app.render(html) — render HTML&#10;// app.text(str)  — render plain text&#10;// app.resize(px) — resize iframe&#10;// app.log(...)   — console output&#10;&#10;// Example: click counter&#10;// let n=0;&#10;// function draw(){&#10;//   app.render('&lt;button id=b&gt;Clicks: '+n+'&lt;/button&gt;');&#10;//   document.getElementById('b').onclick=()=>{n++;draw();}&#10;// }&#10;// draw();"
        spellcheck="false"
        style="width:100%;box-sizing:border-box;padding:10px;border-radius:0 8px 8px 8px;border:1px solid #2e2050;background:#0a0616;color:#e8e0f0;font-size:13px;font-family:monospace;resize:vertical;min-height:160px;line-height:1.5;"></textarea>

      <!-- Preview iframe -->
      <div v-if="activeTab === 'preview'" style="border-radius:0 8px 8px 8px;border:1px solid #2e2050;overflow:hidden;">
        <iframe :key="previewKey" ref="previewSandbox" sandbox="allow-scripts" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'" 
          :srcdoc="buildSandboxDoc(code)"
          :style="{ width:'100%', border:'none', display:'block', height: iframeHeight + 'px', background:'#0f0a1e' }"
          scrolling="no"></iframe>
      </div>

      <!-- Templates panel with subtabs -->
      <div v-if="activeTab === 'templates'"
        style="border:1px solid #2e2050;border-radius:0 8px 8px 8px;background:#0a0616;padding:10px;">

        <!-- Subtab bar -->
        <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;">
          <button
            v-for="st in [{k:'simple',label:'🔧 Simple'},{k:'greetings',label:'🎉 Greetings'},{k:'queries',label:'🔍 Queries'},{k:'actions',label:'⚡ Actions'}]"
            :key="st.k"
            @click="templateSubTab = st.k"
            :style="{
              borderRadius:'20px', padding:'3px 12px', fontSize:'11px',
              fontWeight: templateSubTab === st.k ? '700' : '400',
              border:'1px solid',
              background:  templateSubTab === st.k ? '#2e2050' : 'none',
              color:       templateSubTab === st.k ? '#e8e0f0' : '#9b8db0',
              borderColor: templateSubTab === st.k ? '#a855f7'  : '#2e2050',
              cursor:'pointer', margin:0
            }"
          >{{ st.label }}</button>
        </div>

        <!-- Subtab hint -->
        <div style="font-size:11px;color:#5a4e70;margin-bottom:8px;line-height:1.5;">
          <template v-if="templateSubTab==='simple'">Interactive UI widgets — polls, quizzes, charts, games.</template>
          <template v-else-if="templateSubTab==='greetings'">Animated greeting and celebration cards.</template>
          <template v-else-if="templateSubTab==='queries'">Read-only Steem blockchain data — no wallet required.</template>
          <template v-else>Blockchain actions via Keychain — each requires user confirmation.</template>
        </div>

        <!-- Template cards grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div
            v-for="tpl in (templateSubTab==='simple' ? $options.templates : templateSubTab==='greetings' ? $options.greetings : templateSubTab==='queries' ? $options.queries : $options.actions)"
            :key="tpl.id"
            @click="useTemplate(tpl)"
            style="background:#1a1030;border:1px solid #2e2050;border-radius:8px;padding:10px;cursor:pointer;transition:border-color 0.15s;"
            @mouseenter="$event.currentTarget.style.borderColor='#a855f7'"
            @mouseleave="$event.currentTarget.style.borderColor='#2e2050'"
          >
            <div style="font-size:18px;margin-bottom:4px;">{{ tpl.icon }}</div>
            <div style="font-size:13px;font-weight:600;color:#e8e0f0;margin-bottom:2px;">{{ tpl.name }}</div>
            <div style="font-size:11px;color:#9b8db0;line-height:1.4;">{{ tpl.desc }}</div>
            <div style="margin-top:6px;font-size:11px;color:#22d3ee;">Use template &#8594;</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:6px;">
        <span style="display:flex;gap:10px;flex-wrap:wrap;">
          <span :style="{ fontSize:'12px', color: tooBig ? '#fca5a5' : '#5a4e70' }">{{ sizeLabel }}{{ tooBig ? ' — exceeds 10 KB limit' : '' }}</span>
          <span :style="{ fontSize:'12px', color: headerOverLimit ? '#fca5a5' : '#5a4e70' }">{{ headerLabel }}</span>
        </span>
        <div style="display:flex;gap:6px;">
          <button v-if="activeTab !== 'preview' && activeTab !== 'templates'" @click="runPreview" :disabled="!code.trim()"
            style="background:#1e1535;border:1px solid #f97316;color:#fb923c;border-radius:20px;padding:5px 14px;font-size:12px;margin:0;">&#9654; Preview</button>
          <button @click="submit" :disabled="!canPost"
            style="padding:6px 20px;margin:0;font-size:13px;">{{ isPosting ? "Publishing..." : "Publish &#9889;" }}</button>
        </div>
      </div>

      <!-- Security notice -->
      <div style="margin-top:10px;padding:8px 10px;border-radius:8px;font-size:11px;color:#5a4e70;background:#0a0616;border:1px solid #1a0a30;line-height:1.5;">
        &#128274; Runs in isolated sandbox — no network, no wallet, no page access. Code stored publicly on Steem.
      </div>
    </div>
  `
};


function countTwistCharsExcludingMedia(message) {
  if (!message) return 0;
  let text = String(message);

  // Markdown image syntax: ![alt](url)
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, "");
  // HTML media tags: <img ...>, <video ...>, <source ...>
  text = text.replace(/<(img|video|source)\b[^>]*>/gi, "");
  // Bare media URLs on their own line: image/GIF/video file extensions.
  text = text.replace(
    /^\s*https?:\/\/\S+\.(?:gif|png|jpe?g|webp|bmp|svg|mp4|webm|mov|m4v)(?:\?\S*)?\s*$/gim,
    ""
  );

  return text.length;
}

function countMediaEmbeds(message) {
  if (!message) return 0;
  const text = String(message);
  const patterns = [
    /!\[[^\]]*]\([^)]+\)/g, // Markdown image
    /<(img|video|source)\b[^>]*>/gi, // HTML media tags
    /^\s*https?:\/\/\S+\.(?:gif|png|jpe?g|webp|bmp|svg|mp4|webm|mov|m4v)(?:\?\S*)?\s*$/gim // bare media URL
  ];
  return patterns.reduce((sum, pattern) => sum + ((text.match(pattern) || []).length), 0);
}

function makeImageAltText(fileName) {
  const base = String(fileName || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return (base || "image").slice(0, IMAGE_ALT_TEXT_MAX_LENGTH);
}

function buildLiveTwistSandboxDoc(userCode) {
  const escaped = JSON.stringify(userCode || "");
  const escapedPurifyConfig = LIVE_TWIST_PURIFY_CONFIG;
  return "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
    "<script src='https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js' integrity='sha256-wIRQlqfEpnQfNirFBslMHH0n3GA7zBv2Slh/dvLb46E=' crossorigin='anonymous'></script><style>" +
    "body{margin:0;padding:8px;font-family:system-ui,sans-serif;font-size:14px;background:#0f0a1e;color:#e8e0f0;box-sizing:border-box;word-break:break-word}" +
    "*{box-sizing:border-box}" +
    "button{cursor:pointer;padding:5px 12px;border-radius:6px;background:#6d28d9;color:#fff;border:none;font-size:13px}" +
    "input,textarea{background:#1a1030;color:#e8e0f0;border:1px solid #3b1f5e;border-radius:6px;padding:5px 8px;font-size:13px;width:100%}" +
    "#_root{min-height:32px}" +
    "</style></head><body><div id='_root'></div>" +
    "<script>(function(){window.fetch=()=>Promise.reject(new Error('Network blocked'));window.XMLHttpRequest=function(){throw new Error('Network blocked');};window.WebSocket=function(){throw new Error('Network blocked');};window.open=()=>null;var purify=DOMPurify;var _purifyConfig=" + escapedPurifyConfig + ";function sanitize(h){if(typeof h!=='string')return '';if(purify)return purify.sanitize(h,_purifyConfig);return h.replace(/<script[\\s\\S]*?<\\/script>/gi,'');}var _root=document.getElementById('_root');var app={render:function(h){_root.innerHTML=sanitize(String(h));setTimeout(function(){parent.postMessage({type:'LIVE_REPLY_PREVIEW_RESIZE',height:document.body.scrollHeight+16},'*');},0);},text:function(s){_root.textContent=String(s).slice(0,2000);setTimeout(function(){parent.postMessage({type:'LIVE_REPLY_PREVIEW_RESIZE',height:document.body.scrollHeight+16},'*');},0);},resize:function(h){var px=Math.min(Math.max(parseInt(h)||200,40),600);parent.postMessage({type:'LIVE_REPLY_PREVIEW_RESIZE',height:px},'*');},log:function(){},query:function(type,params){params=params||{};parent.postMessage({type:'LIVE_TWIST_QUERY',queryType:type,params:params},'*');},action:function(type,params){params=params||{};parent.postMessage({type:'LIVE_TWIST_ACTION',actionType:type,params:params},'*');},onResult:function(callback){if(app._onResultHandler)window.removeEventListener('message',app._onResultHandler);app._onResultHandler=function(e){if(e.data.type==='QUERY_RESULT'){callback(e.data.success,e.data.result);}else if(e.data.type==='ACTION_RESULT'){callback(e.data.success,e.data.action);}};window.addEventListener('message',app._onResultHandler);},ask:function(type,params){params=params||{};var reqId=Math.random().toString(36).slice(2);return new Promise(function(resolve,reject){var h=function(e){var d=e.data;if(d.type==='QUERY_RESULT'&&d._reqId===reqId){window.removeEventListener('message',h);if(d.success)resolve(d.result);else reject(new Error('Query failed: '+type));}};window.addEventListener('message',h);parent.postMessage({type:'LIVE_TWIST_QUERY',queryType:type,params:params,_reqId:reqId},'*');});}};var userCode=" + escaped + ";try{var fn=new Function('app',userCode);var r=fn(app);if(r&&typeof r.catch==='function')r.catch(function(e){_root.innerHTML='<em style=\"color:#fca5a5\">Error: '+String(e)+'</em>';});}catch(e){_root.innerHTML='<em style=\"color:#fca5a5\">Error: '+String(e)+'</em>';}setTimeout(function(){parent.postMessage({type:'LIVE_REPLY_PREVIEW_RESIZE',height:document.body.scrollHeight+16},'*');},150);})();<\/script></body></html>";
}

const TwistComposerComponent = {
  name: "TwistComposerComponent",
  components: { LiveTwistComposerComponent },
  inject: ["notify"],
  props: {
    username:    { type: String,  default: "" },
    hasKeychain: { type: Boolean, default: false },
    isPosting:   { type: Boolean, default: false }
  },
  emits: ["post", "post-live"],
  data() {
    const draft = draftStorage.load("twist_composer", {});
    return {
      composerMode: draft.composerMode || "twist",
      message:      draft.message      || "",
      previewMode:  false,
      isUploadingImage: false,
      uploadError: ""
    };
  },
  computed: {
    charCount()   { return countTwistCharsExcludingMedia(this.message); },
    overLimit()   { return this.charCount > 280; },
    mediaCount()  { return countMediaEmbeds(this.message); },
    mediaLimitExceeded() { return this.mediaCount > REGULAR_TWIST_MEDIA_LIMIT; },
    mediaLimit()  { return REGULAR_TWIST_MEDIA_LIMIT; },
    canUploadImage() { return this.mediaCount < this.mediaLimit; },
    canPost()     {
      return !!this.username && this.hasKeychain &&
             this.charCount > 0 &&
             !this.overLimit &&
             !this.mediaLimitExceeded &&
             !this.isPosting;
    },
    previewHtml() {
      return this.message.trim()
        ? DOMPurify.sanitize(renderMarkdown(this.message))
        : "<em style='color:#5a4e70'>Nothing to preview.</em>";
    }
  },
  watch: {
    message(v)      { draftStorage.save("twist_composer", { composerMode: this.composerMode, message: v }); },
    composerMode(v) { draftStorage.save("twist_composer", { composerMode: v, message: this.message }); }
  },
  methods: {
    insertAtCursor(text) {
      const ta = this.$refs.twistTextarea;
      if (!ta) {
        this.message = (this.message ? this.message + "\n" : "") + text;
        return;
      }
      const start = ta.selectionStart ?? this.message.length;
      const end   = ta.selectionEnd ?? this.message.length;
      this.message = this.message.slice(0, start) + text + this.message.slice(end);
      this.$nextTick(() => {
        ta.focus();
        const pos = start + text.length;
        ta.selectionStart = pos;
        ta.selectionEnd   = pos;
      });
    },
    onImageSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      event.target.value = "";
      this.uploadImage(file);
    },
    uploadImage(file) {
      if (this.isUploadingImage) return;
      if (!this.canUploadImage) {
        this.notify(`A twist can include up to ${this.mediaLimit} images/videos.`, "error");
        return;
      }
      this.uploadError = "";
      this.isUploadingImage = true;
      uploadImageToSteemit(this.username, file, (res) => {
        this.isUploadingImage = false;
        if (!res.success) {
          this.uploadError = res.error || "Image upload failed.";
          this.notify(this.uploadError, "error");
          return;
        }
        const alt = makeImageAltText(file.name);
        this.insertAtCursor(`![${alt}](${res.url})`);
        this.notify("Image uploaded and inserted.", "success");
      });
    },
    submit() {
      if (this.overLimit) {
        this.notify("Twist text exceeds 280 characters (media excluded).", "error");
        return;
      }
      if (this.mediaLimitExceeded) {
        this.notify(`A twist can include up to ${this.mediaLimit} images/videos.`, "error");
        return;
      }
      if (!this.canPost) return;
      this.$emit("post", this.message.trim());
      this.message     = "";
      this.previewMode = false;
      draftStorage.clear("twist_composer");
    },
    submitLive({ title, body, code }) {
      this.$emit("post-live", { title, body, code });
      // LiveTwistComposerComponent clears its own draft on emit
    }
  },
  template: `
    <div style="margin:0 auto 20px;max-width:600px;">

      <!-- Mode selector: Twist | Live Twist -->
      <div style="display:flex;gap:4px;margin-bottom:-1px;position:relative;z-index:1;">
        <button
          @click="composerMode = 'twist'"
          :style="{
            background: composerMode === 'twist' ? '#1e1535' : '#0f0a1e',
            color:      composerMode === 'twist' ? '#e8e0f0' : '#5a4e70',
            border:'1px solid #2e2050',
            borderBottom: composerMode === 'twist' ? '1px solid #1e1535' : '1px solid #2e2050',
            borderRadius:'8px 8px 0 0',
            padding:'5px 16px', fontSize:'13px', fontWeight:'600', margin:0, cursor:'pointer'
          }"
        >🌀 Twist</button>
        <button
          @click="composerMode = 'live'"
          :style="{
            background: composerMode === 'live' ? '#1e1535' : '#0f0a1e',
            color:      composerMode === 'live' ? '#fb923c' : '#5a4e70',
            border:'1px solid #2e2050',
            borderBottom: composerMode === 'live' ? '1px solid #1e1535' : '1px solid #2e2050',
            borderRadius:'8px 8px 0 0',
            padding:'5px 16px', fontSize:'13px', fontWeight:'600', margin:0, cursor:'pointer'
          }"
        >⚡ Live Twist</button>
      </div>

      <!-- Regular Twist composer -->
      <div
        v-show="composerMode === 'twist'"
        style="
          background:#1e1535;border:1px solid #2e2050;border-radius:0 8px 8px 8px;
          padding:16px;text-align:left;
        "
      >
        <div style="display:flex;gap:4px;margin-bottom:6px;">
          <button
            @click="previewMode = false"
            :style="{
              background: !previewMode ? '#2e2050' : 'none',
              color:      !previewMode ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #2e2050', borderRadius:'6px 6px 0 0',
              padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer'
            }"
          >Write</button>
          <button
            @click="previewMode = true"
            :style="{
              background: previewMode ? '#2e2050' : 'none',
              color:      previewMode ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #2e2050', borderRadius:'6px 6px 0 0',
              padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer'
            }"
          >Preview</button>
        </div>

        <textarea
          v-show="!previewMode"
          ref="twistTextarea"
          v-model="message"
          placeholder="What's your twist? (markdown supported)"
          maxlength="500"
          style="
            width:100%;box-sizing:border-box;
            padding:10px;border-radius:0 8px 8px 8px;
            border:1px solid #2e2050;background:#0f0a1e;
            color:#e8e0f0;font-size:15px;
            resize:none;height:80px;
          "
          @keydown.ctrl.enter="submit"
        ></textarea>

        <div v-show="!previewMode" style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <input
            ref="imageInput"
            type="file"
            accept="image/*"
            style="display:none;"
            @change="onImageSelected"
          />
          <button
            @click="$refs.imageInput.click()"
            :disabled="!username || !hasKeychain || isUploadingImage || !canUploadImage"
            :title="!canUploadImage ? ('Image limit reached (' + mediaLimit + ').') : ''"
            style="padding:6px 12px;margin:0;background:#1a1030;border:1px solid #3b1f5e;color:#c084fc;font-size:12px;"
          >{{ isUploadingImage ? "Uploading…" : "📷 Upload image" }}</button>
          <span v-if="uploadError" style="font-size:12px;color:#fca5a5;">{{ uploadError }}</span>
        </div>

        <div
          v-show="previewMode"
          class="twist-body"
          v-html="previewHtml"
          style="
            min-height:80px;padding:10px;border-radius:0 8px 8px 8px;
            border:1px solid #2e2050;background:#0f0a1e;
            font-size:15px;color:#e8e0f0;line-height:1.6;word-break:break-word;
          "
        ></div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <span :style="{ fontSize:'13px', color: (overLimit || mediaLimitExceeded) ? '#fca5a5' : '#5a4e70' }">
            {{ charCount }} / 280 (media excluded) · media {{ mediaCount }}/{{ mediaLimit }}
          </span>
          <button @click="submit" :disabled="!canPost" style="padding:7px 20px;margin:0;">
            {{ isPosting ? "Posting..." : "Twist 🌀" }}
          </button>
        </div>
      </div>

      <!-- Live Twist editor — v-if so it only mounts when the tab is active -->
      <live-twist-composer-component
        v-if="composerMode === 'live'"
        :username="username"
        :has-keychain="hasKeychain"
        :is-posting="isPosting"
        @post="submitLive"
        @cancel="composerMode = 'twist'"
        style="margin:0;"
      ></live-twist-composer-component>

    </div>
  `
};


const SignalItemComponent = {
  name: "SignalItemComponent",
  props: {
    signal: { type: Object, required: true },
    read:   { type: Boolean, default: false }
  },
  computed: {
    icon() {
      return { love: "❤️", reply: "💬", mention: "📣", follow: "👤", retwist: "🔁", secret_twist: "🔒" }[this.signal.type] || "🔔";
    },
    label() {
      const a = `@${this.signal.actor}`;
      switch (this.signal.type) {
        case "love":    return `${a} gave twist love to your twist`;
        case "reply":   return `${a} replied to your twist`;
        case "mention": return `${a} mentioned you`;
        case "follow":  return `${a} followed you`;
        case "retwist":       return `${a} retwisted your twist`;
        case "secret_twist":  return `${a} sent you a Secret Twist`;
        default:              return `${a} interacted with you`;
      }
    },
    // Build a link to the relevant twist page for every signal type that
    // has a target post. postAuthor + permlink are now stored on all types.
    viewUrl() {
      if (!this.signal.postAuthor || !this.signal.permlink) return null;
      return `#/@${this.signal.postAuthor}/${this.signal.permlink}`;
    },
    relativeTime() {
      const diff = Date.now() - this.signal.ts.getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60)  return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60)  return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)  return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    },
    absoluteTime() {
      return this.signal.ts.toUTCString().replace(" GMT", " UTC");
    }
  },
  template: `
    <div :style="{
      display:'flex', alignItems:'flex-start', gap:'12px',
      padding:'12px 14px',
      background: read ? 'var(--card, #1e1535)' : '#1a1040',
      borderBottom:'1px solid #2e2050',
      borderLeft: read ? '3px solid transparent' : '3px solid #a855f7',
      transition:'background 0.2s'
    }">

      <!-- Actor avatar -->
      <a :href="'#/@' + signal.actor" style="flex-shrink:0;">
        <img
          :src="'https://steemitimages.com/u/' + signal.actor + '/avatar/small'"
          style="width:36px;height:36px;border-radius:50%;border:2px solid #2e2050;"
          @error="$event.target.src='https://steemitimages.com/u/guest/avatar/small'"
        />
      </a>

      <!-- Content -->
      <div style="flex:1;min-width:0;">

        <!-- Type icon + label -->
        <div style="font-size:14px;color:#e8e0f0;line-height:1.4;">
          <span style="margin-right:5px;">{{ icon }}</span>
          <a
            :href="'#/@' + signal.actor"
            style="color:#a855f7;font-weight:600;text-decoration:none;"
          >@{{ signal.actor }}</a>
          <span style="color:#9b8db0;">
            {{ label.replace('@' + signal.actor, '').trim() }}
          </span>
        </div>

        <!-- Body preview -->
        <div v-if="signal.body" style="
          margin-top:4px;font-size:13px;color:#9b8db0;
          font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">
          "{{ signal.body }}"
        </div>

        <!-- Timestamp + link -->
        <div style="display:flex;align-items:center;gap:10px;margin-top:5px;">
          <span :title="absoluteTime" style="font-size:12px;color:#5a4e70;">
            {{ relativeTime }}
          </span>
          <a
            v-if="viewUrl"
            :href="viewUrl"
            style="font-size:12px;color:#22d3ee;text-decoration:none;"
          >View →</a>
        </div>

      </div>

      <!-- Unread dot -->
      <div v-if="!read" style="
        width:8px;height:8px;border-radius:50%;
        background:#a855f7;flex-shrink:0;margin-top:4px;
      "></div>

    </div>
  `
};

// ---- UserRowComponent ----
// A compact user row: avatar, display name, @username, bio, optional Follow button.
// Used in Followers, Following, and Friends lists.
const UserRowComponent = {
  name: "UserRowComponent",
  props: {
    username:     { type: String,  required: true },
    profileData:  { type: Object,  default: null },
    // Follow feature — only shown when loggedInUser is set and not viewing own row
    loggedInUser: { type: String,  default: "" },
    hasKeychain:  { type: Boolean, default: false },
    isFollowing:  { type: Boolean, default: false }  // is loggedInUser following this user?
  },
  emits: ["follow", "unfollow"],
  data() {
    return {
      followState:  this.isFollowing,   // local optimistic state
      isBusy:       false
    };
  },
  watch: {
    isFollowing(v) { this.followState = v; }
  },
  computed: {
    displayName() { return this.profileData?.displayName || this.username; },
    about()       { return this.profileData?.about || ""; },
    profileUrl()  { return `#/@${this.username}`; },
    showFollowBtn() {
      // Show only when logged in, has Keychain, and not viewing your own row
      return !!this.loggedInUser && this.hasKeychain &&
             this.loggedInUser !== this.username;
    }
  },
  methods: {
    toggleFollow(e) {
      e.preventDefault();   // don't navigate via the parent <a>
      e.stopPropagation();
      if (this.isBusy) return;
      this.isBusy = true;
      const action = this.followState ? unfollowUser : followUser;
      action(this.loggedInUser, this.username, (res) => {
        this.isBusy = false;
        if (res.success) {
          this.followState = !this.followState;
          this.$emit(this.followState ? "follow" : "unfollow", this.username);
        }
      });
    }
  },
  template: `
    <a
      :href="profileUrl"
      style="
        display:flex;align-items:center;gap:12px;
        padding:10px 14px;
        text-decoration:none;
        border-bottom:1px solid #2e2050;
        transition:background 0.15s;
      "
      @mouseenter="$event.currentTarget.style.background='#16102a'"
      @mouseleave="$event.currentTarget.style.background=''"
    >
      <!-- Avatar -->
      <img
        :src="'https://steemitimages.com/u/' + username + '/avatar/small'"
        style="width:40px;height:40px;border-radius:50%;border:2px solid #2e2050;flex-shrink:0;"
        @error="$event.target.src='https://steemitimages.com/u/guest/avatar/small'"
      />

      <!-- Name + username + bio -->
      <div style="min-width:0;flex:1;">
        <div style="font-weight:600;color:#e8e0f0;font-size:14px;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          {{ displayName }}
        </div>
        <div style="font-size:12px;color:#a855f7;">@{{ username }}</div>
        <div v-if="about" style="
          font-size:12px;color:#9b8db0;margin-top:2px;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">{{ about }}</div>
      </div>

      <!-- Follow / Unfollow button -->
      <button
        v-if="showFollowBtn"
        @click="toggleFollow"
        :disabled="isBusy"
        :style="{
          flexShrink: 0,
          borderRadius: '20px', padding: '4px 12px', fontSize: '12px',
          fontWeight: '600', border: '1px solid', margin: 0,
          background:  followState ? '#0c2d1a' : 'linear-gradient(135deg,#8b2fc9,#e0187a)',
          color:       followState ? '#4ade80' : '#fff',
          borderColor: followState ? '#166534' : 'transparent',
          cursor:      isBusy ? 'default' : 'pointer'
        }"
      >{{ isBusy ? '…' : (followState ? 'Following' : 'Follow') }}</button>

      <!-- Arrow (when no follow button) -->
      <span v-else style="color:#2e2050;font-size:16px;flex-shrink:0;">›</span>
    </a>
  `
};

// ---- SecretTwistComposerComponent ----
// Composer for sending a Secret Twist to a specific recipient.
// Supports markdown with a Write / Preview tab toggle.
const SecretTwistComposerComponent = {
  name: "SecretTwistComposerComponent",
  inject: ["notify"],
  props: {
    username:    { type: String,  default: "" },
    hasKeychain: { type: Boolean, default: false },
    isSending:   { type: Boolean, default: false },
    toUsername:  { type: String,  default: "" }
  },
  emits: ["send"],
  data() {
    const draft = draftStorage.load("secret_composer", {});
    return {
      recipient:   this.toUsername || draft.recipient || "",
      message:     draft.message   || "",
      previewMode: false,
      isUploadingImage: false,
      uploadError: ""
    };
  },
  computed: {
    charCount()   { return this.message.length; },
    mediaCount()  { return countMediaEmbeds(this.message); },
    mediaLimit()  { return REGULAR_TWIST_MEDIA_LIMIT; },
    canUploadImage() { return this.mediaCount < this.mediaLimit; },
    previewHtml() {
      return this.message.trim()
        ? DOMPurify.sanitize(renderMarkdown(this.message))
        : "<em style='color:#5a4e70'>Nothing to preview.</em>";
    },
    canSend() {
      return !!this.username && this.hasKeychain &&
             !!this.recipient.trim() &&
             this.recipient.trim().replace(/^@/, "") !== this.username &&
             this.charCount > 0 && !this.isSending;
    }
  },
  watch: {
    recipient(v) { draftStorage.save("secret_composer", { recipient: v, message: this.message }); },
    message(v)   { draftStorage.save("secret_composer", { recipient: this.recipient, message: v }); }
  },
  methods: {
    insertAtCursor(text) {
      const ta = this.$refs.secretTextarea;
      if (!ta) {
        this.message = (this.message ? this.message + "\n" : "") + text;
        return;
      }
      const start = ta.selectionStart ?? this.message.length;
      const end   = ta.selectionEnd ?? this.message.length;
      this.message = this.message.slice(0, start) + text + this.message.slice(end);
      this.$nextTick(() => {
        ta.focus();
        const pos = start + text.length;
        ta.selectionStart = pos;
        ta.selectionEnd   = pos;
      });
    },
    onImageSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      event.target.value = "";
      this.uploadImage(file);
    },
    uploadImage(file) {
      if (this.isUploadingImage) return;
      if (!this.canUploadImage) {
        this.notify(`A secret twist can include up to ${this.mediaLimit} images/videos.`, "error");
        return;
      }
      this.uploadError = "";
      this.isUploadingImage = true;
      uploadImageToSteemit(this.username, file, (res) => {
        this.isUploadingImage = false;
        if (!res.success) {
          this.uploadError = res.error || "Image upload failed.";
          this.notify(this.uploadError, "error");
          return;
        }
        const alt = makeImageAltText(file.name);
        this.insertAtCursor(`![${alt}](${res.url})`);
        this.notify("Image uploaded and inserted.", "success");
      });
    },
    submit() {
      if (!this.canSend) return;
      this.$emit("send", {
        recipient: this.recipient.trim().replace(/^@/, ""),
        message:   this.message.trim()
      });
      this.message     = "";
      this.previewMode = false;
      draftStorage.clear("secret_composer");
    }
  },
  template: `
    <div style="
      background:#1a1030;border:1px solid #3b1f5e;border-radius:12px;
      padding:16px;margin:0 auto 20px;max-width:600px;text-align:left;
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:16px;">🔒</span>
        <span style="color:#c084fc;font-weight:600;font-size:14px;">New Secret Twist</span>
      </div>

      <!-- Recipient field -->
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#9b8db0;display:block;margin-bottom:4px;">To</label>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#a855f7;font-size:15px;">@</span>
          <input
            v-model="recipient"
            type="text"
            placeholder="username"
            autocomplete="off"
            style="
              flex:1;padding:7px 10px;border-radius:8px;
              border:1px solid #3b1f5e;background:#0f0a1e;
              color:#e8e0f0;font-size:14px;
            "
            @keydown.enter="submit"
          />
        </div>
        <div v-if="recipient && recipient.trim() === username"
             style="font-size:12px;color:#fca5a5;margin-top:4px;">
          You cannot send a Secret Twist to yourself.
        </div>
      </div>

      <!-- Write / Preview tabs -->
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <button
          @click="previewMode = false"
          :style="{
            background: !previewMode ? '#3b1f5e' : 'none',
            color:      !previewMode ? '#e8e0f0' : '#9b8db0',
            border: '1px solid #3b1f5e', borderRadius:'6px 6px 0 0',
            padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer'
          }"
        >Write</button>
        <button
          @click="previewMode = true"
          :style="{
            background: previewMode ? '#3b1f5e' : 'none',
            color:      previewMode ? '#e8e0f0' : '#9b8db0',
            border: '1px solid #3b1f5e', borderRadius:'6px 6px 0 0',
            padding:'3px 12px', fontSize:'12px', margin:0, cursor:'pointer'
          }"
        >Preview</button>
      </div>

      <!-- Write mode -->
      <textarea
        v-show="!previewMode"
        ref="secretTextarea"
        v-model="message"
        placeholder="Write your secret message… (markdown supported)"
        style="
          width:100%;box-sizing:border-box;
          padding:10px;border-radius:0 8px 8px 8px;
          border:1px solid #3b1f5e;background:#0f0a1e;
          color:#e8e0f0;font-size:15px;
          resize:vertical;min-height:80px;
        "
        @keydown.ctrl.enter="submit"
      ></textarea>

      <div v-show="!previewMode" style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          style="display:none;"
          @change="onImageSelected"
        />
        <button
          @click="$refs.imageInput.click()"
          :disabled="!username || !hasKeychain || isUploadingImage || !canUploadImage"
          :title="!canUploadImage ? ('Image limit reached (' + mediaLimit + ').') : ''"
          style="padding:6px 12px;margin:0;background:#0f0a1e;border:1px solid #3b1f5e;color:#c084fc;font-size:12px;"
        >{{ isUploadingImage ? "Uploading…" : "📷 Upload image" }}</button>
        <span v-if="uploadError" style="font-size:12px;color:#fca5a5;">{{ uploadError }}</span>
      </div>

      <!-- Preview mode -->
      <div
        v-show="previewMode"
        class="twist-body"
        v-html="previewHtml"
        style="
          min-height:80px;padding:10px;border-radius:0 8px 8px 8px;
          border:1px solid #3b1f5e;background:#0f0a1e;
          font-size:15px;color:#e8e0f0;line-height:1.6;word-break:break-word;
        "
      ></div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span style="font-size:13px;color:#5a4e70;">{{ charCount }} chars</span>
        <button
          @click="submit"
          :disabled="!canSend"
          style="padding:7px 20px;margin:0;background:linear-gradient(135deg,#6d28d9,#a21caf);"
        >{{ isSending ? "Sending…" : "Send 🔒" }}</button>
      </div>
    </div>
  `
};

// ---- SecretTwistCardComponent ----
// Renders a single Secret Twist. Shows a locked state to everyone except
// the sender and recipient, who see a Decrypt button. On successful
// decryption the plaintext is shown in place of the locked view.
const SecretTwistCardComponent = {
  name: "SecretTwistCardComponent",
  // Recursive: Vue resolves "secret-twist-card-component" from the global registry
  // by matching this component's name, enabling nested reply rendering.
  props: {
    post:        { type: Object,  required: true },
    username:    { type: String,  default: "" },
    hasKeychain: { type: Boolean, default: false },
    depth:       { type: Number,  default: 0 },   // nesting depth for replies
    showParentLink: { type: Boolean, default: false },
    highlightKey:   { type: String, default: "" }
  },
  data() {
    return {
      decrypted:      null,    // plaintext after successful decrypt
      isDecrypting:   false,
      decryptError:   "",
      showReplyBox:    false,
      replyMessage:    draftStorage.load("secret_reply_" + this.post.permlink, ""),
      replyPreviewMode: false,
      isUploadingReplyImage: false,
      replyUploadError: "",
      isReplying:      false,
      replyError:      "",
      replies:        [],      // decrypted nested replies
      loadingReplies: false,
      repliesLoaded:  false
    };
  },
  computed: {
    meta() {
      try {
        const raw = this.post.json_metadata;
        if (!raw) return {};
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch { return {}; }
    },
    recipient()    { return this.meta.to || ""; },
    payload()      { return this.meta.payload || ""; },
    isSender()     { return this.username === this.post.author; },
    isRecipient()  { return this.username === this.recipient; },
    isParticipant(){ return this.isSender || this.isRecipient; },
    canDecrypt()   { return this.isParticipant && this.hasKeychain && !!this.payload; },
    // Can reply only if: participant, has Keychain, and did NOT author this post
    // (prevents replying to your own message in the thread)
    canReply()     { return this.isParticipant && this.hasKeychain && !this.isSender; },
    // The other party in the conversation — used for reply encryption
    otherParty()   { return this.isSender ? this.recipient : this.post.author; },
    avatarUrl()    { return `https://steemitimages.com/u/${this.post.author}/avatar/small`; },
    parentAuthor()   { return (this.post.parent_author || "").trim(); },
    parentPermlink() { return (this.post.parent_permlink || "").trim(); },
    hasParent()      { return !!this.parentAuthor && !!this.parentPermlink; },
    parentKey()      { return this.hasParent ? `${this.parentAuthor}/${this.parentPermlink}` : ""; },
    isHighlighted()  { return !!this.highlightKey && this.highlightKey === postKey(this.post); },
    replyCount()      { return this.post.children || 0; },
    replyMediaCount() { return countMediaEmbeds(this.replyMessage); },
    mediaLimit()      { return REGULAR_TWIST_MEDIA_LIMIT; },
    replyMediaLimitExceeded() { return this.replyMediaCount > this.mediaLimit; },
    canUploadReplyImage() { return this.replyMediaCount < this.mediaLimit; },
    replyPreviewHtml() {
      return this.replyMessage.trim()
        ? DOMPurify.sanitize(renderMarkdown(this.replyMessage))
        : "<em style='color:#5a4e70'>Nothing to preview.</em>";
    },
    decryptedHtml() {
      if (this.decrypted === null) return "";
      return DOMPurify.sanitize(renderMarkdown(this.decrypted));
    },
    relativeTime() {
      const diff = Date.now() - steemDate(this.post.created).getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60)  return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60)  return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)  return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    }
  },
  watch: {
    replyMessage(v) { draftStorage.save("secret_reply_" + this.post.permlink, v); }
  },
  methods: {
    insertReplyAtCursor(text) {
      const ta = this.$refs.secretReplyTextarea;
      if (!ta) {
        this.replyMessage = (this.replyMessage ? this.replyMessage + "\n" : "") + text;
        return;
      }
      const start = ta.selectionStart ?? this.replyMessage.length;
      const end   = ta.selectionEnd ?? this.replyMessage.length;
      this.replyMessage = this.replyMessage.slice(0, start) + text + this.replyMessage.slice(end);
      this.$nextTick(() => {
        ta.focus();
        const pos = start + text.length;
        ta.selectionStart = pos;
        ta.selectionEnd   = pos;
      });
    },
    onReplyImageSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      event.target.value = "";
      this.uploadReplyImage(file);
    },
    uploadReplyImage(file) {
      if (this.isUploadingReplyImage) return;
      if (!this.canUploadReplyImage) {
        this.replyError = `A secret twist reply can include up to ${this.mediaLimit} images/videos.`;
        return;
      }
      this.replyUploadError = "";
      this.isUploadingReplyImage = true;
      uploadImageToSteemit(this.username, file, (res) => {
        this.isUploadingReplyImage = false;
        if (!res.success) {
          this.replyUploadError = res.error || "Image upload failed.";
          this.replyError = this.replyUploadError;
          return;
        }
        const alt = makeImageAltText(file.name);
        this.insertReplyAtCursor(`![${alt}](${res.url})`);
      });
    },
    decrypt() {
      if (!this.canDecrypt || this.isDecrypting) return;
      this.isDecrypting = true;
      this.decryptError = "";
      decryptSecretTwist(this.username, this.otherParty, this.payload, (res) => {
        this.isDecrypting = false;
        if (res.success) {
          this.decrypted = (res.result || "").replace(/^#/, "");
          // Auto-load replies after decrypt if any exist
          if (this.replyCount > 0 && !this.repliesLoaded) this.loadReplies();
        } else {
          this.decryptError = res.error || res.message || "Decryption failed.";
        }
      });
    },

    // Load nested replies — returned as raw post objects so they can be
    // rendered recursively by SecretTwistCardComponent instances.
    async loadReplies() {
      if (this.loadingReplies || this.repliesLoaded) return;
      this.loadingReplies = true;
      try {
        const raw = await fetchReplies(this.post.author, this.post.permlink);
        // Keep only genuine secret_twist replies
        this.replies = raw.filter(r => {
          try {
            const m = r.json_metadata;
            const meta = m ? (typeof m === "string" ? JSON.parse(m) : m) : {};
            return meta.type === "secret_twist";
          } catch { return false; }
        });
        this.repliesLoaded = true;
      } catch {}
      this.loadingReplies = false;
    },

    sendReply() {
      const text = this.replyMessage.trim();
      if (!text || !this.isParticipant || !this.hasKeychain || this.isReplying) return;
      if (this.replyMediaLimitExceeded) {
        this.replyError = `A secret twist reply can include up to ${this.mediaLimit} images/videos.`;
        return;
      }
      this.isReplying  = true;
      this.replyError  = "";
      replySecretTwist(
        this.username, this.otherParty, text,
        this.post.author, this.post.permlink,
        (res) => {
          this.isReplying = false;
          if (res.success) {
            this.replyMessage     = "";
            this.showReplyBox     = false;
            this.replyPreviewMode = false;
            this.replyUploadError = "";
            draftStorage.clear("secret_reply_" + this.post.permlink);
            // Reload replies after a short delay for indexing
            setTimeout(() => {
              this.repliesLoaded = false;
              this.loadReplies();
            }, 3000);
          } else {
            this.replyError = res.error || res.message || "Reply failed.";
          }
        }
      );
    },
    jumpToParent() {
      if (!this.hasParent) return;
      this.$emit("jump-to-parent", {
        key: this.parentKey,
        author: this.parentAuthor,
        permlink: this.parentPermlink
      });
    }
  },
  template: `
    <div :style="{
      background:'#1a1030', border:'1px solid #3b1f5e', borderRadius:'12px',
      padding:'14px 16px', margin:'10px auto', maxWidth:'600px', textAlign:'left',
      borderColor: isHighlighted ? '#facc15' : '#3b1f5e',
      boxShadow: isHighlighted ? '0 0 0 1px #facc15 inset' : 'none'
    }">
      <div v-if="showParentLink && hasParent" style="margin-bottom:8px;">
        <a
          href="#"
          @click.prevent="jumpToParent"
          style="font-size:12px;color:#d8b4fe;text-decoration:underline;"
        >↪ View original in Sent</a>
      </div>
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <a :href="'#/@' + post.author">
          <img
            :src="avatarUrl"
            style="width:40px;height:40px;border-radius:50%;border:2px solid #3b1f5e;"
            @error="$event.target.src='https://steemitimages.com/u/guest/avatar/small'"
          />
        </a>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <a :href="'#/@' + post.author"
               style="font-weight:bold;color:#c084fc;text-decoration:none;font-size:14px;">
              @{{ post.author }}
            </a>
            <span style="font-size:13px;color:#9b8db0;">→</span>
            <a :href="'#/@' + recipient"
               style="font-weight:bold;color:#c084fc;text-decoration:none;font-size:14px;">
              @{{ recipient }}
            </a>
          </div>
          <div style="font-size:12px;color:#5a4e70;margin-top:2px;">{{ relativeTime }}</div>
        </div>
        <span style="font-size:20px;">🔒</span>
      </div>

      <!-- Body: decrypted or locked -->
      <div v-if="decrypted !== null"
        class="twist-body"
        v-html="decryptedHtml"
        style="
          background:#0f0a1e;border-radius:8px;padding:12px;
          font-size:15px;color:#e8e0f0;line-height:1.6;
          border:1px solid #3b1f5e;margin-bottom:10px;
          word-break:break-word;
        "
      ></div>

      <div v-else style="
        display:flex;align-items:center;gap:10px;
        background:#0f0a1e;border-radius:8px;padding:12px;
        border:1px solid #3b1f5e;margin-bottom:10px;
      ">
        <span style="font-size:22px;">🔒</span>
        <span v-if="canDecrypt" style="font-size:14px;color:#9b8db0;">
          {{ isSender ? 'You sent this Secret Twist.' : 'You received a Secret Twist.' }}
        </span>
        <span v-else style="font-size:14px;color:#5a4e70;font-style:italic;">
          Secret Twist — only visible to sender and recipient.
        </span>
      </div>

      <!-- Action bar — Decrypt + Reply (shown once decrypted) -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <!-- Decrypt button -->
        <button
          v-if="canDecrypt && decrypted === null"
          @click="decrypt"
          :disabled="isDecrypting"
          style="background:linear-gradient(135deg,#6d28d9,#a21caf);padding:6px 16px;font-size:13px;margin:0;"
        >{{ isDecrypting ? "Decrypting…" : "🔓 Decrypt" }}</button>

        <!-- Reply button — only after decrypt, only to non-authors -->
        <button
          v-if="decrypted !== null && canReply"
          @click="showReplyBox = !showReplyBox"
          style="background:#1a1030;border:1px solid #3b1f5e;color:#c084fc;
                 border-radius:20px;padding:4px 12px;font-size:12px;margin:0;"
        >💬 {{ replyCount > 0 ? replyCount + ' repl' + (replyCount === 1 ? 'y' : 'ies') : 'Reply' }}</button>
      </div>

      <!-- Decrypt error -->
      <div v-if="decryptError" style="
        padding:8px 10px;border-radius:8px;font-size:13px;margin-bottom:8px;
        background:#2d0a0a;border:1px solid #7f1d1d;color:#fca5a5;
        display:flex;justify-content:space-between;align-items:center;
      ">
        <span>⚠️ {{ decryptError }}</span>
        <button @click="decryptError = ''"
          style="background:none;border:none;cursor:pointer;font-size:15px;padding:0;color:#fca5a5;line-height:1;margin:0;">✕</button>
      </div>

      <!-- Inline reply composer with Write / Preview -->
      <div v-if="showReplyBox && canReply" style="margin-bottom:10px;">
        <div style="display:flex;gap:4px;margin-bottom:4px;">
          <button
            @click="replyPreviewMode = false"
            :style="{
              background: !replyPreviewMode ? '#3b1f5e' : 'none',
              color:      !replyPreviewMode ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #3b1f5e', borderRadius:'6px 6px 0 0',
              padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer'
            }"
          >Write</button>
          <button
            @click="replyPreviewMode = true"
            :style="{
              background: replyPreviewMode ? '#3b1f5e' : 'none',
              color:      replyPreviewMode ? '#e8e0f0' : '#9b8db0',
              border:'1px solid #3b1f5e', borderRadius:'6px 6px 0 0',
              padding:'2px 10px', fontSize:'11px', margin:0, cursor:'pointer'
            }"
          >Preview</button>
        </div>

        <textarea
          v-show="!replyPreviewMode"
          ref="secretReplyTextarea"
          v-model="replyMessage"
          placeholder="Write an encrypted reply… (markdown supported)"
          style="
            width:100%;box-sizing:border-box;padding:8px;
            border-radius:0 8px 8px 8px;
            border:1px solid #3b1f5e;background:#0f0a1e;
            color:#e8e0f0;font-size:14px;resize:vertical;min-height:60px;
          "
          @keydown.ctrl.enter="sendReply"
        ></textarea>

        <div v-show="!replyPreviewMode" style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <input
            ref="replyImageInput"
            type="file"
            accept="image/*"
            style="display:none;"
            @change="onReplyImageSelected"
          />
          <button
            @click="$refs.replyImageInput.click()"
            :disabled="!username || !hasKeychain || isUploadingReplyImage || !canUploadReplyImage"
            :title="!canUploadReplyImage ? ('Image limit reached (' + mediaLimit + ').') : ''"
            style="padding:6px 12px;margin:0;background:#0f0a1e;border:1px solid #3b1f5e;color:#c084fc;font-size:12px;"
          >{{ isUploadingReplyImage ? "Uploading…" : "📷 Upload image" }}</button>
          <span v-if="replyUploadError" style="font-size:12px;color:#fca5a5;">{{ replyUploadError }}</span>
        </div>

        <div
          v-show="replyPreviewMode"
          class="twist-body"
          v-html="replyPreviewHtml"
          style="
            min-height:60px;padding:8px;border-radius:0 8px 8px 8px;
            border:1px solid #3b1f5e;background:#0f0a1e;
            font-size:14px;color:#e8e0f0;line-height:1.6;word-break:break-word;
          "
        ></div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span :style="{ fontSize:'12px', color: replyMediaLimitExceeded ? '#fca5a5' : '#5a4e70' }">
            {{ replyMessage.length }} chars · media {{ replyMediaCount }}/{{ mediaLimit }}
          </span>
          <button
            @click="sendReply"
            :disabled="!replyMessage.trim() || isReplying || replyMediaLimitExceeded"
            style="background:linear-gradient(135deg,#6d28d9,#a21caf);padding:5px 14px;font-size:12px;margin:0;"
          >{{ isReplying ? "Sending…" : "Send 🔒" }}</button>
        </div>
        <div v-if="replyError" style="
          margin-top:6px;padding:6px 8px;border-radius:6px;font-size:12px;
          background:#2d0a0a;border:1px solid #7f1d1d;color:#fca5a5;
        ">⚠️ {{ replyError }}</div>
      </div>

      <!-- Nested encrypted replies — recursive SecretTwistCardComponent -->
      <div v-if="decrypted !== null && replies.length > 0" style="
        margin-top:8px;border-top:1px solid #2e1060;padding-top:8px;padding-left:12px;
      ">
        <secret-twist-card-component
          v-for="r in replies"
          :key="r.permlink"
          :post="r"
          :username="username"
          :has-keychain="hasKeychain"
          :depth="depth + 1"
          :highlight-key="highlightKey"
          @jump-to-parent="$emit('jump-to-parent', $event)"
          style="margin:0 0 8px 0;"
        ></secret-twist-card-component>
      </div>

      <!-- Loading replies indicator -->
      <div v-if="loadingReplies" style="font-size:12px;color:#5a4e70;padding:6px 0;">
        Loading replies…
      </div>
    </div>
  `
};
