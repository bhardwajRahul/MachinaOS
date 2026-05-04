/**
 * Provider configs — every credential provider as a plain config object.
 *
 * Icons are declared as `iconRef` strings using the prefix-dispatch
 * contract resolved by `<NodeIcon>`:
 *   - `lobehub:<brand>` → React component from @lobehub/icons
 *   - `asset:<key>`     → SVG via the filesystem registry
 *   - emoji / text      → rendered as-is
 * Colors are theme token keys, resolved at render by the consumer.
 * Status rows are pure data — theme colors are resolved in StatusCard.
 */

import { AI_PROVIDER_META } from '../icons/AIProviderIcons';
import type { ProviderConfig, CategoryGroup } from './types';

// ============================================================================
// AI PROVIDERS — derived from centralized AI_PROVIDER_META
// ============================================================================

const AI_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-...', anthropic: 'sk-ant-...', gemini: 'AIza...',
  groq: 'gsk_...', cerebras: 'csk-...', openrouter: 'sk-or-...',
  deepseek: 'sk-...', kimi: 'sk-...', mistral: 'sk-...',
};

const aiProviders: ProviderConfig[] = Object.entries(AI_PROVIDER_META).map(([id, meta]) => ({
  id, name: meta.label, category: 'ai', categoryLabel: 'AI Providers',
  color: meta.color, kind: 'apiKey' as const, iconRef: meta.iconRef, hasDefaults: true,
  fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: AI_PLACEHOLDERS[id], required: true }],
}));

// ============================================================================
// ALL PROVIDERS — flat array. Categories derived below.
// ============================================================================

export const PROVIDERS: ProviderConfig[] = [
  ...aiProviders,

  // ── Social: WhatsApp (QR pairing) ────────────────────────────────────
  {
    id: 'whatsapp_personal', name: 'WhatsApp Personal',
    category: 'social', categoryLabel: 'Social Media',
    color: 'categoryWhatsapp', kind: 'qrPairing', iconRef: 'asset:whatsapp',
    statusHook: 'whatsapp', hasRateLimits: true,
    statusRows: [
      { label: 'Status',  ok: s => !!s?.connected,   trueText: 'Connected', falseText: 'Disconnected' },
      { label: 'Session', ok: s => !!s?.has_session, trueText: 'Active',    falseText: 'Inactive' },
      { label: 'Service', ok: s => !!s?.running,     trueText: 'Running',   falseText: 'Stopped' },
    ],
    actions: [
      { key: 'start',   label: 'Start',   intent: 'run' },
      { key: 'restart', label: 'Restart', intent: 'config' },
      { key: 'refresh', label: 'Refresh', intent: 'save' },
    ],
    qr: {
      qrField: 'qr',
      isConnected: s => !!s?.connected,
      connectedTitle: 'Already Connected!',
      connectedSubtitle: () => 'No QR code needed',
      isLoading: s => !!(s?.running && !s?.qr && !s?.connected),
      emptyText: s => s?.running ? 'Waiting for QR code...' : 'Start service to get QR code',
      scanText: 'Scan with WhatsApp mobile app',
    },
  },

  // ── Social: Twitter/X (OAuth) ────────────────────────────────────────
  {
    id: 'twitter', name: 'Twitter/X',
    category: 'social', categoryLabel: 'Social Media',
    color: 'categoryTrigger', kind: 'oauth', iconRef: 'asset:x',
    statusHook: 'twitter', usageService: 'twitter',
    ws: { login: 'twitter_oauth_login', logout: 'twitter_logout', status: 'twitter_oauth_status' },
    fields: [
      { key: 'twitter_client_id', label: 'Client ID', placeholder: 'Client ID (from X Developer Portal)', required: true },
      { key: 'twitter_client_secret', label: 'Client Secret', secret: true, placeholder: 'Client Secret (optional for PKCE)' },
    ],
    callbackUrl: 'http://localhost:3010/api/twitter/callback',
    instructions: 'Get credentials from the X Developer Portal. Create an app with OAuth 2.0 enabled.',
  },

  // ── Social: Telegram Bot (OAuth-like token flow) ─────────────────────
  {
    id: 'telegram', name: 'Telegram Bot',
    category: 'social', categoryLabel: 'Social Media',
    color: 'categoryChat', kind: 'oauth', iconRef: 'asset:telegram', statusHook: 'telegram',
    ws: { login: 'telegram_connect', logout: 'telegram_disconnect', status: 'telegram_status' },
    fields: [{ key: 'telegram_bot_token', label: 'Bot Token', secret: true, placeholder: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ', required: true }],
    instructions: 'Get a bot token from @BotFather on Telegram. After connecting, send any message to your bot to register as the owner.',
  },

  // ── Productivity: Google Workspace (OAuth) ───────────────────────────
  {
    id: 'gmail', name: 'Google Workspace',
    category: 'productivity', categoryLabel: 'Productivity',
    color: 'categoryAI', kind: 'oauth', iconRef: 'asset:gmail',
    statusHook: 'google', usageService: 'google_workspace',
    ws: { login: 'google_oauth_login', logout: 'google_logout', status: 'google_oauth_status' },
    fields: [
      { key: 'google_client_id', label: 'Client ID', placeholder: 'Client ID (from Google Cloud Console)', required: true },
      { key: 'google_client_secret', label: 'Client Secret', secret: true, placeholder: 'Client Secret (required)', required: true },
    ],
    callbackUrl: 'http://localhost:3010/api/google/callback',
    instructions: 'Get credentials from Google Cloud Console. Enable Gmail, Calendar, Drive, Sheets, Tasks, and People APIs.',
  },

  // ── Email (Himalaya IMAP/SMTP) ───────────────────────────────────────
  {
    id: 'email_himalaya', name: 'Email (IMAP/SMTP)',
    category: 'email', categoryLabel: 'Email',
    color: 'categoryChat', kind: 'email', iconRef: 'asset:read',
  },

  // ── Android Device (QR pairing) ──────────────────────────────────────
  {
    id: 'android_remote', name: 'Android Device',
    category: 'android', categoryLabel: 'Android',
    color: 'categoryAndroid', kind: 'qrPairing', iconRef: '📱',
    statusHook: 'android',
    fields: [{ key: 'android_remote', label: 'API Key', secret: true, placeholder: 'Enter Android Relay API key...', required: true }],
    statusRows: [
      { label: 'Device',  ok: s => !!s?.paired,    trueText: 'Paired',    falseText: 'Not Paired' },
      { label: 'Relay',   ok: s => !!s?.connected, trueText: 'Connected', falseText: 'Disconnected' },
      { label: 'Pairing', ok: s => !!s?.paired,    trueText: 'Paired',    falseText: 'Waiting', warn: true },
    ],
    actions: [
      { key: 'connect',    label: 'Connect',    intent: 'save',
        disabled: (s, stored) => !!s?.paired || !stored },
      { key: 'disconnect', label: 'Disconnect', intent: 'stop',
        disabled: s => !s?.connected },
    ],
    qr: {
      qrField: 'qr_data',
      isConnected: s => !!s?.paired,
      connectedTitle: 'Device Paired!',
      connectedSubtitle: s => s?.device_name || 'Android Device',
      isLoading: s => !!(s?.connected && !s?.qr_data && !s?.paired),
      emptyText: (s, stored) => !stored ? 'Add API key first' : (s?.connected ? 'Waiting for QR code...' : 'Click Connect to start'),
      scanText: 'Scan with Android companion app',
    },
  },

  // ── Search ───────────────────────────────────────────────────────────
  { id: 'brave_search', name: 'Brave Search', category: 'search', categoryLabel: 'Search',
    color: 'categoryLocation', kind: 'apiKey', iconRef: 'asset:brave',
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'BSA...', required: true }] },
  { id: 'perplexity', name: 'Perplexity', category: 'search', categoryLabel: 'Search',
    color: 'categoryUtil', kind: 'apiKey', iconRef: 'asset:perplexity',
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'pplx-...', required: true }] },

  // ── Scrapers ─────────────────────────────────────────────────────────
  { id: 'apify', name: 'Apify', category: 'scrapers', categoryLabel: 'Scrapers',
    color: 'categoryAI', kind: 'apiKey', iconRef: 'asset:apify', validateAs: 'apify',
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'apify_api_...', required: true }] },
  { id: 'serper', name: 'Serper', category: 'scrapers', categoryLabel: 'Scrapers',
    color: 'categoryAI', kind: 'apiKey', iconRef: 'asset:google',
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, required: true }] },

  // ── Services ─────────────────────────────────────────────────────────
  { id: 'google_maps', name: 'Google Maps', category: 'services', categoryLabel: 'Services',
    color: 'categoryLocation', kind: 'apiKey', iconRef: '🗺️',
    validateAs: 'google_maps', usageService: 'google_maps',
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'AIza...', required: true }] },
];

// ============================================================================
// CATEGORIES — derived from PROVIDERS, preserving insertion order
// ============================================================================

export const CATEGORIES: CategoryGroup[] = (() => {
  const map = new Map<string, CategoryGroup>();
  for (const p of PROVIDERS) {
    let cat = map.get(p.category);
    if (!cat) { cat = { key: p.category, label: p.categoryLabel, items: [] }; map.set(p.category, cat); }
    cat.items.push(p);
  }
  return Array.from(map.values());
})();
