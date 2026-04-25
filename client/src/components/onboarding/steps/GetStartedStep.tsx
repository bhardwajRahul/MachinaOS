import React from 'react';
import { Play, FlaskConical, BookOpen, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type NodeRole = 'skill' | 'agent' | 'model' | 'workflow';

const ROLE_CLASSES: Record<NodeRole, { card: string; text: string }> = {
  skill:    { card: 'bg-node-skill-soft border-node-skill-border',       text: 'text-node-skill' },
  agent:    { card: 'bg-node-agent-soft border-node-agent-border',       text: 'text-node-agent' },
  model:    { card: 'bg-node-model-soft border-node-model-border',       text: 'text-node-model' },
  workflow: { card: 'bg-node-workflow-soft border-node-workflow-border', text: 'text-node-workflow' },
};

type Tip = {
  Icon: typeof Play;
  title: string;
  desc: React.ReactNode;
  role: NodeRole;
};

const tips: Tip[] = [
  {
    Icon: Play,
    title: 'Try an Example Workflow',
    desc: 'Open the sidebar and click on one of the pre-loaded example workflows to see how things work.',
    role: 'skill',
  },
  {
    Icon: FlaskConical,
    title: 'Build Your First Workflow',
    desc: (
      <>
        Quick recipe: drag{' '}
        <Badge variant="outline" className="mx-0.5 text-[10px]">Chat Trigger</Badge>
        <span className="text-xs text-muted-foreground">{'→'}</span>{' '}
        <Badge variant="outline" className="mx-0.5 text-[10px]">Zeenie</Badge>
        <span className="text-xs text-muted-foreground">{'→'}</span>{' '}
        <Badge variant="outline" className="mx-0.5 text-[10px]">Claude Model</Badge>
        {' '}then click{' '}
        <Badge variant="success" className="mx-0.5 text-[10px]">Run</Badge>
      </>
    ),
    role: 'agent',
  },
  {
    Icon: BookOpen,
    title: 'Explore AI Skills',
    desc: 'Use the Master Skill node to browse and enable built-in skills for your AI agents.',
    role: 'model',
  },
  {
    Icon: Settings,
    title: 'Revisit This Guide',
    desc: 'You can replay this welcome guide anytime from Settings.',
    role: 'workflow',
  },
];

const GetStartedStep: React.FC = () => {
  return (
    <div className="py-1">
      <div className="mb-4 text-center">
        <h4 className="m-0 mb-1 text-lg font-semibold">Get Started</h4>
        <p className="text-xs text-muted-foreground">
          Here are some things to try first
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {tips.map(({ Icon, title, desc, role }, i) => {
          const classes = ROLE_CLASSES[role];
          return (
            <Card key={i} className={classes.card}>
              <CardContent className="flex items-start gap-2.5 p-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${classes.card}`}>
                  <Icon className={`h-3.5 w-3.5 ${classes.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`mb-0.5 text-sm font-semibold ${classes.text}`}>
                    {title}
                  </div>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GetStartedStep;
