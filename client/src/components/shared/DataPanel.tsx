import React, { ReactNode } from 'react';
import { Card, Space, Empty, Typography } from 'antd';
import { useAppTheme } from '../../hooks/useAppTheme';

const { Text } = Typography;

// Compound Component Pattern
interface DataPanelProps {
  children: ReactNode;
}

interface HeaderProps {
  title: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
}

interface ContentProps {
  children: ReactNode;
}

interface FooterProps {
  children: ReactNode;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const DataPanelRoot: React.FC<DataPanelProps> = ({ children }) => {
  const theme = useAppTheme();
  return (
    <div style={{
      width: '350px',
      height: '100%',
      backgroundColor: theme.colors.backgroundPanel,
      borderLeft: `1px solid ${theme.colors.border}`,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {children}
    </div>
  );
};

const DataPanelHeader: React.FC<HeaderProps> = ({ title, extra, children }) => {
  const theme = useAppTheme();
  return (
    <Card
      size="small"
      title={title}
      extra={extra}
      headStyle={{
        borderBottom: `1px solid ${theme.colors.border}`,
        padding: 8,
        backgroundColor: theme.colors.backgroundPanel
      }}
      bodyStyle={{ padding: children ? 8 : 0 }}
      style={{
        borderRadius: 0,
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundPanel
      }}
    >
      {children}
    </Card>
  );
};

const DataPanelContent: React.FC<ContentProps> = ({ children }) => (
  <div style={{
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  }}>
    {children}
  </div>
);

const DataPanelFooter: React.FC<FooterProps> = ({ children }) => {
  const theme = useAppTheme();
  return (
    <Card
      size="small"
      bodyStyle={{ padding: 8, textAlign: 'center' }}
      style={{
        borderRadius: 0,
        border: 'none',
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundPanel
      }}
    >
      {children}
    </Card>
  );
};

const DataPanelEmpty: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  const theme = useAppTheme();
  return (
    <div style={{
      width: '350px',
      height: '100%',
      backgroundColor: theme.colors.backgroundPanel,
      borderLeft: `1px solid ${theme.colors.border}`,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Empty
        image={icon}
        description={
          <Space direction="vertical" size="small">
            <Text style={{ color: theme.colors.textSecondary }}>{title}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
              {description}
            </Text>
          </Space>
        }
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      />
    </div>
  );
};

// Compound Component Export
const DataPanel = {
  Root: DataPanelRoot,
  Header: DataPanelHeader,
  Content: DataPanelContent,
  Footer: DataPanelFooter,
  Empty: DataPanelEmpty
};

export default DataPanel;
