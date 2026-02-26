import React from 'react';
import { Typography, Tag, Space } from 'antd';
import {
  LayoutOutlined,
  ToolOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';

const { Title, Text } = Typography;

const CanvasStep: React.FC = () => {
  const theme = useAppTheme();

  const shortcuts = [
    { keys: 'Ctrl+S', action: 'Save workflow' },
    { keys: 'F2', action: 'Rename node' },
    { keys: 'Delete', action: 'Remove node' },
    { keys: 'Ctrl+C', action: 'Copy node' },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: '0 0 4px 0' }}>Canvas Tour</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Navigate the main interface regions
        </Text>
      </div>

      {/* Visual layout diagram */}
      <div style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '6px 10px',
          backgroundColor: `${theme.dracula.orange}15`,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <ToolOutlined style={{ color: theme.dracula.orange, fontSize: 12 }} />
          <Text style={{ fontSize: 11, color: theme.dracula.orange }} strong>Toolbar</Text>
          <div style={{ flex: 1 }} />
          <Tag color="orange" style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>Run</Tag>
          <Tag color="purple" style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>Start</Tag>
          <Tag color="cyan" style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>Save</Tag>
        </div>

        {/* Main area */}
        <div style={{ display: 'flex', height: 120 }}>
          {/* Sidebar */}
          <div style={{
            width: 80,
            backgroundColor: `${theme.dracula.cyan}10`,
            borderRight: `1px solid ${theme.colors.border}`,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}>
            <Text style={{ fontSize: 9, color: theme.dracula.cyan }} strong>Sidebar</Text>
            {['Workflow 1', 'Workflow 2'].map(w => (
              <div key={w} style={{
                fontSize: 8,
                padding: '2px 4px',
                backgroundColor: theme.colors.backgroundAlt,
                borderRadius: 3,
                color: theme.colors.textSecondary,
              }}>{w}</div>
            ))}
          </div>

          {/* Canvas */}
          <div style={{
            flex: 1,
            backgroundColor: `${theme.dracula.purple}08`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{ textAlign: 'center' }}>
              <LayoutOutlined style={{ fontSize: 20, color: theme.dracula.purple, opacity: 0.5 }} />
              <div style={{ fontSize: 9, color: theme.dracula.purple, marginTop: 2 }}>Canvas</div>
            </div>
          </div>

          {/* Palette */}
          <div style={{
            width: 80,
            backgroundColor: `${theme.dracula.green}10`,
            borderLeft: `1px solid ${theme.colors.border}`,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}>
            <Text style={{ fontSize: 9, color: theme.dracula.green }} strong>Palette</Text>
            {['AI Agents', 'AI Models', 'Skills'].map(c => (
              <div key={c} style={{
                fontSize: 8,
                padding: '2px 4px',
                backgroundColor: theme.colors.backgroundAlt,
                borderRadius: 3,
                color: theme.colors.textSecondary,
              }}>{c}</div>
            ))}
          </div>
        </div>

        {/* Console */}
        <div style={{
          padding: '6px 10px',
          backgroundColor: `${theme.dracula.pink}10`,
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <CodeOutlined style={{ color: theme.dracula.pink, fontSize: 12 }} />
          <Text style={{ fontSize: 11, color: theme.dracula.pink }} strong>Console</Text>
          <div style={{ flex: 1 }} />
          <Tag style={{ fontSize: 9, margin: 0, lineHeight: '16px' }}>Chat</Tag>
          <Tag style={{ fontSize: 9, margin: 0, lineHeight: '16px' }}>Logs</Tag>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Keyboard Shortcuts</Text>
        <Space wrap size={[8, 6]}>
          {shortcuts.map((s) => (
            <span key={s.keys} style={{ fontSize: 12 }}>
              <Tag style={{ fontSize: 11, fontFamily: 'monospace' }}>{s.keys}</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>{s.action}</Text>
            </span>
          ))}
        </Space>
      </div>
    </div>
  );
};

export default CanvasStep;
