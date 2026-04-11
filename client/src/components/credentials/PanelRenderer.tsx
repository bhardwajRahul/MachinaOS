/**
 * PanelRenderer — lazy panel dispatch.
 *
 * Phase 5 of the credentials-scaling plan: each panel is loaded on
 * demand via `React.lazy` + Vite dynamic `import()`. First selection of
 * a given panel kind pays a one-time ~10–50 ms chunk-fetch cost; every
 * subsequent selection is instant. Reduces the credentials modal's
 * initial JS payload and lets Vite emit one chunk per panel kind.
 *
 * Panels are cached at module scope so switching providers of the same
 * kind does not trip Suspense on every click.
 */

import React, { Suspense, useMemo } from 'react';
import { Flex, Result, Spin } from 'antd';
import type { ProviderConfig, PanelKind } from './types';

// Vite will emit one chunk per panel under dist/assets/ApiKeyPanel-*.js,
// OAuthPanel-*.js, etc. Keep the import paths inside the arrow fns so
// code splitting is preserved.
const PANEL_LOADERS: Record<PanelKind, () => Promise<{ default: React.ComponentType<PanelProps> }>> = {
  apiKey: () => import('./panels/ApiKeyPanel'),
  oauth: () => import('./panels/OAuthPanel'),
  qrPairing: () => import('./panels/QrPairingPanel'),
  email: () => import('./panels/EmailPanel'),
};

// Memoize the lazy wrappers at module scope so switching providers of
// the same kind doesn't re-trigger Suspense. React.lazy memoizes too
// internally, but declaring them once makes the intent explicit and
// avoids any HMR edge cases.
const LAZY_PANELS: Record<PanelKind, React.LazyExoticComponent<React.ComponentType<PanelProps>>> = {
  apiKey: React.lazy(PANEL_LOADERS.apiKey),
  oauth: React.lazy(PANEL_LOADERS.oauth),
  qrPairing: React.lazy(PANEL_LOADERS.qrPairing),
  email: React.lazy(PANEL_LOADERS.email),
};

interface PanelProps {
  config: ProviderConfig;
  visible: boolean;
}

interface Props {
  config: ProviderConfig | null;
  visible: boolean;
}

const PanelFallback: React.FC = () => (
  <Flex align="center" justify="center" style={{ width: '100%', height: '100%', minHeight: 240 }}>
    <Spin />
  </Flex>
);

const PanelRenderer: React.FC<Props> = ({ config, visible }) => {
  const Lazy = useMemo(() => {
    if (!config) return null;
    return LAZY_PANELS[config.kind] ?? null;
  }, [config]);

  if (!config) {
    return <Result status="info" subTitle="Select a credential to configure" />;
  }
  if (!Lazy) {
    return <Result status="warning" subTitle={`Unknown credential kind: ${config.kind}`} />;
  }

  return (
    <Suspense fallback={<PanelFallback />}>
      <Lazy config={config} visible={visible} />
    </Suspense>
  );
};

export default PanelRenderer;
