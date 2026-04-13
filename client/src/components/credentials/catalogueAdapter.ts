/**
 * Catalogue adapter — server JSON → runtime ProviderConfig.
 *
 * The credential registry JSON on the server (see
 * `server/config/credential_providers.json`) cannot contain React
 * components or function callbacks. It uses string field refs like
 * `ok_field: "connected"` and `icon_ref: "raw_svg:SearchIcons.brave"`.
 *
 * This module hydrates that declarative JSON into the React-coupled
 * `ProviderConfig` shape that `panels/`, `primitives/`, and
 * `PanelRenderer.tsx` already consume — so the existing panel code is
 * unchanged and the migration is additive.
 *
 * Icon factories and asset module imports deliberately mirror
 * `providers.tsx` so that rehydrated providers render byte-identically
 * to the current client-owned registry. When `providers.tsx` is deleted
 * in Phase 8, this module becomes the canonical resolver.
 */

import React from 'react';

import { AI_PROVIDER_META } from '../icons/AIProviderIcons';
import { APIFY_ICON } from '../../assets/icons/apify';
import { BRAVE_SEARCH_ICON, SERPER_ICON, PERPLEXITY_ICON } from '../../assets/icons/search';
import { TELEGRAM_ICON } from '../../assets/icons/telegram';
import { GMAIL_ICON } from '../../assets/icons/google';
import { EMAIL_READ_ICON } from '../../assets/icons/email';
import { WHATSAPP_CONNECT_ICON } from '../../nodeDefinitions/whatsappNodes';
import { TWITTER_ICON } from '../../nodeDefinitions/twitterNodes';

import type {
  ProviderConfig,
  CategoryGroup,
  PanelKind,
  FieldDef,
  StatusRowDef,
  ActionDef,
  QrPairingDef,
} from './types';
import type {
  ServerProviderConfig,
  ServerCategory,
  ServerFieldDef,
  ServerStatusRowDef,
  ServerActionDef,
  ServerQrDef,
  CatalogueResponse,
} from '../../hooks/useCatalogueQuery';

// ============================================================================
// Icon factories — uses <img> with data URIs (the project standard from
// assets/icons/*/index.ts). No innerHTML, no dangerouslySetInnerHTML,
// no ref+useEffect. Every icon module already exports svgToDataUri'd
// constants; we import those directly and render as <img>.
// ============================================================================

interface IconProps {
  size: number;
}

/** Render a data:image/svg+xml URI as a sized <img>. Project standard. */
const fromDataUri = (dataUri: string): React.FC<IconProps> => {
  const Comp: React.FC<IconProps> = ({ size }) =>
    React.createElement('img', {
      src: dataUri,
      width: size,
      height: size,
      alt: '',
      style: { display: 'block' },
    });
  return Comp;
};

const fromEmoji = (emoji: string): React.FC<IconProps> => {
  const Comp: React.FC<IconProps> = ({ size }) =>
    React.createElement(
      'span',
      { style: { fontSize: size, lineHeight: 1, display: 'inline-block' } },
      emoji,
    );
  return Comp;
};

// ============================================================================
// Icon ref resolver
//
// JSON `icon_ref` values use a small DSL:
//   "ai:openai"                       → AI_PROVIDER_META[openai].Icon (@lobehub/icons)
//   "raw_svg:SearchIcons.brave"       → <img> with pre-exported data URI (BRAVE_SEARCH_ICON)
//   "data_uri:WHATSAPP_CONNECT_ICON"  → <img> with data URI
//   "emoji:📱"                         → <span> with emoji text
// ============================================================================

/** Map "Module.key" strings to already-converted data URIs from assets/icons/. */
const RAW_SVG_DATA_URIS: Record<string, Record<string, string>> = {
  SearchIcons: { brave: BRAVE_SEARCH_ICON, serper: SERPER_ICON, perplexity: PERPLEXITY_ICON },
  TelegramIcons: { telegram: TELEGRAM_ICON },
  GoogleIcons: { gmail: GMAIL_ICON },
  EmailIcons: { read: EMAIL_READ_ICON },
  ApifyIcons: { apify: APIFY_ICON },
};

const DATA_URI_REGISTRY: Record<string, string> = {
  WHATSAPP_CONNECT_ICON,
  TWITTER_ICON,
};

// Fallback for providers whose icon_ref cannot be resolved — renders a
// circle with the provider initial, so the palette never shows nothing.
const fallbackIcon = (initial: string): React.FC<IconProps> => {
  const Comp: React.FC<IconProps> = ({ size }) =>
    React.createElement(
      'div',
      {
        style: {
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(128,128,128,0.2)',
          color: 'currentColor',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(10, size * 0.55),
          fontWeight: 600,
        },
      },
      initial,
    );
  return Comp;
};

function resolveIcon(iconRef: string | undefined, providerId: string): React.FC<IconProps> {
  const initial = (providerId[0] ?? '?').toUpperCase();
  if (!iconRef) return fallbackIcon(initial);

  const colon = iconRef.indexOf(':');
  if (colon < 0) return fallbackIcon(initial);

  const kind = iconRef.slice(0, colon);
  const rest = iconRef.slice(colon + 1);

  switch (kind) {
    case 'ai': {
      const meta = AI_PROVIDER_META[rest];
      return meta?.Icon ?? fallbackIcon(initial);
    }
    case 'raw_svg': {
      // e.g. "SearchIcons.brave" → look up pre-exported data URI
      const [module, key] = rest.split('.');
      const uri = RAW_SVG_DATA_URIS[module]?.[key];
      return uri ? fromDataUri(uri) : fallbackIcon(initial);
    }
    case 'data_uri': {
      const uri = DATA_URI_REGISTRY[rest];
      return uri ? fromDataUri(uri) : fallbackIcon(initial);
    }
    case 'emoji':
      return fromEmoji(rest);
    default:
      return fallbackIcon(initial);
  }
}

// ============================================================================
// Status-row / action / QR rehydrators
//
// Server JSON uses string field refs + the `!` prefix for negation. We
// compile these into closures so panels can call them directly without
// knowing about the wire format.
// ============================================================================

/** Evaluate a single field reference with optional `!` negation. */
function evalRef(status: unknown, field: string): boolean {
  if (typeof field !== 'string' || field.length === 0) return false;
  const negate = field.startsWith('!');
  const key = negate ? field.slice(1) : field;
  const val = status && typeof status === 'object' ? (status as Record<string, unknown>)[key] : undefined;
  const truthy = !!val;
  return negate ? !truthy : truthy;
}

function buildStatusRows(defs: ServerStatusRowDef[] | undefined): StatusRowDef[] | undefined {
  if (!defs || defs.length === 0) return undefined;
  return defs.map((d) => ({
    label: d.label,
    ok: (status: unknown) => evalRef(status, d.ok_field),
    trueText: d.true_text,
    falseText: d.false_text,
    warn: d.warn,
  }));
}

function buildActions(defs: ServerActionDef[] | undefined): ActionDef[] | undefined {
  if (!defs || defs.length === 0) return undefined;
  return defs.map((d) => {
    let disabled: ActionDef['disabled'] = undefined;
    if (d.disabled_when && d.disabled_when.length > 0) {
      // `disabled_when: ["paired", "!stored"]` means disabled if
      // status.paired is truthy OR stored is falsy.
      disabled = (status, stored) =>
        d.disabled_when!.some((ref) => {
          if (ref === 'stored') return !!stored;
          if (ref === '!stored') return !stored;
          return evalRef(status, ref);
        });
    }
    return {
      key: d.key,
      label: d.label,
      themeColor: d.theme_color,
      disabled,
    };
  });
}

function buildQr(def: ServerQrDef | undefined): QrPairingDef | undefined {
  if (!def) return undefined;
  const isConnected = (status: unknown) => evalRef(status, def.is_connected_field);
  const isLoading = (status: unknown) =>
    (def.is_loading_fields ?? []).every((f) => evalRef(status, f));
  const connectedSubtitle = (status: unknown): string => {
    if (def.connected_subtitle_static) return def.connected_subtitle_static;
    if (def.connected_subtitle_field) {
      const val =
        status && typeof status === 'object'
          ? (status as Record<string, unknown>)[def.connected_subtitle_field]
          : undefined;
      if (typeof val === 'string' && val.length > 0) return val;
    }
    return def.connected_subtitle_fallback ?? '';
  };
  const emptyText = (status: unknown, stored: boolean): string => {
    if (!stored && def.empty_text_no_key) return def.empty_text_no_key;
    const running = evalRef(status, 'running') || evalRef(status, 'connected');
    if (running && def.empty_text_running) return def.empty_text_running;
    return def.empty_text_stopped ?? '';
  };
  return {
    qrField: def.qr_field,
    isConnected,
    connectedTitle: def.connected_title,
    connectedSubtitle,
    isLoading,
    emptyText,
    scanText: def.scan_text,
  };
}

function buildFields(defs: ServerFieldDef[] | undefined): FieldDef[] | undefined {
  if (!defs || defs.length === 0) return undefined;
  return defs.map((d) => ({
    key: d.key,
    label: d.label ?? d.key,
    secret: d.secret ?? d.type === 'password',
    placeholder: d.placeholder,
    required: d.required,
  }));
}

// ============================================================================
// Public API
// ============================================================================

/** Rehydrate one server provider entry into the runtime ProviderConfig. */
export function rehydrateProvider(entry: ServerProviderConfig): ProviderConfig {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    categoryLabel: entry.category_label,
    color: entry.color,
    kind: entry.kind as PanelKind,
    icon: resolveIcon(entry.icon_ref, entry.id),
    fields: buildFields(entry.fields),
    ws: entry.ws,
    statusHook: entry.status_hook,
    statusRows: buildStatusRows(entry.status_rows),
    actions: buildActions(entry.actions),
    qr: buildQr(entry.qr),
    validateAs: entry.validate_as,
    callbackUrl: entry.callback_url,
    instructions: entry.instructions,
    hasDefaults: entry.has_defaults,
    hasRateLimits: entry.has_rate_limits,
    usageService: entry.usage_service,
    stored: entry.stored,
  };
}

/**
 * Rehydrate the full catalogue payload.
 *
 * Returns `{ providers, categories }` in the exact same shape the existing
 * `providers.tsx` module exports, so `CredentialsModal` can swap its data
 * source without any other change.
 */
export function rehydrateCatalogue(payload: CatalogueResponse): {
  providers: ProviderConfig[];
  categories: CategoryGroup[];
} {
  const providers = payload.providers.map(rehydrateProvider);

  // Build ordered categories from the server-declared order, then fill
  // items in provider insertion order (matches the current pattern in
  // providers.tsx).
  const byCategory = new Map<string, CategoryGroup>();
  for (const cat of payload.categories as ServerCategory[]) {
    byCategory.set(cat.key, { key: cat.key, label: cat.label, items: [] });
  }
  for (const p of providers) {
    let group = byCategory.get(p.category);
    if (!group) {
      // A provider referenced an unknown category — fall back to the
      // provider-declared categoryLabel so nothing gets dropped.
      group = { key: p.category, label: p.categoryLabel, items: [] };
      byCategory.set(p.category, group);
    }
    group.items.push(p);
  }

  // Strip empty categories so the palette doesn't render empty headers.
  const categories = Array.from(byCategory.values()).filter((c) => c.items.length > 0);
  return { providers, categories };
}
