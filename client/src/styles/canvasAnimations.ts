/**
 * Canvas-wide animation + status styles injected once into <style> by
 * Dashboard. Split into named groups so a new status visual or keyframe
 * can be added without touching Dashboard.tsx.
 *
 *   KEYFRAMES                -- @keyframes definitions (color-agnostic;
 *                               consume scoped --node-glow* CSS vars)
 *   edgeStatusStyles(...)    -- .react-flow__edge.{selected,executing,...}
 *   nodeStatusStyles(...)    -- .react-flow__node.{executing,...}
 *   buildCanvasStyles(...)   -- composes the three for Dashboard
 *
 * Per-node inline animations (border pulse, etc.) live in their own
 * components and read theme tokens directly; this module is for
 * canvas-wide rules that need to match React Flow's wrapper classes.
 *
 * The light vs dark distinction is encoded entirely in `colors` (the
 * theme object provides different values per mode), so this file knows
 * nothing about which theme is active.
 */

export interface CanvasStatusColors {
  edgeDefault: string;
  edgeSelected: string;
  edgeExecuting: string;
  edgeCompleted: string;
  edgeError: string;
  edgePending: string;
  edgeMemoryActive: string;
  edgeToolActive: string;
}

const KEYFRAMES = `
  @keyframes dashFlow {
    0% { stroke-dashoffset: 24; }
    100% { stroke-dashoffset: 0; }
  }

  @keyframes nodeGlow {
    0%, 100% { filter: drop-shadow(0 0 8px var(--node-glow)) drop-shadow(0 0 16px var(--node-glow-soft)); }
    50%      { filter: drop-shadow(0 0 14px var(--node-glow)) drop-shadow(0 0 24px var(--node-glow)); }
  }
`;

function edgeStatusStyles(colors: CanvasStatusColors): string {
  return `
  .react-flow__edge path {
    stroke: ${colors.edgeDefault} !important;
    stroke-width: 2px;
  }

  .react-flow__edge.selected path {
    stroke: ${colors.edgeSelected} !important;
    stroke-width: 4px !important;
  }

  .react-flow__edge.executing path {
    stroke: ${colors.edgeExecuting} !important;
    stroke-width: 3px !important;
    stroke-dasharray: 8 4;
    animation: dashFlow 0.5s linear infinite;
  }

  .react-flow__edge.completed path {
    stroke: ${colors.edgeCompleted} !important;
    stroke-width: 2px !important;
  }

  .react-flow__edge.error path {
    stroke: ${colors.edgeError} !important;
    stroke-width: 3px !important;
  }

  .react-flow__edge.pending path {
    stroke: ${colors.edgePending} !important;
    stroke-width: 2px !important;
    stroke-dasharray: 8 4;
    animation: dashFlow 0.5s linear infinite;
  }

  .react-flow__edge.memory-active path {
    stroke: ${colors.edgeMemoryActive} !important;
    stroke-width: 3px !important;
  }

  .react-flow__edge.tool-active path {
    stroke: ${colors.edgeToolActive} !important;
    stroke-width: 3px !important;
  }
`;
}

function nodeStatusStyles(colors: CanvasStatusColors): string {
  // --node-glow / --node-glow-soft are scoped vars consumed by the
  // nodeGlow keyframe, so the keyframe stays color-agnostic and theme
  // swaps don't require regenerating the keyframe text.
  const glow = colors.edgeExecuting;
  return `
  .react-flow__node.executing {
    --node-glow: ${glow};
    --node-glow-soft: ${glow}80;
    animation: nodeGlow 1.2s ease-in-out infinite;
  }
`;
}

export function buildCanvasStyles(colors: CanvasStatusColors): string {
  return [
    edgeStatusStyles(colors),
    nodeStatusStyles(colors),
    KEYFRAMES,
  ].join('\n');
}
