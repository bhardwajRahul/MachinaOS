import React from 'react';
import { Typography, Button, Space, Alert } from 'antd';
import { KeyOutlined, LinkOutlined } from '@ant-design/icons';
import {
  OpenAIIcon, ClaudeIcon, GeminiIcon, GroqIcon, OpenRouterIcon, CerebrasIcon,
} from '../../icons/AIProviderIcons';
import { useAppTheme } from '../../../hooks/useAppTheme';

const { Title, Text } = Typography;

interface ApiKeyStepProps {
  onOpenCredentials: () => void;
}

const providers = [
  { name: 'OpenAI', icon: <OpenAIIcon />, desc: 'GPT-4o, o3, o4 models', url: 'platform.openai.com' },
  { name: 'Anthropic', icon: <ClaudeIcon />, desc: 'Claude Opus, Sonnet models', url: 'console.anthropic.com' },
  { name: 'Google', icon: <GeminiIcon />, desc: 'Gemini Pro, Flash models', url: 'aistudio.google.com' },
  { name: 'Groq', icon: <GroqIcon />, desc: 'Ultra-fast Llama, Qwen', url: 'console.groq.com' },
  { name: 'OpenRouter', icon: <OpenRouterIcon />, desc: 'Access 200+ models', url: 'openrouter.ai' },
  { name: 'Cerebras', icon: <CerebrasIcon />, desc: 'Fast inference on custom HW', url: 'cloud.cerebras.ai' },
];

const ApiKeyStep: React.FC<ApiKeyStepProps> = ({ onOpenCredentials }) => {
  const theme = useAppTheme();

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: '0 0 4px 0' }}>
          <KeyOutlined style={{ marginRight: 8, color: theme.dracula.yellow }} />
          API Key Setup
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Configure at least one AI provider to use AI agents
        </Text>
      </div>

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {providers.map((p) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              backgroundColor: theme.colors.backgroundAlt,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 6,
            }}
          >
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {p.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{p.name}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{p.desc}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 10 }}>
              <LinkOutlined /> {p.url}
            </Text>
          </div>
        ))}
      </Space>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Button
          type="primary"
          icon={<KeyOutlined />}
          onClick={onOpenCredentials}
          style={{
            backgroundColor: theme.dracula.cyan,
            borderColor: theme.dracula.cyan,
          }}
        >
          Open Credentials
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="You can always change API keys later from the toolbar credentials button."
        style={{ marginTop: 16, fontSize: 12 }}
      />
    </div>
  );
};

export default ApiKeyStep;
