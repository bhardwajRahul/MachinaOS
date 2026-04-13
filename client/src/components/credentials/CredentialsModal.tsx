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
import { Loader2, ShieldCheck } from 'lucide-react';

import Modal from '../ui/Modal';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="h-4 w-4 text-dracula-yellow" />
        <span>API Credentials</span>
      </div>
      <Badge variant="success">{providers.length} providers</Badge>
      {isLoadingServer && (
        <Badge variant="info" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          loading
        </Badge>
      )}
      {!usingServerData && !isLoadingServer && (
        <Badge variant="warning" title="Using bundled fallback catalogue">
          offline
        </Badge>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      maxWidth="95vw"
      maxHeight="95vh"
      headerActions={headerActions}
    >
      <div className="flex h-full overflow-hidden">
        <div className="flex w-[280px] shrink-0 flex-col border-r border-border">
          <CredentialsPalette
            providers={providers}
            categories={categories}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="flex flex-1 flex-col overflow-auto bg-background">
          <PanelRenderer config={selected} visible={visible} />
        </div>
      </div>
    </Modal>
  );
};

export default CredentialsModal;
