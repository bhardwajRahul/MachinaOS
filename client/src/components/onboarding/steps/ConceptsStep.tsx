import React from 'react';
import { LayoutGrid, GitBranch, Bot, Wrench, ArrowLeftRight } from 'lucide-react';
import { NODE_ROLE_CLASSES, type NodeRole } from '../nodeRoleClasses';

const concepts: { Icon: typeof LayoutGrid; title: string; desc: string; role: NodeRole }[] = [
  {
    Icon: LayoutGrid,
    title: 'Nodes',
    desc: 'Building blocks of your workflow. Each node performs a specific action like sending a message, calling an AI model, or processing data.',
    role: 'model',
  },
  {
    Icon: GitBranch,
    title: 'Edges',
    desc: "Connections between nodes that define data flow. Drag from one node's output to another's input to connect them.",
    role: 'skill',
  },
  {
    Icon: Bot,
    title: 'AI Agents',
    desc: 'Intelligent nodes that use LLMs (Claude, GPT, Gemini) to reason, call tools, and complete tasks autonomously.',
    role: 'agent',
  },
  {
    Icon: Wrench,
    title: 'Skills & Tools',
    desc: 'Connect skills and tools to agents to extend their capabilities. Skills provide instructions, tools provide actions.',
    role: 'workflow',
  },
  {
    Icon: ArrowLeftRight,
    title: 'Normal vs Dev Mode',
    desc: 'Normal mode shows AI-focused nodes for simple workflows. Dev mode unlocks all 108+ nodes for advanced automation.',
    role: 'trigger',
  },
];

const ConceptsStep: React.FC = () => {
  return (
    <div className="py-1">
      <div className="mb-4 text-center">
        <h4 className="m-0 mb-1 text-lg font-semibold">Key Concepts</h4>
        <p className="text-xs text-muted-foreground">
          Understanding these will help you build powerful workflows
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {concepts.map((c) => {
          const classes = NODE_ROLE_CLASSES[c.role];
          return (
            <div
              key={c.title}
              className={`flex items-start gap-3 rounded-md border p-3 ${classes.card}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${classes.card}`}>
                <c.Icon className={`h-4 w-4 ${classes.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`mb-0.5 text-sm font-semibold ${classes.text}`}>
                  {c.title}
                </div>
                <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                  {c.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConceptsStep;
