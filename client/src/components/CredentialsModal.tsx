/**
 * CredentialsModal - Two-panel credentials management
 * Left: Category list with items
 * Right: Detail/configuration panel for selected item (including QR pairing)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Alert, Descriptions, Space, InputNumber, Switch } from 'antd';
import {
  CheckCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import Modal from './ui/Modal';
import QRCodeDisplay from './ui/QRCodeDisplay';
import ApiKeyInput from './ui/ApiKeyInput';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWhatsAppStatus, useAndroidStatus, useWebSocket, RateLimitConfig, RateLimitStats } from '../contexts/WebSocketContext';
import { useWhatsApp } from '../hooks/useWhatsApp';
import {
  OpenAIIcon, ClaudeIcon, GeminiIcon, GroqIcon, OpenRouterIcon, CerebrasIcon,
} from './icons/AIProviderIcons';

// ============================================================================
// SERVICE ICONS
// ============================================================================

const GoogleMapsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
    <circle cx="12" cy="9" r="2.5" fill="#fff"/>
  </svg>
);

const AndroidIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#3DDC84">
    <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// ============================================================================
// TYPES & DATA
// ============================================================================

interface CredentialItem {
  id: string;
  name: string;
  placeholder: string;
  color: string;
  desc: string;
  Icon?: React.FC<{ size?: number }>;
  CustomIcon?: React.FC;
  isSpecial?: boolean;
  panelType?: 'whatsapp' | 'android';
}

interface Category {
  key: string;
  label: string;
  items: CredentialItem[];
}

const CATEGORIES: Category[] = [
  {
    key: 'ai',
    label: 'AI Providers',
    items: [
      { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', color: '#10a37f', desc: 'GPT-4o, GPT-4, GPT-3.5', Icon: OpenAIIcon },
      { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...', color: '#d97706', desc: 'Claude 3.5 Sonnet, Opus', Icon: ClaudeIcon },
      { id: 'gemini', name: 'Gemini', placeholder: 'AIza...', color: '#4285f4', desc: 'Gemini 2.0, 1.5 Pro/Flash', Icon: GeminiIcon },
      { id: 'groq', name: 'Groq', placeholder: 'gsk_...', color: '#F55036', desc: 'Llama, Mixtral - Ultra-fast', Icon: GroqIcon },
      { id: 'cerebras', name: 'Cerebras', placeholder: 'csk-...', color: '#FF6600', desc: 'Llama, Qwen - Ultra-fast', Icon: CerebrasIcon },
      { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...', color: '#6366f1', desc: 'Unified API - 200+ models', Icon: OpenRouterIcon },
    ],
  },
  {
    key: 'social',
    label: 'Social Media',
    items: [
      { id: 'whatsapp_personal', name: 'WhatsApp Personal', placeholder: '', color: '#25D366', desc: 'Connect via QR code pairing', CustomIcon: WhatsAppIcon, isSpecial: true, panelType: 'whatsapp' },
    ],
  },
  {
    key: 'android',
    label: 'Android',
    items: [
      { id: 'android_remote', name: 'Android Device', placeholder: 'your-api-key...', color: '#3DDC84', desc: 'API key + QR code pairing', CustomIcon: AndroidIcon, isSpecial: true, panelType: 'android' },
    ],
  },
  {
    key: 'services',
    label: 'Services',
    items: [
      { id: 'google_maps', name: 'Google Maps', placeholder: 'AIza...', color: '#EA4335', desc: 'Geocoding, Places, Directions', CustomIcon: GoogleMapsIcon },
    ],
  },
];


// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CredentialsModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useAppTheme();
  const { validateApiKey, saveApiKey, getStoredApiKey, hasStoredKey, removeApiKey, validateGoogleMapsKey } = useApiKeys();
  const whatsappStatus = useWhatsAppStatus();
  const androidStatus = useAndroidStatus();

  // Tag style helper - consistent theming for status tags
  const getTagStyle = (type: 'success' | 'error' | 'warning'): React.CSSProperties => {
    const color = type === 'success' ? theme.dracula.green
      : type === 'error' ? theme.dracula.pink
      : theme.dracula.orange;
    return {
      backgroundColor: `${color}25`,
      borderColor: `${color}60`,
      color: color,
    };
  };

  const [validKeys, setValidKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [selectedItem, setSelectedItem] = useState<CredentialItem | null>(null);

  // Load stored keys
  const loadKeys = useCallback(async () => {
    const allItems = CATEGORIES.flatMap(c => c.items);
    const newKeys: Record<string, string> = {};
    const newValid: Record<string, boolean> = {};

    for (const item of allItems) {
      if (item.isSpecial) continue;
      if (await hasStoredKey(item.id)) {
        const key = await getStoredApiKey(item.id);
        if (key) {
          newKeys[item.id] = key;
          newValid[item.id] = true;
        }
      }
    }
    setKeys(newKeys);
    setValidKeys(newValid);
  }, [hasStoredKey, getStoredApiKey]);

  useEffect(() => {
    if (visible) {
      loadKeys();
      // Select first item by default
      const firstItem = CATEGORIES[0]?.items[0];
      if (firstItem) setSelectedItem(firstItem);
    }
  }, [visible, loadKeys]);

  const handleValidate = async (id: string) => {
    const key = keys[id];
    if (!key?.trim()) return;

    setLoading(l => ({ ...l, [id]: true }));
    const result = id === 'google_maps'
      ? await validateGoogleMapsKey(key)
      : id === 'android_remote'
        ? await saveApiKey(id, key)
        : await validateApiKey(id, key);
    setLoading(l => ({ ...l, [id]: false }));

    if (result.isValid) {
      setValidKeys(v => ({ ...v, [id]: true }));
      if (result.models) setModels(m => ({ ...m, [id]: result.models! }));
    }
  };

  const handleRemove = async (id: string) => {
    await removeApiKey(id);
    setKeys(k => ({ ...k, [id]: '' }));
    setValidKeys(v => ({ ...v, [id]: false }));
    setModels(m => ({ ...m, [id]: [] }));
  };

  // Get status for special items
  const getSpecialStatus = (item: CredentialItem) => {
    if (item.panelType === 'whatsapp') {
      return { connected: whatsappStatus.connected, label: whatsappStatus.connected ? 'Connected' : 'Not Connected' };
    }
    if (item.panelType === 'android') {
      return { connected: androidStatus.paired, label: androidStatus.paired ? 'Paired' : 'Not Paired' };
    }
    return null;
  };

  // Count configured items
  const totalConfigured = Object.values(validKeys).filter(Boolean).length;

  // Header actions
  const headerActions = (
    <div style={{
      display: 'flex',
      gap: theme.spacing.lg,
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        fontSize: theme.fontSize.base,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.text,
      }}>
        <SafetyOutlined style={{ fontSize: 18, color: theme.dracula.yellow }} />
        <span>API Credentials</span>
      </div>
      <Tag
        style={{
          margin: 0,
          fontSize: theme.fontSize.xs,
          ...(totalConfigured > 0 ? getTagStyle('success') : {}),
        }}
      >
        {totalConfigured} configured
      </Tag>
    </div>
  );

  // Render left sidebar item
  const renderSidebarItem = (item: CredentialItem) => {
    const isSelected = selectedItem?.id === item.id;
    const isValid = validKeys[item.id];
    const specialStatus = item.isSpecial ? getSpecialStatus(item) : null;
    const Icon = item.Icon;
    const CustomIcon = item.CustomIcon;

    return (
      <div
        key={item.id}
        onClick={() => setSelectedItem(item)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: `${theme.spacing.md} ${theme.spacing.lg}`,
          cursor: 'pointer',
          backgroundColor: isSelected ? `${item.color}15` : 'transparent',
          borderLeft: isSelected ? `3px solid ${item.color}` : '3px solid transparent',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {/* Icon */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: theme.borderRadius.md,
          backgroundColor: `${item.color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {CustomIcon ? <CustomIcon /> : Icon ? <Icon size={18} /> : null}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
        </div>

        {/* Status dot */}
        {(isValid || specialStatus?.connected) && (
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: theme.dracula.green,
            flexShrink: 0,
          }} />
        )}
      </div>
    );
  };

  // WhatsApp actions
  const { getStatus: getWhatsAppStatus, startConnection, restartConnection } = useWhatsApp();
  const { sendRequest, getWhatsAppRateLimitConfig, setWhatsAppRateLimitConfig, unpauseWhatsAppRateLimit } = useWebSocket();

  // Android state
  const [androidApiKey, setAndroidApiKey] = useState('');
  const [androidApiKeyStored, setAndroidApiKeyStored] = useState<boolean | null>(null);
  const [androidLoading, setAndroidLoading] = useState<string | null>(null);
  const [androidError, setAndroidError] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Rate limit state
  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [rateLimitStats, setRateLimitStats] = useState<RateLimitStats | null>(null);
  const [rateLimitExpanded, setRateLimitExpanded] = useState(false);
  const [rateLimitLoading, setRateLimitLoading] = useState(false);
  const [rateLimitDirty, setRateLimitDirty] = useState(false);

  // Load Android API key on mount
  useEffect(() => {
    if (visible) {
      hasStoredKey('android_remote').then(async (has) => {
        setAndroidApiKeyStored(has);
        if (has) {
          const key = await getStoredApiKey('android_remote');
          if (key) setAndroidApiKey(key);
        }
      });
    }
  }, [visible, hasStoredKey, getStoredApiKey]);

  // Android handlers
  const handleAndroidSaveKey = async () => {
    if (!androidApiKey.trim()) return;
    setAndroidLoading('save');
    try {
      await saveApiKey('android_remote', androidApiKey);
      setAndroidApiKeyStored(true);
    } catch (err: any) {
      setAndroidError(err.message || 'Failed to save API key');
    } finally {
      setAndroidLoading(null);
    }
  };

  const handleAndroidConnect = async () => {
    setAndroidLoading('connect');
    setAndroidError(null);
    try {
      const key = await getStoredApiKey('android_remote');
      if (!key) {
        setAndroidError('No API key configured');
        setAndroidLoading(null);
        return;
      }
      const response = await sendRequest('android_relay_connect', {
        url: import.meta.env.VITE_ANDROID_RELAY_URL || '',
        api_key: key,
      });
      if (!response.success) {
        setAndroidError(response.error || 'Failed to connect');
      }
    } catch (err: any) {
      setAndroidError(err.message || 'Failed to connect');
    } finally {
      setAndroidLoading(null);
    }
  };

  const handleAndroidDisconnect = async () => {
    setAndroidLoading('disconnect');
    setAndroidError(null);
    try {
      const response = await sendRequest('android_relay_disconnect', {});
      if (!response.success) {
        setAndroidError(response.error || 'Failed to disconnect');
      }
    } catch (err: any) {
      setAndroidError(err.message || 'Failed to disconnect');
    } finally {
      setAndroidLoading(null);
    }
  };

  // WhatsApp handlers
  const handleWhatsAppStart = async () => {
    setWhatsappLoading('start');
    setWhatsappError(null);
    try {
      const result = await startConnection();
      if (!result.success && result.message) {
        setWhatsappError(result.message);
      }
    } catch (err: any) {
      setWhatsappError(err.message || 'Failed to start');
    } finally {
      setWhatsappLoading(null);
    }
  };

  const handleWhatsAppRestart = async () => {
    setWhatsappLoading('restart');
    setWhatsappError(null);
    try {
      const result = await restartConnection();
      if (!result.success && result.message) {
        setWhatsappError(result.message);
      }
    } catch (err: any) {
      setWhatsappError(err.message || 'Failed to restart');
    } finally {
      setWhatsappLoading(null);
    }
  };

  const handleWhatsAppRefresh = async () => {
    setWhatsappLoading('refresh');
    setWhatsappError(null);
    try {
      await getWhatsAppStatus();
    } catch (err: any) {
      setWhatsappError(err.message || 'Failed to refresh');
    } finally {
      setWhatsappLoading(null);
    }
  };

  // Rate limit handlers
  const loadRateLimits = useCallback(async () => {
    setRateLimitLoading(true);
    try {
      const result = await getWhatsAppRateLimitConfig();
      if (result.success) {
        setRateLimitConfig(result.config || null);
        setRateLimitStats(result.stats || null);
        setRateLimitDirty(false);
      }
    } catch (err) {
      console.error('Failed to load rate limits:', err);
    } finally {
      setRateLimitLoading(false);
    }
  }, [getWhatsAppRateLimitConfig]);

  const handleRateLimitSave = async () => {
    if (!rateLimitConfig) return;
    setRateLimitLoading(true);
    try {
      const result = await setWhatsAppRateLimitConfig(rateLimitConfig);
      if (result.success && result.config) {
        setRateLimitConfig(result.config);
        setRateLimitDirty(false);
      }
    } catch (err) {
      console.error('Failed to save rate limits:', err);
    } finally {
      setRateLimitLoading(false);
    }
  };

  const handleRateLimitUnpause = async () => {
    setRateLimitLoading(true);
    try {
      const result = await unpauseWhatsAppRateLimit();
      if (result.success && result.stats) {
        setRateLimitStats(result.stats);
      }
    } catch (err) {
      console.error('Failed to unpause rate limit:', err);
    } finally {
      setRateLimitLoading(false);
    }
  };

  const updateRateLimitConfig = (key: keyof RateLimitConfig, value: any) => {
    if (!rateLimitConfig) return;
    setRateLimitConfig({ ...rateLimitConfig, [key]: value });
    setRateLimitDirty(true);
  };

  // Load rate limits when WhatsApp panel is selected and connected
  useEffect(() => {
    if (selectedItem?.panelType === 'whatsapp' && whatsappStatus.connected && rateLimitExpanded) {
      loadRateLimits();
    }
  }, [selectedItem, whatsappStatus.connected, rateLimitExpanded, loadRateLimits]);

  // Render detail panel for selected item
  const renderDetailPanel = () => {
    if (!selectedItem) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.textMuted,
          fontSize: theme.fontSize.sm,
        }}>
          Select a credential to configure
        </div>
      );
    }

    // WhatsApp panel
    if (selectedItem.panelType === 'whatsapp') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Scrollable content area */}
          <div style={{ flex: 1, overflow: 'auto', padding: theme.spacing.xl }}>
            <Descriptions
              title={<Space><WhatsAppIcon /> WhatsApp Personal</Space>}
              bordered
              column={1}
              size="small"
              style={{
                marginBottom: theme.spacing.lg,
                background: theme.colors.backgroundAlt,
                borderRadius: theme.borderRadius.md,
              }}
              styles={{
                label: {
                  backgroundColor: theme.colors.backgroundPanel,
                  color: theme.colors.textSecondary,
                  fontWeight: theme.fontWeight.medium,
                },
                content: {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                },
              }}
            >
              <Descriptions.Item label="Status">
                <Tag style={getTagStyle(whatsappStatus.connected ? 'success' : 'error')}>
                  {whatsappStatus.connected ? 'Connected' : 'Disconnected'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Session">
                <Tag style={getTagStyle(whatsappStatus.has_session ? 'success' : 'error')}>
                  {whatsappStatus.has_session ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Service">
                <Tag style={getTagStyle(whatsappStatus.running ? 'success' : 'error')}>
                  {whatsappStatus.running ? 'Running' : 'Stopped'}
                </Tag>
              </Descriptions.Item>
              {whatsappStatus.device_id && (
                <Descriptions.Item label="Device">
                  <span style={{ fontFamily: 'monospace', fontSize: theme.fontSize.xs }}>
                    {whatsappStatus.device_id.slice(0, 24)}...
                  </span>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* QR Code */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.backgroundAlt,
              borderRadius: theme.borderRadius.lg,
              marginBottom: theme.spacing.lg,
              padding: theme.spacing.xl,
            }}>
              <QRCodeDisplay
                value={whatsappStatus.qr}
                isConnected={whatsappStatus.connected}
                size={200}
                connectedTitle="Already Connected!"
                connectedSubtitle="No QR code needed"
                loading={whatsappStatus.running && !whatsappStatus.qr && !whatsappStatus.connected}
                emptyText={whatsappStatus.running ? 'Waiting for QR code...' : 'Start service to get QR code'}
              />
              {!whatsappStatus.connected && whatsappStatus.qr && (
                <div style={{ marginTop: theme.spacing.md, color: theme.colors.textSecondary, fontSize: theme.fontSize.sm }}>
                  Scan with WhatsApp mobile app
                </div>
              )}
            </div>

          {/* Rate Limits Section */}
          {whatsappStatus.connected && (
            <div style={{
              marginBottom: theme.spacing.lg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              overflow: 'hidden'
            }}>
              <div
                onClick={() => setRateLimitExpanded(!rateLimitExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.sm,
                  backgroundColor: theme.colors.backgroundAlt,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, color: theme.colors.text }}>
                  {rateLimitExpanded ? '▼' : '▶'} Rate Limits
                </span>
                <span onClick={(e) => e.stopPropagation()}>
                  <Switch
                    size="small"
                    checked={rateLimitConfig?.enabled ?? true}
                    onChange={(checked) => updateRateLimitConfig('enabled', checked)}
                  />
                </span>
              </div>
              {rateLimitExpanded && (
                <div style={{ padding: theme.spacing.md }}>
                  {rateLimitLoading && !rateLimitConfig ? (
                    <div style={{ textAlign: 'center', color: theme.colors.textSecondary, fontSize: theme.fontSize.sm }}>Loading...</div>
                  ) : rateLimitConfig ? (
                    <>
                      {/* Stats Section */}
                      {rateLimitStats && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: theme.spacing.sm,
                          marginBottom: theme.spacing.md,
                          padding: theme.spacing.sm,
                          backgroundColor: theme.colors.backgroundPanel,
                          borderRadius: theme.borderRadius.sm
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Last Minute</div>
                            <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{rateLimitStats.messages_sent_last_minute}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Last Hour</div>
                            <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{rateLimitStats.messages_sent_last_hour}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Today</div>
                            <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{rateLimitStats.messages_sent_today}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>New Contacts</div>
                            <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{rateLimitStats.new_contacts_today}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Responses</div>
                            <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{rateLimitStats.responses_received}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Response Rate</div>
                            <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{Math.round((rateLimitStats.response_rate || 0) * 100)}%</div>
                          </div>
                        </div>
                      )}
                      {rateLimitStats?.is_paused && (
                        <Alert type="warning" message={rateLimitStats.pause_reason || 'Paused'} action={<Button size="small" onClick={handleRateLimitUnpause}>Unpause</Button>} style={{ marginBottom: theme.spacing.md }} />
                      )}

                      {/* Delays Section */}
                      <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, fontWeight: theme.fontWeight.medium }}>
                        Message Delays (milliseconds)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Min Delay</div>
                          <InputNumber size="small" value={rateLimitConfig.min_delay_ms} onChange={(v) => updateRateLimitConfig('min_delay_ms', v ?? 3000)} style={{ width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Max Delay</div>
                          <InputNumber size="small" value={rateLimitConfig.max_delay_ms} onChange={(v) => updateRateLimitConfig('max_delay_ms', v ?? 8000)} style={{ width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Typing Duration</div>
                          <InputNumber size="small" value={rateLimitConfig.typing_delay_ms} onChange={(v) => updateRateLimitConfig('typing_delay_ms', v ?? 2000)} style={{ width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Link Extra Delay</div>
                          <InputNumber size="small" value={rateLimitConfig.link_extra_delay_ms} onChange={(v) => updateRateLimitConfig('link_extra_delay_ms', v ?? 5000)} style={{ width: '100%' }} />
                        </div>
                      </div>

                      {/* Limits Section */}
                      <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, fontWeight: theme.fontWeight.medium }}>
                        Message Limits
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Per Minute</div>
                          <InputNumber size="small" value={rateLimitConfig.max_messages_per_minute} onChange={(v) => updateRateLimitConfig('max_messages_per_minute', v ?? 10)} style={{ width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Per Hour</div>
                          <InputNumber size="small" value={rateLimitConfig.max_messages_per_hour} onChange={(v) => updateRateLimitConfig('max_messages_per_hour', v ?? 60)} style={{ width: '100%' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>New Contacts/Day</div>
                          <InputNumber size="small" value={rateLimitConfig.max_new_contacts_per_day} onChange={(v) => updateRateLimitConfig('max_new_contacts_per_day', v ?? 20)} style={{ width: '100%' }} />
                        </div>
                      </div>

                      {/* Behavior Section */}
                      <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, fontWeight: theme.fontWeight.medium }}>
                        Behavior
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text }}>Simulate Typing</div>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Show typing indicator before sending</div>
                          </div>
                          <Switch size="small" checked={rateLimitConfig.simulate_typing} onChange={(v) => updateRateLimitConfig('simulate_typing', v)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text }}>Randomize Delays</div>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Add variance between min/max delay</div>
                          </div>
                          <Switch size="small" checked={rateLimitConfig.randomize_delays} onChange={(v) => updateRateLimitConfig('randomize_delays', v)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.text }}>Pause on Low Response</div>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Auto-pause if response rate drops below threshold</div>
                          </div>
                          <Switch size="small" checked={rateLimitConfig.pause_on_low_response} onChange={(v) => updateRateLimitConfig('pause_on_low_response', v)} />
                        </div>
                        {rateLimitConfig.pause_on_low_response && (
                          <div>
                            <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Response Rate Threshold (%)</div>
                            <InputNumber
                              size="small"
                              value={Math.round((rateLimitConfig.response_rate_threshold || 0.3) * 100)}
                              onChange={(v) => updateRateLimitConfig('response_rate_threshold', (v ?? 30) / 100)}
                              min={0}
                              max={100}
                              style={{ width: '100%' }}
                            />
                          </div>
                        )}
                      </div>

                      <Button
                        size="small"
                        onClick={handleRateLimitSave}
                        loading={rateLimitLoading}
                        disabled={!rateLimitDirty}
                        block
                        style={{
                          backgroundColor: rateLimitDirty ? `${theme.dracula.green}25` : undefined,
                          borderColor: rateLimitDirty ? `${theme.dracula.green}60` : undefined,
                          color: rateLimitDirty ? theme.dracula.green : undefined,
                        }}
                      >
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: theme.colors.textSecondary, fontSize: theme.fontSize.sm }}>Failed to load</div>
                  )}
                </div>
              )}
            </div>
          )}

            {whatsappError && (
              <Alert type="error" message={whatsappError} showIcon style={{ marginBottom: theme.spacing.lg }} />
            )}
          </div>

          {/* Actions - Fixed at bottom */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.sm,
            justifyContent: 'center',
            padding: theme.spacing.md,
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            flexShrink: 0,
          }}>
            <Button
              onClick={handleWhatsAppStart}
              loading={whatsappLoading === 'start'}
              style={{
                backgroundColor: `${theme.dracula.green}25`,
                borderColor: `${theme.dracula.green}60`,
                color: theme.dracula.green,
              }}
            >
              Start
            </Button>
            <Button
              onClick={handleWhatsAppRestart}
              loading={whatsappLoading === 'restart'}
              style={{
                backgroundColor: `${theme.dracula.orange}25`,
                borderColor: `${theme.dracula.orange}60`,
                color: theme.dracula.orange,
              }}
            >
              Restart
            </Button>
            <Button
              onClick={handleWhatsAppRefresh}
              loading={whatsappLoading === 'refresh'}
              style={{
                backgroundColor: `${theme.dracula.cyan}25`,
                borderColor: `${theme.dracula.cyan}60`,
                color: theme.dracula.cyan,
              }}
            >
              Refresh
            </Button>
          </div>
        </div>
      );
    }

    // Android panel
    if (selectedItem.panelType === 'android') {
      return (
        <div style={{ padding: theme.spacing.xl, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* API Key Input */}
          <div style={{ marginBottom: theme.spacing.lg }}>
            <ApiKeyInput
              value={androidApiKey}
              onChange={setAndroidApiKey}
              onSave={handleAndroidSaveKey}
              onDelete={async () => {
                await removeApiKey('android_remote');
                setAndroidApiKey('');
                setAndroidApiKeyStored(false);
              }}
              placeholder="Enter Android Relay API key..."
              loading={androidLoading === 'save'}
              isStored={androidApiKeyStored}
            />
          </div>

          <Descriptions
            title={<Space><AndroidIcon /> Android Device</Space>}
            bordered
            column={1}
            size="small"
            style={{
              marginBottom: theme.spacing.xl,
              background: theme.colors.backgroundAlt,
              borderRadius: theme.borderRadius.md,
            }}
            styles={{
              label: {
                backgroundColor: theme.colors.backgroundPanel,
                color: theme.colors.textSecondary,
                fontWeight: theme.fontWeight.medium,
              },
              content: {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
              },
            }}
          >
            <Descriptions.Item label="API Key">
              <Tag style={getTagStyle((androidApiKeyStored || androidStatus.connected) ? 'success' : 'error')}>
                {androidApiKeyStored === null ? 'Checking...' : (androidApiKeyStored || androidStatus.connected) ? 'Configured' : 'Not configured'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Relay">
              <Tag style={getTagStyle(androidStatus.connected ? 'success' : 'error')}>
                {androidStatus.connected ? 'Connected' : 'Disconnected'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Device">
              <Tag style={getTagStyle(androidStatus.paired ? 'success' : (androidStatus.connected ? 'warning' : 'error'))}>
                {androidStatus.paired ? 'Paired' : (androidStatus.connected ? 'Waiting for pairing' : 'Not connected')}
              </Tag>
            </Descriptions.Item>
            {androidStatus.device_name && (
              <Descriptions.Item label="Device Name">
                {androidStatus.device_name}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* QR Code */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.backgroundAlt,
            borderRadius: theme.borderRadius.lg,
            marginBottom: theme.spacing.xl,
            minHeight: 200,
          }}>
            <QRCodeDisplay
              value={androidStatus.qr_data}
              isConnected={androidStatus.paired}
              size={260}
              connectedTitle="Device Paired!"
              connectedSubtitle={androidStatus.device_name || androidStatus.device_id || 'Android Device'}
              loading={androidStatus.connected && !androidStatus.qr_data && !androidStatus.paired}
              emptyText={androidApiKeyStored ? (androidStatus.connected ? 'Waiting for QR code...' : 'Click Connect to start') : 'Add API key first'}
            />
            {!androidStatus.paired && androidStatus.qr_data && (
              <div style={{ marginTop: theme.spacing.md, color: theme.colors.textSecondary }}>
                Scan with Android companion app
              </div>
            )}
          </div>

          {!androidApiKeyStored && !androidStatus.connected && (
            <Alert
              type="warning"
              message="API key required"
              description="Configure your Android Relay API key above before connecting."
              showIcon
              style={{ marginBottom: theme.spacing.lg }}
            />
          )}

          {androidError && (
            <Alert type="error" message={androidError} showIcon style={{ marginBottom: theme.spacing.lg }} />
          )}

          {/* Actions - Fixed at bottom */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.sm,
            justifyContent: 'center',
            paddingTop: theme.spacing.md,
            borderTop: `1px solid ${theme.colors.border}`,
          }}>
            <Button
              onClick={handleAndroidConnect}
              loading={androidLoading === 'connect'}
              disabled={androidStatus.connected || !androidApiKeyStored}
              style={{
                backgroundColor: `${theme.dracula.green}25`,
                borderColor: `${theme.dracula.green}60`,
                color: theme.dracula.green,
              }}
            >
              Connect
            </Button>
            <Button
              onClick={async () => {
                setAndroidLoading('reconnect');
                setAndroidError(null);
                try {
                  const key = await getStoredApiKey('android_remote');
                  if (!key) {
                    setAndroidError('No API key configured');
                    setAndroidLoading(null);
                    return;
                  }
                  const response = await sendRequest('android_relay_reconnect', {
                    url: import.meta.env.VITE_ANDROID_RELAY_URL || '',
                    api_key: key,
                  });
                  if (!response.success) {
                    setAndroidError(response.error || 'Failed to reconnect');
                  }
                } catch (err: any) {
                  setAndroidError(err.message || 'Failed to reconnect');
                } finally {
                  setAndroidLoading(null);
                }
              }}
              loading={androidLoading === 'reconnect'}
              disabled={!androidStatus.connected || !androidApiKeyStored}
              style={{
                backgroundColor: `${theme.dracula.orange}25`,
                borderColor: `${theme.dracula.orange}60`,
                color: theme.dracula.orange,
              }}
            >
              Reconnect
            </Button>
            <Button
              onClick={handleAndroidDisconnect}
              loading={androidLoading === 'disconnect'}
              disabled={!androidStatus.connected}
              style={{
                backgroundColor: `${theme.dracula.pink}25`,
                borderColor: `${theme.dracula.pink}60`,
                color: theme.dracula.pink,
              }}
            >
              Disconnect
            </Button>
          </div>

          {androidStatus.connected && (
            <div style={{ marginTop: theme.spacing.sm, fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'center' }}>
              Use Reconnect to get a new QR code if pairing fails
            </div>
          )}
        </div>
      );
    }

    const item = selectedItem;
    const isValid = validKeys[item.id];
    const Icon = item.Icon;
    const CustomIcon = item.CustomIcon;

    return (
      <div style={{ padding: theme.spacing.xl }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.lg,
          marginBottom: theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: `${item.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {CustomIcon ? <CustomIcon /> : Icon ? <Icon size={24} /> : null}
          </div>
          <div>
            <div style={{
              fontSize: theme.fontSize.lg,
              fontWeight: theme.fontWeight.semibold,
              color: theme.colors.text,
              marginBottom: 4,
            }}>
              {item.name}
            </div>
            <div style={{
              fontSize: theme.fontSize.sm,
              color: theme.colors.textSecondary,
            }}>
              {item.desc}
            </div>
          </div>
          {isValid && (
            <Tag
              icon={<CheckCircleOutlined />}
              style={{
                marginLeft: 'auto',
                backgroundColor: `${theme.dracula.green}25`,
                borderColor: `${theme.dracula.green}60`,
                color: theme.dracula.green,
              }}
            >
              Connected
            </Tag>
          )}
        </div>

        {/* API Key Input */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <label style={{
            display: 'block',
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.colors.text,
            marginBottom: theme.spacing.sm,
          }}>
            API Key
          </label>
          <ApiKeyInput
            value={keys[item.id] || ''}
            onChange={(value) => {
              setKeys(k => ({ ...k, [item.id]: value }));
              setValidKeys(v => ({ ...v, [item.id]: false }));
            }}
            onSave={() => handleValidate(item.id)}
            onDelete={isValid ? () => handleRemove(item.id) : undefined}
            placeholder={item.placeholder}
            loading={loading[item.id]}
            isStored={isValid}
          />
        </div>

        {/* Models list */}
        {models[item.id]?.length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <label style={{
              display: 'block',
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.medium,
              color: theme.colors.text,
              marginBottom: theme.spacing.sm,
            }}>
              Available Models
            </label>
            <div style={{
              fontSize: theme.fontSize.sm,
              color: theme.colors.textSecondary,
              padding: theme.spacing.md,
              backgroundColor: theme.colors.backgroundAlt,
              borderRadius: theme.borderRadius.md,
              maxHeight: 150,
              overflow: 'auto',
            }}>
              {models[item.id].map((model, idx) => (
                <div key={idx} style={{ padding: '4px 0' }}>{model}</div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div style={{
          marginTop: theme.spacing.xl,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          backgroundColor: `${theme.dracula.cyan}10`,
          border: `1px solid ${theme.dracula.cyan}30`,
        }}>
          <div style={{
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary,
            lineHeight: 1.5,
          }}>
            Your API key is stored securely and will be automatically injected when using {item.name} nodes in your workflows.
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={visible} onClose={onClose} maxWidth="95vw" maxHeight="95vh" headerActions={headerActions}>
      <div style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Left sidebar */}
        <div style={{
          width: 280,
          borderRight: `1px solid ${theme.colors.border}`,
          overflow: 'auto',
          flexShrink: 0,
        }}>
          {CATEGORIES.map(category => (
            <div key={category.key}>
              {/* Category header */}
              <div style={{
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: theme.colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backgroundColor: theme.colors.backgroundPanel,
                borderBottom: `1px solid ${theme.colors.border}`,
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}>
                {category.label}
              </div>
              {/* Category items */}
              {category.items.map(renderSidebarItem)}
            </div>
          ))}
        </div>

        {/* Right detail panel */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: theme.colors.background,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {renderDetailPanel()}
        </div>
      </div>
    </Modal>
  );
};

export default CredentialsModal;
