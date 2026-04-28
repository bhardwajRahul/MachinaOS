/**
 * Tests for OutputPanel.
 *
 * Locks in:
 *   - Empty state when no nodes connect to this node
 *   - Connected nodes are listed (one per incoming edge to a non-config handle)
 *   - Config-handle edges (input-memory/tools/skill) are NOT listed
 *   - Memory/tool config nodes inherit parent's main inputs
 *   - Drag-start sets text/plain to `{{templateName.outputName}}`
 *   - Android nodes expose flattened schema entries as draggable outputs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks -----------------------------------------------------------------

const storeState: { currentWorkflow: any } = { currentWorkflow: null };
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => storeState,
}));

vi.mock('../../hooks/useDragVariable', () => ({
  useDragVariable: () => ({
    handleVariableDragStart: vi.fn(),
    getTemplateVariableName: (id: string) => {
      const node = storeState.currentWorkflow?.nodes?.find((n: any) => n.id === id);
      return (node?.data?.label || node?.type || id).toLowerCase().replace(/\s+/g, '');
    },
  }),
}));

vi.mock('../../hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    isDarkMode: false,
    colors: {
      background: '#fff',
      text: '#000',
      border: '#ddd',
      textSecondary: '#666',
      backgroundAlt: '#fafafa',
      backgroundPanel: '#f5f5f5',
      primary: '#1890ff',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 18 },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    borderRadius: { sm: 4, md: 6, lg: 8 },
    transitions: { fast: '0.15s ease', medium: '0.3s ease' },
    dracula: {
      purple: '#bd93f9',
      cyan: '#8be9fd',
      green: '#50fa7b',
      pink: '#ff79c6',
      yellow: '#f1fa8c',
      orange: '#ffb86c',
      red: '#ff5555',
    },
    accent: { blue: '#268bd2', cyan: '#2aa198' },
  }),
}));

vi.mock('../../nodeDefinitions', () => ({
  nodeDefinitions: {
    httpRequest: {
      name: 'httpRequest',
      displayName: 'HTTP Request',
      group: ['utility'],
      outputs: ['response'],
    },
    cronScheduler: {
      name: 'cronScheduler',
      displayName: 'Cron Scheduler',
      group: ['scheduler'],
      outputs: ['data'],
    },
    aiAgent: {
      name: 'aiAgent',
      displayName: 'AI Agent',
      group: ['agent'],
    },
    simpleMemory: {
      name: 'simpleMemory',
      displayName: 'Simple Memory',
      group: ['memory'],
    },
    calculatorTool: {
      name: 'calculatorTool',
      displayName: 'Calculator',
      group: ['tool'],
    },
    batteryMonitor: {
      name: 'batteryMonitor',
      displayName: 'Battery Monitor',
      group: ['android'],
    },
  },
}));

import OutputPanel from '../OutputPanel';


function setWorkflow(nodes: any[], edges: any[]) {
  storeState.currentWorkflow = {
    id: 'wf-1',
    name: 'wf',
    nodes,
    edges,
    createdAt: new Date(),
    lastModified: new Date(),
  };
}


beforeEach(() => {
  storeState.currentWorkflow = null;
});


describe('OutputPanel -- empty state', () => {
  it('renders empty placeholder when no edges target this node', () => {
    setWorkflow([{ id: 'n-1', type: 'aiAgent', data: {}, position: { x: 0, y: 0 } }], []);
    render(<OutputPanel nodeId="n-1" />);
    // Component renders an empty-state container; assert no connected node names show
    expect(screen.queryByText(/HTTP Request/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cron Scheduler/)).not.toBeInTheDocument();
  });

  it('renders empty when workflow is null', () => {
    storeState.currentWorkflow = null;
    const { container } = render(<OutputPanel nodeId="n-1" />);
    expect(container.textContent).not.toContain('HTTP Request');
  });
});


describe('OutputPanel -- listing connected nodes', () => {
  it('lists connected node via input-main edge', () => {
    setWorkflow(
      [
        { id: 'src', type: 'httpRequest', data: { label: 'HTTP' }, position: { x: 0, y: 0 } },
        { id: 'tgt', type: 'aiAgent', data: { label: 'Agent' }, position: { x: 100, y: 0 } },
      ],
      [
        {
          id: 'e1',
          source: 'src',
          target: 'tgt',
          sourceHandle: 'output',
          targetHandle: 'input-main',
        },
      ],
    );

    render(<OutputPanel nodeId="tgt" />);
    expect(screen.getByText(/HTTP Request/)).toBeInTheDocument();
  });

  it('SKIPS edges on config handles (input-memory/tools/skill/model)', () => {
    setWorkflow(
      [
        { id: 'mem', type: 'simpleMemory', data: { label: 'Mem' }, position: { x: 0, y: 0 } },
        { id: 'tool', type: 'calculatorTool', data: { label: 'Calc' }, position: { x: 0, y: 50 } },
        { id: 'tgt', type: 'aiAgent', data: { label: 'Agent' }, position: { x: 100, y: 0 } },
      ],
      [
        { id: 'e1', source: 'mem', target: 'tgt', sourceHandle: 'output', targetHandle: 'input-memory' },
        { id: 'e2', source: 'tool', target: 'tgt', sourceHandle: 'output', targetHandle: 'input-tools' },
      ],
    );

    render(<OutputPanel nodeId="tgt" />);
    expect(screen.queryByText(/Simple Memory/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Calculator/)).not.toBeInTheDocument();
  });

  it('KEEPS input-task edges (data flow)', () => {
    setWorkflow(
      [
        { id: 'src', type: 'httpRequest', data: {}, position: { x: 0, y: 0 } },
        { id: 'tgt', type: 'aiAgent', data: {}, position: { x: 100, y: 0 } },
      ],
      [{ id: 'e1', source: 'src', target: 'tgt', sourceHandle: 'output', targetHandle: 'input-task' }],
    );

    render(<OutputPanel nodeId="tgt" />);
    expect(screen.getByText(/HTTP Request/)).toBeInTheDocument();
  });

  it("inherits parent agent's main inputs when current node is a memory node", () => {
    setWorkflow(
      [
        { id: 'src', type: 'cronScheduler', data: {}, position: { x: 0, y: 0 } },
        { id: 'mem', type: 'simpleMemory', data: {}, position: { x: 50, y: 0 } },
        { id: 'agent', type: 'aiAgent', data: {}, position: { x: 100, y: 0 } },
      ],
      [
        { id: 'e1', source: 'mem', target: 'agent', sourceHandle: 'output', targetHandle: 'input-memory' },
        { id: 'e2', source: 'src', target: 'agent', sourceHandle: 'output', targetHandle: 'input-main' },
      ],
    );

    render(<OutputPanel nodeId="mem" />);
    // Parent's main input (Cron Scheduler) should appear with "(via AI Agent)" label
    expect(screen.getByText(/Cron Scheduler.*via AI Agent/)).toBeInTheDocument();
  });
});


describe('OutputPanel -- drag-and-drop', () => {
  it('sets text/plain dataTransfer on drag-start with template variable format', async () => {
    setWorkflow(
      [
        { id: 'src', type: 'httpRequest', data: { label: 'My HTTP' }, position: { x: 0, y: 0 } },
        { id: 'tgt', type: 'aiAgent', data: {}, position: { x: 100, y: 0 } },
      ],
      [{ id: 'e1', source: 'src', target: 'tgt', sourceHandle: 'output', targetHandle: 'input-main' }],
    );

    const { container } = render(<OutputPanel nodeId="tgt" />);

    // Expand the node so outputs are draggable
    const headerBtn = screen.getByText(/HTTP Request/);
    await userEvent.click(headerBtn);

    // Find a draggable output element
    const draggables = container.querySelectorAll('[draggable="true"]');
    expect(draggables.length).toBeGreaterThan(0);

    const setData = vi.fn();
    const dragEvent = new Event('dragstart', { bubbles: true }) as any;
    dragEvent.dataTransfer = { setData, effectAllowed: '' };

    draggables[0].dispatchEvent(dragEvent);

    // The first output is `response` (per node definition mock)
    expect(setData).toHaveBeenCalledWith('text/plain', '{{myhttp.response}}');
  });
});


describe('OutputPanel -- Android node schema flattening', () => {
  it('exposes batteryMonitor schema fields as individual outputs', async () => {
    setWorkflow(
      [
        { id: 'bat', type: 'batteryMonitor', data: { label: 'Bat' }, position: { x: 0, y: 0 } },
        { id: 'tgt', type: 'aiAgent', data: {}, position: { x: 100, y: 0 } },
      ],
      [{ id: 'e1', source: 'bat', target: 'tgt', sourceHandle: 'output', targetHandle: 'input-main' }],
    );

    render(<OutputPanel nodeId="tgt" />);

    // Expand the connected battery node
    await userEvent.click(screen.getByText(/Battery Monitor/));

    // Should see flattened, human-readable battery fields
    expect(screen.getByText(/Battery Level/i)).toBeInTheDocument();
    expect(screen.getByText(/Is Charging/i)).toBeInTheDocument();
    expect(screen.getByText(/Temperature Celsius/i)).toBeInTheDocument();
  });
});
