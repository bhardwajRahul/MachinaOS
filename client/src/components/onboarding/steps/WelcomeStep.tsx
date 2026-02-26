import React from 'react';
import { Typography, Card, Row, Col } from 'antd';
import {
  RocketOutlined,
  ApiOutlined,
  DragOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAppTheme } from '../../../hooks/useAppTheme';

const { Title, Text, Paragraph } = Typography;

const features = [
  { icon: <ApiOutlined />, label: '108+ Nodes', desc: 'Workflow building blocks' },
  { icon: <RocketOutlined />, label: '6 AI Providers', desc: 'OpenAI, Claude, Gemini & more' },
  { icon: <DragOutlined />, label: 'Drag & Drop', desc: 'Visual workflow builder' },
  { icon: <ThunderboltOutlined />, label: 'Real-time', desc: 'Live execution & monitoring' },
];

const WelcomeStep: React.FC = () => {
  const theme = useAppTheme();

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <RocketOutlined style={{ fontSize: 40, color: theme.dracula.purple, marginBottom: 8 }} />

      <Title level={3} style={{ margin: '0 0 4px 0' }}>
        Welcome to MachinaOs
      </Title>

      <Text strong style={{ color: theme.dracula.purple, fontSize: 15 }}>
        Visual workflow automation powered by AI agents
      </Text>

      <Paragraph type="secondary" style={{ maxWidth: 480, margin: '16px auto 24px auto', fontSize: 13 }}>
        MachinaOs lets you build intelligent automation workflows by connecting
        AI models, tools, and services together on an interactive canvas.
        No coding required for most tasks.
      </Paragraph>

      <Row gutter={[12, 12]} justify="center" style={{ maxWidth: 440, margin: '0 auto' }}>
        {features.map((f) => (
          <Col span={12} key={f.label}>
            <Card
              size="small"
              style={{
                textAlign: 'center',
                backgroundColor: `${theme.dracula.purple}12`,
                borderColor: `${theme.dracula.purple}30`,
              }}
            >
              <div style={{ fontSize: 22, color: theme.dracula.purple, marginBottom: 4 }}>
                {f.icon}
              </div>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{f.label}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{f.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default WelcomeStep;
