/**
 * Tests for useParameterPanel hook.
 *
 * Locks in:
 *   - Defaults loaded from nodeDefinition.properties[].default
 *   - Saved parameters fetched via WebSocket and merged over defaults (saved wins)
 *   - hasUnsavedChanges computed via JSON.stringify equality
 *   - handleSave persists to DB and updates originalParameters
 *   - handleCancel reverts pending edits and clears selection
 *   - WebSocket failure falls back to defaults and surfaces error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useParameterPanel } from '../useParameterPanel';

// --- Mock store --------------------------------------------------------------

const storeState: { selectedNode: any; setSelectedNode: any } = {
  selectedNode: null,
  setSelectedNode: vi.fn(),
};
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => storeState,
}));

// --- Mock node definitions ---------------------------------------------------

vi.mock('../../nodeDefinitions', () => ({
  nodeDefinitions: {
    httpRequest: {
      name: 'httpRequest',
      displayName: 'HTTP Request',
      properties: [
        { name: 'method', type: 'options', default: 'GET' },
        { name: 'url', type: 'string', default: '' },
        { name: 'timeout', type: 'number', default: 30 },
      ],
    },
    nodeWithoutDefaults: {
      name: 'nodeWithoutDefaults',
      displayName: 'No Defaults',
      properties: [{ name: 'foo', type: 'string' }], // no default
    },
  },
}));

// --- Mock skill node types ---------------------------------------------------

vi.mock('../../nodeDefinitions/skillNodes', () => ({
  SKILL_NODE_TYPES: ['masterSkill', 'customSkill'],
}));

// --- Mock WebSocket context --------------------------------------------------

const wsMock = {
  isConnected: true,
  getNodeParameters: vi.fn(),
  saveNodeParameters: vi.fn(),
  sendRequest: vi.fn(),
};
vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocket: () => wsMock,
}));


function selectNode(node: any | null) {
  storeState.selectedNode = node;
  storeState.setSelectedNode = vi.fn();
}


beforeEach(() => {
  selectNode(null);
  wsMock.getNodeParameters.mockReset();
  wsMock.saveNodeParameters.mockReset();
  wsMock.sendRequest.mockReset();
  // Default: backend has nothing saved
  wsMock.getNodeParameters.mockResolvedValue(null);
  wsMock.saveNodeParameters.mockResolvedValue(true);
});


describe('initial parameter loading', () => {
  it('returns empty params when no node is selected', () => {
    const { result } = renderHook(() => useParameterPanel());
    expect(result.current.parameters).toEqual({});
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('loads defaults from nodeDefinition.properties when DB has nothing', async () => {
    selectNode({ id: 'n-1', type: 'httpRequest' });

    const { result } = renderHook(() => useParameterPanel());

    await waitFor(() => {
      expect(result.current.parameters.method).toBe('GET');
    });
    expect(result.current.parameters.url).toBe('');
    expect(result.current.parameters.timeout).toBe(30);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('uses null when a property has no default', async () => {
    selectNode({ id: 'n-1', type: 'nodeWithoutDefaults' });

    const { result } = renderHook(() => useParameterPanel());

    await waitFor(() => {
      expect(result.current.parameters).toHaveProperty('foo');
    });
    expect(result.current.parameters.foo).toBeNull();
  });

  it('merges saved params over defaults (saved wins)', async () => {
    wsMock.getNodeParameters.mockResolvedValue({
      parameters: { method: 'POST', url: 'https://api.example.com' },
      version: 1,
      timestamp: Date.now(),
    });

    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());

    await waitFor(() => {
      expect(result.current.parameters.method).toBe('POST');
    });
    expect(result.current.parameters.url).toBe('https://api.example.com');
    expect(result.current.parameters.timeout).toBe(30); // default kept
  });

  it('falls back to defaults and surfaces error on WebSocket failure', async () => {
    wsMock.getNodeParameters.mockRejectedValue(new Error('WS down'));

    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.parameters.method).toBe('GET');
  });
});


describe('hasUnsavedChanges and handleParameterChange', () => {
  it('starts false and flips true after a parameter change', async () => {
    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());

    await waitFor(() => expect(result.current.parameters.method).toBe('GET'));
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => {
      result.current.handleParameterChange('method', 'POST');
    });

    expect(result.current.parameters.method).toBe('POST');
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('flips back to false when the value is reverted to original', async () => {
    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.parameters.method).toBe('GET'));

    act(() => result.current.handleParameterChange('method', 'POST'));
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.handleParameterChange('method', 'GET'));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});


describe('handleSave', () => {
  it('saves to WebSocket and updates originalParameters on success', async () => {
    selectNode({ id: 'n-42', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.parameters.method).toBe('GET'));

    act(() => result.current.handleParameterChange('method', 'PUT'));
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await result.current.handleSave();
    });

    expect(wsMock.saveNodeParameters).toHaveBeenCalledWith(
      'n-42',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces error and keeps unsaved state when save returns false', async () => {
    wsMock.saveNodeParameters.mockResolvedValue(false);

    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.parameters.method).toBe('GET'));

    act(() => result.current.handleParameterChange('method', 'POST'));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBe('Failed to save parameters');
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('handles save rejection without throwing', async () => {
    wsMock.saveNodeParameters.mockRejectedValue(new Error('boom'));

    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.parameters.method).toBe('GET'));

    act(() => result.current.handleParameterChange('method', 'POST'));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.error).toBe('Failed to save parameters');
  });
});


describe('handleCancel', () => {
  it('reverts pending edits and clears selection', async () => {
    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.parameters.method).toBe('GET'));

    act(() => result.current.handleParameterChange('method', 'DELETE'));
    expect(result.current.parameters.method).toBe('DELETE');

    act(() => result.current.handleCancel());

    expect(result.current.parameters.method).toBe('GET');
    expect(storeState.setSelectedNode).toHaveBeenCalledWith(null);
  });
});


describe('nodeDefinition exposure', () => {
  it('exposes the matching node definition', async () => {
    selectNode({ id: 'n-1', type: 'httpRequest' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.nodeDefinition).toBeTruthy());
    expect(result.current.nodeDefinition?.displayName).toBe('HTTP Request');
  });

  it('returns falsy nodeDefinition for unknown node type', async () => {
    selectNode({ id: 'n-1', type: 'unknownType' });
    const { result } = renderHook(() => useParameterPanel());
    await waitFor(() => expect(result.current.parameters).toEqual({}));
    // nodeDefinitions[unknownType] is undefined; hook returns it as-is
    expect(result.current.nodeDefinition).toBeFalsy();
  });
});
