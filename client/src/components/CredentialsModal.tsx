/**
 * CredentialsModal - Modern categorized credentials management panel
 * Uses Ant Design Collapse + List for compact, modern UI
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Button, message, Collapse, List, Tag, Space, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  SafetyOutlined,
  SearchOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import Modal from './ui/Modal';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  OpenAIIcon, ClaudeIcon, GeminiIcon, GroqIcon, OpenRouterIcon, CerebrasIcon,
} from './icons/AIProviderIcons';

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
      { id: 'gemini', name: 'Gemini', placeholder: 'AIza...', color: '#4285f4', desc: 'Gemini 1.5 Pro, Flash', Icon: GeminiIcon },
      { id: 'groq', name: 'Groq', placeholder: 'gsk_...', color: '#F55036', desc: 'Llama, Mixtral - Ultra-fast', Icon: GroqIcon },
      { id: 'cerebras', name: 'Cerebras', placeholder: 'csk-...', color: '#FF6600', desc: 'Llama, Qwen - Ultra-fast', Icon: CerebrasIcon },
      { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...', color: '#6366f1', desc: 'Unified API - 100+ models', Icon: OpenRouterIcon },
    ],
  },
  {
    key: 'services',
    label: 'Services',
    items: [
      { id: 'google_maps', name: 'Google Maps', placeholder: 'AIza...', color: '#34a853', desc: 'Geocoding, Places API' },
      { id: 'android_remote', name: 'Android Remote', placeholder: 'your-api-key...', color: '#3ddc84', desc: 'WebSocket device control' },
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

  const [validKeys, setValidKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // Load stored keys
  const loadKeys = useCallback(async () => {
    const allItems = CATEGORIES.flatMap(c => c.items);
    const newKeys: Record<string, string> = {};
    const newValid: Record<string, boolean> = {};

    for (const item of allItems) {
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
      setExpanded(null);
      setSearch('');
    }
  }, [visible, loadKeys]);

  const handleValidate = async (id: string) => {
    const key = keys[id];
    if (!key?.trim()) return message.warning('Enter an API key first');

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
      message.success('Key saved and validated');
    } else {
      message.error(result.error || 'Invalid key');
    }
  };

  const handleRemove = async (id: string) => {
    await removeApiKey(id);
    setKeys(k => ({ ...k, [id]: '' }));
    setValidKeys(v => ({ ...v, [id]: false }));
    setModels(m => ({ ...m, [id]: [] }));
    message.success('Key removed');
  };

  // Filter by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(i => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)),
    })).filter(cat => cat.items.length > 0);
  }, [search]);

  // Count configured per category
  const getCount = (items: typeof CATEGORIES[0]['items']) =>
    items.filter(i => validKeys[i.id]).length;

  return (
    <Modal isOpen={visible} onClose={onClose} title="API Credentials" maxWidth="95vw" maxHeight="95vh">
      <div style={{ padding: 20 }}>
        {/* Info banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          padding: 12, borderRadius: 8,
          backgroundColor: `${theme.dracula.green}10`,
          border: `1px solid ${theme.dracula.green}30`,
        }}>
          <SafetyOutlined style={{ color: theme.dracula.green }} />
          <span style={{ fontSize: 13, color: theme.colors.textSecondary }}>
            Keys are stored securely and used automatically by AI nodes.
          </span>
        </div>

        {/* Search */}
        <Input
          placeholder="Search credentials..."
          prefix={<SearchOutlined style={{ color: theme.colors.textMuted }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 16 }}
        />

        {/* Categories */}
        <Collapse
          defaultActiveKey={['ai', 'services']}
          ghost
          style={{ background: 'transparent' }}
          items={filteredCategories.map(cat => ({
            key: cat.key,
            label: (
              <Space>
                <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                  {cat.label}
                </span>
                <Tag color={getCount(cat.items) === cat.items.length ? 'success' : 'default'}>
                  {getCount(cat.items)}/{cat.items.length}
                </Tag>
              </Space>
            ),
            children: (
              <List
                dataSource={cat.items}
                renderItem={item => {
                  const isExpanded = expanded === item.id;
                  const isValid = validKeys[item.id];
                  const Icon = item.Icon;

                  return (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        padding: '12px 8px',
                        borderRadius: 8,
                        marginBottom: 4,
                        backgroundColor: isExpanded ? theme.colors.backgroundAlt : 'transparent',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                    >
                      {/* Row header */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 6, marginRight: 12,
                          backgroundColor: `${item.color}15`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {Icon ? <Icon size={18} /> : <span>{item.id === 'google_maps' ? '📍' : '📱'}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: theme.colors.textMuted }}>{item.desc}</div>
                        </div>
                        {isValid && (
                          <Tag icon={<CheckCircleOutlined />} color="success">Valid</Tag>
                        )}
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` }}
                          onClick={e => e.stopPropagation()}
                        >
                          <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                            <Input
                              type={showKey[item.id] ? 'text' : 'password'}
                              value={keys[item.id] || ''}
                              onChange={e => {
                                setKeys(k => ({ ...k, [item.id]: e.target.value }));
                                setValidKeys(v => ({ ...v, [item.id]: false }));
                              }}
                              placeholder={item.placeholder}
                              style={{ fontFamily: 'monospace', fontSize: 13 }}
                              suffix={
                                <Tooltip title={showKey[item.id] ? 'Hide' : 'Show'}>
                                  <span
                                    onClick={() => setShowKey(s => ({ ...s, [item.id]: !s[item.id] }))}
                                    style={{ cursor: 'pointer', color: theme.colors.textMuted }}
                                  >
                                    {showKey[item.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                  </span>
                                </Tooltip>
                              }
                            />
                            <Button
                              loading={loading[item.id]}
                              onClick={() => handleValidate(item.id)}
                              type={isValid ? 'primary' : 'default'}
                              style={isValid ? { backgroundColor: theme.dracula.green, borderColor: theme.dracula.green } : {}}
                            >
                              {isValid ? 'Valid' : 'Validate'}
                            </Button>
                          </Space.Compact>

                          {models[item.id]?.length > 0 && (
                            <div style={{ fontSize: 12, color: theme.colors.textMuted, marginBottom: 8 }}>
                              Models: {models[item.id].slice(0, 4).join(', ')}{models[item.id].length > 4 && ` +${models[item.id].length - 4}`}
                            </div>
                          )}

                          {isValid && (
                            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(item.id)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      )}
                    </List.Item>
                  );
                }}
              />
            ),
          }))}
        />

        {/* Footer */}
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Button type="primary" onClick={onClose} style={{ backgroundColor: theme.dracula.green, borderColor: theme.dracula.green }}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CredentialsModal;
