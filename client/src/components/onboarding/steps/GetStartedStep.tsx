import React from 'react';
import { Play, FlaskConical, BookOpen, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppTheme } from '../../../hooks/useAppTheme';

const GetStartedStep: React.FC = () => {
  const theme = useAppTheme();

  const tips = [
    {
      Icon: Play,
      title: 'Try an Example Workflow',
      desc: 'Open the sidebar and click on one of the pre-loaded example workflows to see how things work.',
      color: theme.dracula.green,
    },
    {
      Icon: FlaskConical,
      title: 'Build Your First Workflow',
      desc: (
        <>
          Quick recipe: drag{' '}
          <Badge variant="outline" className="mx-0.5 text-[10px]">Chat Trigger</Badge>
          <span className="text-xs text-muted-foreground">{'\u2192'}</span>{' '}
          <Badge variant="outline" className="mx-0.5 text-[10px]">Zeenie</Badge>
          <span className="text-xs text-muted-foreground">{'\u2192'}</span>{' '}
          <Badge variant="outline" className="mx-0.5 text-[10px]">Claude Model</Badge>
          {' '}then click{' '}
          <Badge variant="success" className="mx-0.5 text-[10px]">Run</Badge>
        </>
      ),
      color: theme.dracula.purple,
    },
    {
      Icon: BookOpen,
      title: 'Explore AI Skills',
      desc: 'Use the Master Skill node to browse and enable built-in skills for your AI agents.',
      color: theme.dracula.cyan,
    },
    {
      Icon: Settings,
      title: 'Revisit This Guide',
      desc: 'You can replay this welcome guide anytime from Settings.',
      color: theme.dracula.orange,
    },
  ];

  return (
    <div className="py-1">
      <div className="mb-4 text-center">
        <h4 className="m-0 mb-1 text-lg font-semibold">Get Started</h4>
        <p className="text-xs text-muted-foreground">
          Here are some things to try first
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {tips.map(({ Icon, title, desc, color }, i) => (
          <Card
            key={i}
            style={{
              borderColor: `${color}30`,
              backgroundColor: `${color}08`,
            }}
          >
            <CardContent className="flex items-start gap-2.5 p-3">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-sm font-semibold" style={{ color }}>
                  {title}
                </div>
                <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GetStartedStep;
