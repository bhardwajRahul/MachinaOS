/**
 * PanelRenderer — dispatches to the right panel by config.kind.
 * 10 lines of logic. All panel implementations in panels/ directory.
 */

import React from 'react';
import { Result } from 'antd';
import ApiKeyPanel from './panels/ApiKeyPanel';
import OAuthPanel from './panels/OAuthPanel';
import QrPairingPanel from './panels/QrPairingPanel';
import EmailPanel from './panels/EmailPanel';
import type { ProviderConfig } from './types';

const PANEL_MAP: Record<string, React.FC<any>> = {
  apiKey: ApiKeyPanel,
  oauth: OAuthPanel,
  qrPairing: QrPairingPanel,
  email: EmailPanel,
};

interface Props { config: ProviderConfig | null; visible: boolean }

const PanelRenderer: React.FC<Props> = ({ config, visible }) => {
  if (!config) return <Result status="info" subTitle="Select a credential to configure" />;
  const Panel = PANEL_MAP[config.kind];
  return Panel ? <Panel config={config} visible={visible} /> : null;
};

export default PanelRenderer;
