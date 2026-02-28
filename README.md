# ContentDeck Sync — Obsidian Plugin

Pull your "done" bookmarks from [ContentDeck](https://contentdeck.vercel.app) directly into your Obsidian vault. Works on desktop, iPhone, and iPad via iCloud sync.

---

## How it works

1. You read something in ContentDeck and mark it **done**
2. Open Obsidian → click the ribbon icon (or run the command)
3. All done, unsynced bookmarks are pulled into your vault as Markdown notes
4. ContentDeck marks them as synced — no duplicates on next run

Sync is **one-way pull only**: ContentDeck → Obsidian. Your vault notes are never read back or modified by ContentDeck.

---

## Installation (via BRAT)

The plugin is not yet in the Obsidian Community Store. Install it via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install the **BRAT** plugin from the Obsidian Community Store
2. Open BRAT settings → **"Add Beta Plugin"**
3. Paste: `aditya30103/obsidian-contentdeck`
4. Click **"Add Plugin"** — BRAT downloads the latest release
5. Enable **ContentDeck Sync** in Settings → Community Plugins

---

## Configuration

Settings → ContentDeck Sync:

| Field | What to enter |
|---|---|
| **Supabase URL** | Your ContentDeck Supabase project URL (e.g. `https://xyz.supabase.co`) |
| **API Token** | Token from ContentDeck → Settings → API Tokens → Generate Token |
| **Vault Folder** | Subfolder inside this vault where notes will be saved (default: `ContentDeck`) |

---

## Note structure

Each bookmark becomes a Markdown file with YAML frontmatter:

```markdown
---
url: "https://example.com/article"
title: "Article Title"
source: Blog
status: done
content_deck_id: "uuid"
areas: ["[[Programming]]", "[[Design]]"]
tags: ["[[typescript]]", "[[react]]"]
created: Mar 1, 2026
finished: Mar 1, 2026
reading_time: 8 min
---

# Article Title

> [Open original](https://example.com/article) — example.com

## Summary

Article excerpt or summary text.

## Notes

### 💡 Insight

Your insight note text.

*Mar 1, 2026*

## Reflection

Your reflection after reading.

*Mar 1, 2026*
```

### Folder structure

Notes are sorted into subfolders by content type:

```
ContentDeck/
├── Videos/      ← YouTube
├── Threads/     ← Twitter / X
├── LinkedIn/    ← LinkedIn
├── Articles/    ← Blogs, Substack
├── Books/       ← Books (with or without URL)
└── Papers/      ← arXiv
```

---

## Triggering a sync

**Ribbon icon** — click the download-cloud icon in the left sidebar

**Command palette** — `Ctrl/Cmd + P` → "Sync ContentDeck bookmarks"

**Settings page** — "Sync Now" button in the plugin settings

---

## Getting your API token

1. Open ContentDeck → Settings (gear icon)
2. Go to the **API Tokens** tab
3. Click **Generate Token**, give it a name (e.g. "Obsidian")
4. Copy the token — it is only shown once
5. Paste it into the plugin settings

---

## Phase A vs Phase B export

ContentDeck has two export paths that produce **identical Markdown** and write to the **same folder structure**:

| | Phase A (ContentDeck app) | Phase B (this plugin) |
|---|---|---|
| **Trigger** | Manual export button or auto-export on mark-done | Ribbon icon / command palette in Obsidian |
| **How** | Obsidian URI scheme (`obsidian://new?...`) — opens Obsidian | Pulls via API — works with Obsidian closed |
| **Best for** | Desktop, when Obsidian is open | All devices, iOS/iPad via iCloud |
| **Output** | `{VaultFolder}/{SourceFolder}/{Title}.md` | Same |

---

## Troubleshooting

**"Configure ContentDeck Sync settings first"** — fill in all three settings fields.

**"Nothing new to sync"** — all done bookmarks are already marked synced. Mark a new bookmark as done in ContentDeck, then sync again.

**"ContentDeck sync failed: Invalid token"** — token is wrong or expired. Generate a new one in ContentDeck Settings → API Tokens.

**Notes appear in wrong folder** — check the Vault Folder setting matches what you expect. Default is `ContentDeck`.

---

## Development

```bash
git clone https://github.com/aditya30103/obsidian-contentdeck
cd obsidian-contentdeck
npm install
npm run build        # produces main.js
```

To test locally, copy `main.js`, `manifest.json`, and `styles.css` into:
```
<YourVault>/.obsidian/plugins/contentdeck-sync/
```
Then enable the plugin in Obsidian.

### Releasing

Tag a version to trigger the GitHub Actions release workflow:
```bash
# Bump version in manifest.json first, then:
git tag 1.x.y
git push origin 1.x.y
```
The workflow builds `main.js` and publishes a GitHub Release with all three required files.
