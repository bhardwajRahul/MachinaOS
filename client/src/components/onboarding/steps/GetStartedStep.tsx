import React from 'react';
import { Typography, Card, Space, Tag } from 'antd';
import {
  PlayCircleOutlined,
  ExperimentOutlined,
  BookOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';

const { Title, Text, Paragraph } = Typography;

const GetStartedStep: React.FC = () => {
  const theme = useAppTheme();

  const tips = [
    {
      icon: <PlayCircleOutlined />,
      title: 'Try an Example Workflow',
      desc: 'Open the sidebar and click on one of the pre-loaded example workflows to see how things work.',
      color: theme.dracula.green,
    },
    {
      icon: <ExperimentOutlined />,
      title: 'Build Your First Workflow',
      desc: (
        <>
          Quick recipe: drag{' '}
          <Tag style={{ fontSize: 10, lineHeight: '16px', margin: '0 2px' }}>Chat Trigger</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{'\u2192'}</Text>{' '}
          <Tag style={{ fontSize: 10, lineHeight: '16px', margin: '0 2px' }}>Zeenie</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{'\u2192'}</Text>{' '}
          <Tag style={{ fontSize: 10, lineHeight: '16px', margin: '0 2px' }}>Claude Model</Tag>
          {' '}then click <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', margin: '0 2px' }}>Run</Tag>
        </>
      ),
      color: theme.dracula.purple,
    },
    {
      icon: <BookOutlined />,
      title: 'Explore AI Skills',
      desc: 'Use the Master Skill node to browse and enable built-in skills for your AI agents.',
      color: theme.dracula.cyan,
    },
    {
      icon: <SettingOutlined />,
      title: 'Revisit This Guide',
      desc: 'You can replay this welcome guide anytime from Settings.',
      color: theme.dracula.orange,
    },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: '0 0 4px 0' }}>Get Started</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Here are some things to try first
        </Text>
      </div>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {tips.map((t, i) => (
          <Card
            key={i}
            size="small"
            style={{
              borderColor: `${t.color}30`,
              backgroundColor: `${t.color}08`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${t.color}20`,
                borderRadius: 6,
                color: t.color,
                fontSize: 14,
                flexShrink: 0,
              }}>
                {t.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ fontSize: 13, color: t.color, display: 'block', marginBottom: 2 }}>
                  {t.title}
                </Text>
                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  {t.desc}
                </Paragraph>
              </div>
            </div>
          </Card>
        ))}
      </Space>
    </div>
  );
};

export default GetStartedStep;
