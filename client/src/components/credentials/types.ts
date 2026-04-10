/**
 * Credential system types.
 * Every provider is described by a single ProviderConfig object.
 * ALL conditional logic lives in config — panel components are pure renderers.
 */

import type { FC } from 'react';

// ============================================================================
// Panel kinds — one renderer branch per kind
// ============================================================================

export type PanelKind = 'apiKey' | 'oauth' | 'qrPairing' | 'email';

// ============================================================================
// Field schema — drives antd Form.Item rendering via FieldRenderer
// ============================================================================

export interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  required?: boolean;
}

// ============================================================================
// Status row — drives StatusCard rendering from data
// ============================================================================

export interface StatusRowDef {
  label: string;
  /** Extract boolean from status object. StatusCard handles themed Tag rendering. */
  ok: (status: any) => boolean;
  trueText: string;
  falseText: string;
  /** Use warning color instead of error when not ok. */
  warn?: boolean;
}

// ============================================================================
// Action — drives ActionBar rendering from data
// ============================================================================

export interface ActionDef {
  key: string;
  label: string;
  /** Theme color key (e.g., 'green', 'pink', 'cyan', 'orange'). Resolved at render. */
  themeColor: string;
  /** Return true to hide this action. */
  hidden?: (status: any, stored: boolean) => boolean;
  /** Return true to disable this action. */
  disabled?: (status: any, stored: boolean) => boolean;
}

// ============================================================================
// QR pairing config — everything WhatsApp/Android-specific lives here
// ============================================================================

export interface QrPairingDef {
  /** Path to QR data in status object. */
  qrField: string;
  /** Check if device is connected/paired. */
  isConnected: (status: any) => boolean;
  connectedTitle: string;
  connectedSubtitle: (status: any) => string;
  /** Loading state for QR display. */
  isLoading: (status: any) => boolean;
  /** Empty text when no QR available. */
  emptyText: (status: any, stored: boolean) => string;
  scanText: string;
}

// ============================================================================
// Provider config — the ONLY thing you add to register a new provider
// ============================================================================

export interface ProviderConfig {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  /** Theme color key (resolved via theme.colors[color] at render). */
  color: string;
  kind: PanelKind;
  icon: FC<{ size: number }>;

  /** Credential input fields. */
  fields?: FieldDef[];
  /** WebSocket commands for OAuth flows. */
  ws?: { login: string; logout: string; status: string };
  /** Which status hook to read. */
  statusHook?: 'whatsapp' | 'android' | 'twitter' | 'google' | 'telegram';
  /** Config-driven status rows (replaces per-provider conditionals). */
  statusRows?: StatusRowDef[];
  /** Config-driven actions (replaces per-provider handler code). */
  actions?: ActionDef[];
  /** QR pairing config (replaces isWhatsApp/isAndroid conditionals). */
  qr?: QrPairingDef;

  /** Non-standard validation type ('google_maps' | 'apify'). */
  validateAs?: string;
  /** OAuth callback URL shown as help text. */
  callbackUrl?: string;
  /** Help text shown under OAuth credential fields. */
  instructions?: string;
  /** Show AI provider defaults section (model, temperature, thinking). */
  hasDefaults?: boolean;
  /** Show WhatsApp rate limit configuration section. */
  hasRateLimits?: boolean;
  /** Service key for API cost tracking section (twitter, google_workspace, google_maps). */
  usageService?: string;
}

// ============================================================================
// Category — derived from providers, not declared separately
// ============================================================================

export interface CategoryGroup {
  key: string;
  label: string;
  items: ProviderConfig[];
}
