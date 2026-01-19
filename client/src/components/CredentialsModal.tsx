/**
 * CredentialsModal - Manage API credentials globally
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Tag, Space, message, Row, Col, Typography } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import Modal from './ui/Modal';
import { useApiKeys } from '../hooks/useApiKeys';

const { Text } = Typography;

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', color: '#10a37f', desc: 'GPT-4o, GPT-4 Turbo, GPT-3.5' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...', color: '#d97706', desc: 'Claude 3.5 Sonnet, Claude 3 Opus' },
  { id: 'gemini', name: 'Gemini', placeholder: 'AIza...', color: '#4285f4', desc: 'Gemini 1.5 Pro, Gemini Flash' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...', color: '#6366f1', desc: 'Unified API - OpenAI, Claude, Llama, Mistral, and more' },
  { id: 'google_maps', name: 'Google Maps', placeholder: 'AIza...', color: '#34a853', desc: 'Geocoding, Places API' },
  { id: 'android_remote', name: 'Android Remote', placeholder: 'your-api-key...', color: '#3ddc84', desc: 'Remote Android device via WebSocket' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CredentialsModal: React.FC<Props> = ({ visible, onClose }) => {
  const { validateApiKey, saveApiKey, getStoredApiKey, hasStoredKey, removeApiKey, validateGoogleMapsKey } = useApiKeys();
  const [form] = Form.useForm();
  const [validKeys, setValidKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<Record<string, string[]>>({});

  const loadStoredKeys = useCallback(async () => {
    const fieldValues: Record<string, string> = {};
    const validResults: Record<string, boolean> = {};

    for (const p of PROVIDERS) {
      const has = await hasStoredKey(p.id);
      if (has) {
        const key = await getStoredApiKey(p.id);
        if (key) {
          fieldValues[p.id] = key;
          validResults[p.id] = true;
        }
      }
    }

    if (Object.keys(fieldValues).length > 0) {
      form.setFieldsValue(fieldValues);
      setValidKeys(validResults);
    }
  }, [form, hasStoredKey, getStoredApiKey]);

  useEffect(() => {
    if (visible) {
      loadStoredKeys();
    }
  }, [visible, loadStoredKeys]);

  const handleValidate = async (id: string) => {
    const key = form.getFieldValue(id);
    if (!key?.trim()) return message.warning('Enter an API key first');

    setLoading(l => ({ ...l, [id]: true }));

    let result;
    if (id === 'google_maps') {
      result = await validateGoogleMapsKey(key);
    } else if (id === 'android_remote') {
      // Android Remote key - save without validation (validated on connection)
      result = await saveApiKey(id, key);
    } else {
      result = await validateApiKey(id, key);
    }
    setLoading(l => ({ ...l, [id]: false }));

    if (result.isValid) {
      setValidKeys(v => ({ ...v, [id]: true }));
      if (result.models) setModels(m => ({ ...m, [id]: result.models! }));
      message.success(`${PROVIDERS.find(p => p.id === id)?.name} key saved${id === 'android_remote' ? '' : ' and validated'}`);
    } else {
      message.error(result.error || 'Invalid key');
    }
  };

  const handleRemove = async (id: string) => {
    await removeApiKey(id);
    form.setFieldValue(id, '');
    setValidKeys(v => ({ ...v, [id]: false }));
    setModels(m => ({ ...m, [id]: [] }));
    message.success('Key removed');
  };

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      title="API Credentials"
      maxWidth="95vw"
      maxHeight="95vh"
    >
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: 24 }}>
          <Space>
            <SafetyOutlined style={{ color: '#52c41a' }} />
            <Text type="secondary">
              API keys are validated and stored securely. They will be used automatically by AI nodes in your workflows.
            </Text>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={[24, 24]}>
            {PROVIDERS.map(p => (
              <Col xs={24} lg={12} key={p.id}>
                <Card
                  title={
                    <Space>
                      <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
                      {validKeys[p.id] && <Tag color="success" icon={<CheckCircleOutlined />}>Valid</Tag>}
                    </Space>
                  }
                  extra={validKeys[p.id] && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(p.id)}>
                      Remove
                    </Button>
                  )}
                >
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>{p.desc}</Text>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name={p.id} noStyle>
                      <Input.Password
                        placeholder={p.placeholder}
                        style={{ fontFamily: 'monospace', fontSize: 14 }}
                        onChange={() => setValidKeys(v => ({ ...v, [p.id]: false }))}
                      />
                    </Form.Item>
                    <Button
                      loading={loading[p.id]}
                      onClick={() => handleValidate(p.id)}
                      type={validKeys[p.id] ? 'primary' : 'default'}
                      style={validKeys[p.id] ? { backgroundColor: p.color, borderColor: p.color } : {}}
                    >
                      {validKeys[p.id] ? 'Valid' : 'Validate'}
                    </Button>
                  </Space.Compact>
                  {models[p.id]?.length > 0 && (
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 12, display: 'block' }}>
                      Models: {models[p.id].slice(0, 4).join(', ')}{models[p.id].length > 4 && ` +${models[p.id].length - 4} more`}
                    </Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </Form>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Button type="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
};

export default CredentialsModal;
