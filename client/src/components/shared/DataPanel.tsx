import React, { ReactNode } from 'react';

// Compound Component Pattern
interface DataPanelProps {
  children: ReactNode;
}

interface HeaderProps {
  title: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
}

interface ContentProps {
  children: ReactNode;
}

interface FooterProps {
  children: ReactNode;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

const DataPanelRoot: React.FC<DataPanelProps> = ({ children }) => (
  <div className="flex h-full w-[350px] flex-col border-l border-border bg-card">
    {children}
  </div>
);

const DataPanelHeader: React.FC<HeaderProps> = ({ title, extra, children }) => (
  <div className="border-b border-border bg-card">
    <div className="flex items-center justify-between gap-2 p-2 text-sm font-semibold">
      <div>{title}</div>
      {extra && <div>{extra}</div>}
    </div>
    {children && <div className="p-2">{children}</div>}
  </div>
);

const DataPanelContent: React.FC<ContentProps> = ({ children }) => (
  <div className="flex-1 overflow-y-auto p-2">{children}</div>
);

const DataPanelFooter: React.FC<FooterProps> = ({ children }) => (
  <div className="border-t border-border bg-card p-2 text-center">
    {children}
  </div>
);

const DataPanelEmpty: React.FC<EmptyStateProps> = ({ icon, title, description }) => (
  <div className="flex h-full w-[350px] flex-col items-center justify-center border-l border-border bg-card p-6 text-center">
    <div className="mb-3 text-muted-foreground">{icon}</div>
    <div className="text-sm text-muted-foreground">{title}</div>
    <div className="mt-1 text-xs text-muted-foreground">{description}</div>
  </div>
);

// Compound Component Export
const DataPanel = {
  Root: DataPanelRoot,
  Header: DataPanelHeader,
  Content: DataPanelContent,
  Footer: DataPanelFooter,
  Empty: DataPanelEmpty
};

export default DataPanel;
