/**
 * Canvas-wide animation + status styles injected once into <style> by
 * Dashboard. Split into named groups so a new status visual or keyframe
 * can be added without touching Dashboard.tsx.
 *
 *   KEYFRAMES                -- @keyframes definitions
 *   edgeStatusStyles(...)    -- .react-flow__edge.{selected,executing,...}
 *   nodeStatusStyles(...)    -- .react-flow__node.{executing,...}
 *   buildCanvasStyles(...)   -- composes the three for Dashboard
 *
 * Per-node inline animations (border pulse, etc.) live in their own
 * components and read theme tokens directly; this module is for
 * canvas-wide rules that need to match React Flow's wrapper classes.
 */

export interface CanvasStatusColors {
  edgeDefault: string;
  edgeSelected: string;
  edgeExecuting: string;
  edgeCompleted: string;
  edgeError: string;
}

const KEYFRAMES = `
  @keyframes dashFlow {
    0% { stroke-dashoffset: 24; }
    100% { stroke-dashoffset: 0; }
  }

  @keyframes nodeGlowDark {
    0%, 100% { filter: drop-shadow(0 0 8px var(--node-glow)) drop-shadow(0 0 16px var(--node-glow-soft)); }
    50%      { filter: drop-shadow(0 0 14px var(--node-glow)) drop-shadow(0 0 24px var(--node-glow)); }
  }

  @keyframes nodeGlowLight {
    0%, 100% { filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.8)) drop-shadow(0 0 20px rgba(37, 99, 235, 0.6)); }
    50%      { filter: drop-shadow(0 0 16px rgba(37, 99, 235, 1))   drop-shadow(0 0 30px rgba(37, 99, 235, 0.8)); }
  }
`;

function edgeStatusStyles(colors: CanvasStatusColors, isDark: boolean): string {
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
    stroke: ${isDark ? colors.edgeExecuting : '#2563eb'} !important;
    stroke-width: 3px !important;
    stroke-dasharray: 8 4;
    animation: dashFlow 0.5s linear infinite;
  }

  .react-flow__edge.completed path {
    stroke: ${isDark ? colors.edgeCompleted : '#16a34a'} !important;
    stroke-width: 2px !important;
  }

  .react-flow__edge.error path {
    stroke: ${colors.edgeError} !important;
    stroke-width: 3px !important;
  }

  .react-flow__edge.pending path {
    stroke: ${isDark ? colors.edgeDefault : '#6b7280'} !important;
    stroke-width: 2px !important;
    stroke-dasharray: 8 4;
    animation: dashFlow 0.5s linear infinite;
  }

  .react-flow__edge.memory-active path {
    stroke: ${isDark ? '#ff79c6' : '#db2777'} !important;
    stroke-width: 3px !important;
  }

  .react-flow__edge.tool-active path {
    stroke: ${isDark ? '#ffb86c' : '#ea580c'} !important;
    stroke-width: 3px !important;
  }
`;
}

function nodeStatusStyles(colors: CanvasStatusColors, isDark: boolean): string {
  // --node-glow / --node-glow-soft are scoped vars consumed by the
  // nodeGlowDark keyframe, so the keyframe stays color-agnostic and
  // theme swaps don't require regenerating the keyframe text.
  const glow = colors.edgeExecuting;
  return `
  .react-flow__node.executing {
    --node-glow: ${glow};
    --node-glow-soft: ${glow}80;
    animation: ${isDark ? 'nodeGlowDark' : 'nodeGlowLight'} 1.2s ease-in-out infinite;
  }
`;
}

export function buildCanvasStyles(
  colors: CanvasStatusColors,
  isDark: boolean,
): string {
  return [
    edgeStatusStyles(colors, isDark),
    nodeStatusStyles(colors, isDark),
    KEYFRAMES,
  ].join('\n');
}
