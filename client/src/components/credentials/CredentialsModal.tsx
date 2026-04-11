/**
 * CredentialsModal — thin shell.
 *
 * Phase 4 of the credentials-scaling plan:
 *   - Data source is the server-owned `credential_providers.json` via
 *     `useCatalogueQuery` (TanStack Query + IndexedDB warm-start).
 *   - Sidebar is `CredentialsPalette` (cmdk + fuzzysort + GroupedVirtuoso).
 *   - Detail panel is still `PanelRenderer` (unchanged; consumed via the
 *     catalogue adapter so panels see the same `ProviderConfig` shape).
 *
 * Additive safety: if the server fetch fails or hasn't landed yet, the
 * modal falls back to the client-owned `PROVIDERS` from `providers.tsx`.
 * That file stays in place until Phase 8 verification passes.
 */

import React, { useMemo } from 'react';
import { Tag, Flex, Spin } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';

import Modal from '../ui/Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CATEGORIES as CLIENT_CATEGORIES, PROVIDERS as CLIENT_PROVIDERS } from './providers';
import PanelRenderer from './PanelRenderer';
import CredentialsPalette from './CredentialsPalette';
import { rehydrateCatalogue } from './catalogueAdapter';
import { useCatalogueQuery } from '../../hooks/useCatalogueQuery';
import { useCredentialRegistry } from '../../store/useCredentialRegistry';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CredentialsModal: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useAppTheme();

  // UI state lives in the Zustand store (no catalogue data ever).
  const selectedId = useCredentialRegistry((s) => s.selectedId);
  const setSelectedId = useCredentialRegistry((s) => s.setSelectedId);

  // Server-owned catalogue with IDB warm-start.
  const catalogue = useCatalogueQuery();

  // Rehydrate server JSON → runtime ProviderConfig shape; fall back to
  // the client-owned registry if the server data hasn't arrived (cold
  // start with no IDB cache, server unreachable, etc.).
  const { providers, categories } = useMemo(() => {
    if (catalogue.data) return rehydrateCatalogue(catalogue.data);
    return { providers: CLIENT_PROVIDERS, categories: CLIENT_CATEGORIES };
  }, [catalogue.data]);

  // Default selection: if nothing is selected yet (or the previous
  // selection isn't in the current catalogue), pick the first provider.
  const effectiveSelectedId = useMemo(() => {
    if (selectedId && providers.some((p) => p.id === selectedId)) return selectedId;
    return providers[0]?.id ?? null;
  }, [selectedId, providers]);

  // Keep the store in sync without causing a render loop — only update
  // when the effective id diverges from the stored one.
  React.useEffect(() => {
    if (effectiveSelectedId && effectiveSelectedId !== selectedId) {
      setSelectedId(effectiveSelectedId);
    }
  }, [effectiveSelectedId, selectedId, setSelectedId]);

  const selected = useMemo(
    () => providers.find((p) => p.id === effectiveSelectedId) ?? null,
    [providers, effectiveSelectedId],
  );

  const usingServerData = !!catalogue.data;
  const isLoadingServer = catalogue.isLoading && !catalogue.data;

  const headerActions = (
    <Flex align="center" gap={theme.spacing.md}>
      <Flex
        align="center"
        gap={theme.spacing.sm}
        style={{
          fontSize: theme.fontSize.base,
          fontWeight: theme.fontWeight.semibold,
          color: theme.colors.text,
        }}
      >
        <SafetyOutlined style={{ color: theme.dracula.yellow }} />
        <span>API Credentials</span>
      </Flex>
      <Tag
        style={{
          margin: 0,
          fontSize: theme.fontSize.xs,
          backgroundColor: `${theme.dracula.green}25`,
          borderColor: `${theme.dracula.green}60`,
          color: theme.dracula.green,
        }}
      >
        {providers.length} providers
      </Tag>
      {isLoadingServer && (
        <Tag
          style={{
            margin: 0,
            fontSize: theme.fontSize.xs,
            backgroundColor: `${theme.dracula.cyan}25`,
            borderColor: `${theme.dracula.cyan}60`,
            color: theme.dracula.cyan,
          }}
        >
          <Spin size="small" /> loading
        </Tag>
      )}
      {!usingServerData && !isLoadingServer && (
        <Tag
          style={{
            margin: 0,
            fontSize: theme.fontSize.xs,
            backgroundColor: `${theme.dracula.orange}25`,
            borderColor: `${theme.dracula.orange}60`,
            color: theme.dracula.orange,
          }}
          title="Using bundled fallback catalogue"
        >
          offline
        </Tag>
      )}
    </Flex>
  );

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      maxWidth="95vw"
      maxHeight="95vh"
      headerActions={headerActions}
    >
      <Flex style={{ height: '100%', overflow: 'hidden' }}>
        <div
          style={{
            width: parseInt(theme.layout?.parameterPanelWidth ?? '280px'),
            borderRight: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CredentialsPalette
            providers={providers}
            categories={categories}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: theme.colors.background,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PanelRenderer config={selected} visible={visible} />
        </div>
      </Flex>
    </Modal>
  );
};

export default CredentialsModal;
