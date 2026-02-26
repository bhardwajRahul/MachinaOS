import React from 'react';
import { Typography, Space } from 'antd';
import {
  AppstoreOutlined,
  BranchesOutlined,
  RobotOutlined,
  ToolOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';

const { Title, Text, Paragraph } = Typography;

const ConceptsStep: React.FC = () => {
  const theme = useAppTheme();

  const concepts = [
    {
      icon: <AppstoreOutlined />,
      title: 'Nodes',
      desc: 'Building blocks of your workflow. Each node performs a specific action like sending a message, calling an AI model, or processing data.',
      color: theme.dracula.cyan,
    },
    {
      icon: <BranchesOutlined />,
      title: 'Edges',
      desc: "Connections between nodes that define data flow. Drag from one node's output to another's input to connect them.",
      color: theme.dracula.green,
    },
    {
      icon: <RobotOutlined />,
      title: 'AI Agents',
      desc: 'Intelligent nodes that use LLMs (Claude, GPT, Gemini) to reason, call tools, and complete tasks autonomously.',
      color: theme.dracula.purple,
    },
    {
      icon: <ToolOutlined />,
      title: 'Skills & Tools',
      desc: 'Connect skills and tools to agents to extend their capabilities. Skills provide instructions, tools provide actions.',
      color: theme.dracula.orange,
    },
    {
      icon: <SwapOutlined />,
      title: 'Normal vs Dev Mode',
      desc: 'Normal mode shows AI-focused nodes for simple workflows. Dev mode unlocks all 108+ nodes for advanced automation.',
      color: theme.dracula.pink,
    },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: '0 0 4px 0' }}>Key Concepts</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Understanding these will help you build powerful workflows
        </Text>
      </div>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {concepts.map((c) => (
          <div
            key={c.title}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 12,
              backgroundColor: `${c.color}10`,
              border: `1px solid ${c.color}25`,
              borderRadius: 6,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${c.color}20`,
              borderRadius: 6,
              fontSize: 16,
              color: c.color,
              flexShrink: 0,
            }}>
              {c.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ fontSize: 13, color: c.color, display: 'block', marginBottom: 2 }}>
                {c.title}
              </Text>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                {c.desc}
              </Paragraph>
            </div>
          </div>
        ))}
      </Space>
    </div>
  );
};

export default ConceptsStep;
