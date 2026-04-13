import React from 'react';
import { LayoutGrid, GitBranch, Bot, Wrench, ArrowLeftRight } from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';

const ConceptsStep: React.FC = () => {
  const theme = useAppTheme();

  const concepts = [
    {
      Icon: LayoutGrid,
      title: 'Nodes',
      desc: 'Building blocks of your workflow. Each node performs a specific action like sending a message, calling an AI model, or processing data.',
      color: theme.dracula.cyan,
    },
    {
      Icon: GitBranch,
      title: 'Edges',
      desc: "Connections between nodes that define data flow. Drag from one node's output to another's input to connect them.",
      color: theme.dracula.green,
    },
    {
      Icon: Bot,
      title: 'AI Agents',
      desc: 'Intelligent nodes that use LLMs (Claude, GPT, Gemini) to reason, call tools, and complete tasks autonomously.',
      color: theme.dracula.purple,
    },
    {
      Icon: Wrench,
      title: 'Skills & Tools',
      desc: 'Connect skills and tools to agents to extend their capabilities. Skills provide instructions, tools provide actions.',
      color: theme.dracula.orange,
    },
    {
      Icon: ArrowLeftRight,
      title: 'Normal vs Dev Mode',
      desc: 'Normal mode shows AI-focused nodes for simple workflows. Dev mode unlocks all 108+ nodes for advanced automation.',
      color: theme.dracula.pink,
    },
  ];

  return (
    <div className="py-1">
      <div className="mb-4 text-center">
        <h4 className="m-0 mb-1 text-lg font-semibold">Key Concepts</h4>
        <p className="text-xs text-muted-foreground">
          Understanding these will help you build powerful workflows
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {concepts.map((c) => (
          <div
            key={c.title}
            className="flex items-start gap-3 rounded-md border p-3"
            style={{
              backgroundColor: `${c.color}10`,
              borderColor: `${c.color}25`,
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${c.color}20`, color: c.color }}
            >
              <c.Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-sm font-semibold" style={{ color: c.color }}>
                {c.title}
              </div>
              <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                {c.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConceptsStep;
