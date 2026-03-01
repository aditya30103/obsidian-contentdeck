import { App, normalizePath, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// ── Types (mirroring ContentDeck's src/types) ────────────────────────────────

interface TagArea {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  sort_order: number;
  created_at: string;
}

interface Note {
  type: string;
  content: string;
  created_at: string;
}

interface BookmarkMetadata {
  duration?: string;
  channel?: string;
  word_count?: number;
  reading_time?: number;
  author?: string;
  authors?: string[];
  abstract?: string;
  arxiv_id?: string;
  published?: string;
}

interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  excerpt: string | null;
  source_type: string;
  status: string;
  is_favorited: boolean;
  notes: Note[];
  tags: string[];
  areas: TagArea[];
  metadata: BookmarkMetadata;
  synced: boolean;
  created_at: string;
  started_reading_at: string | null;
  finished_at: string | null;
}

// ── Settings ─────────────────────────────────────────────────────────────────

interface ContentDeckSettings {
  supabaseUrl: string;
  apiToken: string;
  vaultFolder: string;
}

const DEFAULT_SETTINGS: ContentDeckSettings = {
  supabaseUrl: '',
  apiToken: '',
  vaultFolder: 'ContentDeck',
};

// ── Markdown generation (ported from src/lib/obsidian.ts) ────────────────────

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  substack: 'Substack',
  blog: 'Blog',
  book: 'Book',
  arxiv: 'arXiv',
};

function yamlEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function isBookWithoutUrl(bookmark: Pick<Bookmark, 'source_type' | 'url'>): boolean {
  return bookmark.source_type === 'book' && !bookmark.url.startsWith('http');
}

function safeFilename(bookmark: Bookmark): string {
  const name =
    bookmark.title || (isBookWithoutUrl(bookmark) ? 'Untitled Book' : getDomain(bookmark.url));
  return (
    name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) + '.md'
  );
}

function getSourceFolder(sourceType: string): string {
  const folders: Record<string, string> = {
    youtube: 'Videos',
    twitter: 'Threads',
    linkedin: 'LinkedIn',
    substack: 'Articles',
    blog: 'Articles',
    book: 'Books',
    arxiv: 'Papers',
  };
  return folders[sourceType] ?? 'Articles';
}

function generateMarkdown(bookmark: Bookmark): string {
  const lines: string[] = [];
  const noUrl = isBookWithoutUrl(bookmark);

  // YAML frontmatter
  lines.push('---');
  if (!noUrl) lines.push(`url: "${yamlEscape(bookmark.url)}"`);
  if (bookmark.title) lines.push(`title: "${yamlEscape(bookmark.title)}"`);
  lines.push(`source: ${SOURCE_LABELS[bookmark.source_type] ?? bookmark.source_type}`);
  lines.push(`status: ${bookmark.status}`);
  lines.push(`content_deck_id: "${bookmark.id}"`);
  if (bookmark.is_favorited) lines.push('favorited: true');
  if (bookmark.areas.length > 0) {
    lines.push(
      `areas: [${bookmark.areas.map((a) => `"[[${yamlEscape(a.name)}]]"`).join(', ')}]`,
    );
  }
  if (bookmark.tags.length > 0) {
    lines.push(`tags: [${bookmark.tags.map((t) => `"[[${yamlEscape(t)}]]"`).join(', ')}]`);
  }
  lines.push(`created: ${formatDate(bookmark.created_at)}`);
  if (bookmark.started_reading_at)
    lines.push(`started: ${formatDate(bookmark.started_reading_at)}`);
  if (bookmark.finished_at) lines.push(`finished: ${formatDate(bookmark.finished_at)}`);
  if (bookmark.metadata?.reading_time)
    lines.push(`reading_time: ${bookmark.metadata.reading_time} min`);
  if (bookmark.metadata?.channel)
    lines.push(`channel: "${yamlEscape(bookmark.metadata.channel)}"`);
  if (bookmark.metadata?.author)
    lines.push(`author: "${yamlEscape(bookmark.metadata.author)}"`);
  if (bookmark.metadata?.authors && bookmark.metadata.authors.length > 0)
    lines.push(
      `authors: [${bookmark.metadata.authors.map((a) => `"${yamlEscape(a)}"`).join(', ')}]`,
    );
  if (bookmark.metadata?.arxiv_id) lines.push(`arxiv_id: ${bookmark.metadata.arxiv_id}`);
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${bookmark.title || (noUrl ? 'Untitled Book' : bookmark.url)}`);
  lines.push('');

  // Link — omitted for URL-less books
  if (!noUrl) {
    lines.push(`> [Open original](${bookmark.url}) — ${getDomain(bookmark.url)}`);
    lines.push('');
  }

  // Summary / Abstract
  const isArxiv = bookmark.source_type === 'arxiv';
  const summaryText = isArxiv
    ? (bookmark.metadata?.abstract ?? bookmark.excerpt)
    : bookmark.excerpt;
  if (summaryText) {
    lines.push(`## ${isArxiv ? 'Abstract' : 'Summary'}`);
    lines.push('');
    lines.push(summaryText);
    lines.push('');
  }

  // Notes (non-reflection)
  const regularNotes = bookmark.notes.filter((n) => n.type !== 'reflection');
  const reflections = bookmark.notes.filter((n) => n.type === 'reflection');

  if (regularNotes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of regularNotes) {
      const emoji =
        ({ insight: '💡', question: '❓', highlight: '🖍️', note: '📝' } as Record<string, string>)[
          note.type
        ] ?? '📝';
      const label = note.type.charAt(0).toUpperCase() + note.type.slice(1);
      lines.push(`### ${emoji} ${label}`);
      lines.push('');
      lines.push(note.content);
      lines.push('');
      lines.push(`*${formatDate(note.created_at)}*`);
      lines.push('');
    }
  }

  // Reflection notes
  if (reflections.length > 0) {
    lines.push('## Reflection');
    lines.push('');
    for (const note of reflections) {
      lines.push(note.content);
      lines.push('');
      lines.push(`*${formatDate(note.created_at)}*`);
      lines.push('');
    }
  }

  // Metadata footer
  if (bookmark.metadata?.duration || bookmark.metadata?.word_count) {
    lines.push('---');
    lines.push('');
    const meta: string[] = [];
    if (bookmark.metadata.duration) meta.push(`Duration: ${bookmark.metadata.duration}`);
    if (bookmark.metadata.word_count)
      meta.push(`Words: ${bookmark.metadata.word_count.toLocaleString()}`);
    if (bookmark.metadata.reading_time)
      meta.push(`Reading time: ${bookmark.metadata.reading_time} min`);
    lines.push(meta.join(' | '));
    lines.push('');
  }

  return lines.join('\n');
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class ContentDeckPlugin extends Plugin {
  settings!: ContentDeckSettings;
  private isSyncing = false;

  async onload() {
    await this.loadSettings();

    // Ribbon icon
    this.addRibbonIcon('download-cloud', 'Sync ContentDeck bookmarks', () => {
      void this.syncBookmarks();
    });

    // Command palette
    this.addCommand({
      id: 'sync-contentdeck-bookmarks',
      name: 'Sync ContentDeck bookmarks',
      callback: () => {
        void this.syncBookmarks();
      },
    });

    // Settings tab
    this.addSettingTab(new ContentDeckSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    ) as ContentDeckSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async syncBookmarks() {
    // Guard: prevent parallel syncs from ribbon double-click
    if (this.isSyncing) {
      new Notice('Sync already in progress…');
      return;
    }

    const { supabaseUrl, apiToken, vaultFolder } = this.settings;

    if (!supabaseUrl || !apiToken || !vaultFolder) {
      new Notice('Configure ContentDeck Sync settings first');
      return;
    }

    this.isSyncing = true;
    // Persistent notice (timeout=0) — updated as sync progresses
    const progress = new Notice('Fetching bookmarks from ContentDeck…', 0);

    try {
      // 1. Fetch done+unsynced bookmarks
      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const res = await fetch(
        `${baseUrl}/functions/v1/sync-done?token=${encodeURIComponent(apiToken)}`,
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
          error?: string;
        };
        throw new Error(err.error ?? res.statusText);
      }

      const data = (await res.json()) as { bookmarks: Bookmark[] };
      const bookmarks = data.bookmarks;

      if (bookmarks.length === 0) {
        progress.hide();
        new Notice('Nothing new to sync');
        return;
      }

      // 2. Write each bookmark as a vault note
      const synced: string[] = [];
      let failed = 0;

      for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i]!;
        progress.setMessage(`Writing note ${i + 1} of ${bookmarks.length}…`);
        try {
          await this.createOrUpdateNote(bookmark);
          synced.push(bookmark.id);
        } catch (e) {
          console.error('ContentDeck: failed to write note', bookmark.id, e);
          failed++;
        }
      }

      // 3. Mark successfully written bookmarks as synced in ContentDeck
      if (synced.length > 0) {
        progress.setMessage('Marking synced in ContentDeck…');
        try {
          await fetch(`${baseUrl}/functions/v1/sync-done?token=${encodeURIComponent(apiToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: synced }),
          });
        } catch (e) {
          // Notes are already written — don't block the success notice
          console.error('ContentDeck: failed to mark synced', e);
        }
      }

      progress.hide();

      const noun = synced.length === 1 ? 'bookmark' : 'bookmarks';
      if (failed > 0) {
        new Notice(`Synced ${synced.length} ${noun} (${failed} failed — check console) ✓`);
      } else {
        new Notice(`Synced ${synced.length} ${noun} from ContentDeck ✓`);
      }
    } catch (e) {
      progress.hide();
      new Notice(`ContentDeck sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /** Create each segment of a folder path, skipping segments that already exist. */
  private async ensureFolder(folderPath: string): Promise<void> {
    const parts = normalizePath(folderPath).split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async createOrUpdateNote(bookmark: Bookmark): Promise<void> {
    const { vaultFolder } = this.settings;
    const sourceFolder = getSourceFolder(bookmark.source_type);
    const folderPath = normalizePath(`${vaultFolder}/${sourceFolder}`);

    await this.ensureFolder(folderPath);

    const filename = safeFilename(bookmark);
    const filePath = normalizePath(`${folderPath}/${filename}`);
    const content = generateMarkdown(bookmark);

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }
}

// ── Settings tab ─────────────────────────────────────────────────────────────

class ContentDeckSettingTab extends PluginSettingTab {
  plugin: ContentDeckPlugin;

  constructor(app: App, plugin: ContentDeckPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'ContentDeck Sync' });

    new Setting(containerEl)
      .setName('Supabase URL')
      .setDesc('Your ContentDeck Supabase project URL (e.g. https://xyz.supabase.co)')
      .addText((text) =>
        text
          .setPlaceholder('https://xyz.supabase.co')
          .setValue(this.plugin.settings.supabaseUrl)
          .onChange(async (value) => {
            // Normalize on save: strip trailing slash
            this.plugin.settings.supabaseUrl = value.trim().replace(/\/$/, '');
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('API Token')
      .setDesc('Token from ContentDeck → Settings → API Tokens')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Paste your token here')
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Vault folder')
      .setDesc('Folder inside your vault where bookmarks will be saved (e.g. ContentDeck)')
      .addText((text) =>
        text
          .setPlaceholder('ContentDeck')
          .setValue(this.plugin.settings.vaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.vaultFolder = value.trim() || 'ContentDeck';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Sync now')
      .setDesc('Pull all done, unsynced bookmarks into this vault immediately.')
      .addButton((btn) =>
        btn
          .setButtonText('Sync Now')
          .setCta()
          .onClick(() => {
            void this.plugin.syncBookmarks();
          }),
      );
  }
}
