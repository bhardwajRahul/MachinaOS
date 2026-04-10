/**
 * StatusCard — config-driven status Descriptions.
 * Config provides data (ok/trueText/falseText); component resolves theme colors.
 * Matches original CredentialsModal's Descriptions density (bordered, column=1, small).
 */

import React from 'react';
import { Descriptions, Tag, Space } from 'antd';
import { useAppTheme } from '../../../hooks/useAppTheme';
import type { StatusRowDef } from '../types';

interface Props {
  icon: React.ReactNode;
  title: string;
  rows: StatusRowDef[];
  status: any;
}

const StatusCard: React.FC<Props> = ({ icon, title, rows, status }) => {
  const theme = useAppTheme();
  const tagStyle = (ok: boolean, warn?: boolean): React.CSSProperties => {
    const c = ok ? theme.dracula.green : warn ? theme.dracula.orange : theme.dracula.pink;
    return { backgroundColor: `${c}25`, borderColor: `${c}60`, color: c };
  };

  return (
    <Descriptions bordered column={1} size="small"
      title={<Space>{icon} {title}</Space>}
      style={{ borderRadius: theme.borderRadius.md }}
      styles={{
        label: { backgroundColor: theme.colors.backgroundPanel, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium },
        content: { backgroundColor: theme.colors.background, color: theme.colors.text },
      }}>
      {rows.map(r => {
        const ok = r.ok(status);
        return (
          <Descriptions.Item key={r.label} label={r.label}>
            <Tag style={tagStyle(ok, r.warn)}>{ok ? r.trueText : r.falseText}</Tag>
          </Descriptions.Item>
        );
      })}
    </Descriptions>
  );
};

export default StatusCard;
