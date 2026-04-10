/**
 * CredentialsModal — thin shell.
 * antd Menu sidebar (grouped by category) + PanelRenderer on the right.
 * All rendering logic lives in panels/ and primitives/.
 */

import React, { useMemo, useState } from 'react';
import { Menu, Tag, Flex, type MenuProps } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import Modal from '../ui/Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CATEGORIES, PROVIDERS } from './providers';
import PanelRenderer from './PanelRenderer';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CredentialsModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useAppTheme();
  const [selectedId, setSelectedId] = useState<string>(PROVIDERS[0]?.id ?? '');
  const selected = PROVIDERS.find(p => p.id === selectedId) ?? null;

  // Build antd Menu items from CATEGORIES — each category becomes an itemGroup
  const menuItems: MenuProps['items'] = useMemo(() =>
    CATEGORIES.map(cat => ({
      type: 'group' as const,
      key: cat.key,
      label: cat.label,
      children: cat.items.map(p => ({
        key: p.id,
        icon: <p.icon size={parseInt(theme.iconSize.sm)} />,
        label: p.name,
      })),
    })),
  [theme.iconSize.sm]);

  const headerActions = (
    <Flex align="center" gap={theme.spacing.md}>
      <Flex align="center" gap={theme.spacing.sm}
        style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
        <SafetyOutlined style={{ color: theme.dracula.yellow }} />
        <span>API Credentials</span>
      </Flex>
      <Tag style={{
        margin: 0, fontSize: theme.fontSize.xs,
        backgroundColor: `${theme.dracula.green}25`,
        borderColor: `${theme.dracula.green}60`,
        color: theme.dracula.green,
      }}>
        {PROVIDERS.length} providers
      </Tag>
    </Flex>
  );

  return (
    <Modal isOpen={visible} onClose={onClose} maxWidth="95vw" maxHeight="95vh" headerActions={headerActions}>
      <Flex style={{ height: '100%', overflow: 'hidden' }}>
        <div style={{
          width: parseInt(theme.layout?.parameterPanelWidth ?? '280px'),
          borderRight: `1px solid ${theme.colors.border}`,
          overflow: 'auto',
          flexShrink: 0,
        }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedId]}
            onClick={({ key }) => setSelectedId(key as string)}
            items={menuItems}
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: theme.colors.background, display: 'flex', flexDirection: 'column' }}>
          <PanelRenderer config={selected} visible={visible} />
        </div>
      </Flex>
    </Modal>
  );
};

export default CredentialsModal;
