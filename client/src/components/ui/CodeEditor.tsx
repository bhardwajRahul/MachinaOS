import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import { useAppTheme } from '../../hooks/useAppTheme';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'python',
  placeholder
}) => {
  const theme = useAppTheme();

  const handleChange = (newValue: string) => {
    console.log('[CodeEditor] Value changed, length:', newValue.length);
    onChange(newValue);
  };

  const highlight = (code: string) => {
    const grammar = Prism.languages[language] || Prism.languages.python;
    return Prism.highlight(code, grammar, language);
  };

  return (
    <div style={{
      height: '100%',
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      border: `1px solid ${theme.colors.border}`
    }}>
      <style>{`
        .code-editor-container .token.comment { color: ${theme.dracula.comment}; }
        .code-editor-container .token.string { color: ${theme.dracula.yellow}; }
        .code-editor-container .token.keyword { color: ${theme.dracula.pink}; }
        .code-editor-container .token.function { color: ${theme.dracula.green}; }
        .code-editor-container .token.number { color: ${theme.dracula.purple}; }
        .code-editor-container .token.operator { color: ${theme.dracula.pink}; }
        .code-editor-container .token.class-name { color: ${theme.dracula.cyan}; }
        .code-editor-container .token.builtin { color: ${theme.dracula.cyan}; }
        .code-editor-container .token.boolean { color: ${theme.dracula.purple}; }
        .code-editor-container .token.punctuation { color: ${theme.colors.text}; }
        .code-editor-container textarea { outline: none !important; caret-color: ${theme.colors.text}; }
        .code-editor-container textarea::placeholder { color: ${theme.colors.textMuted}; }
      `}</style>
      <div className="code-editor-container" style={{ height: '100%' }}>
        <Editor
          value={value || ''}
          onValueChange={handleChange}
          highlight={highlight}
          placeholder={placeholder}
          padding={12}
          tabSize={4}
          insertSpaces={true}
          style={{
            fontFamily: "'Consolas', 'Monaco', 'Fira Code', monospace",
            fontSize: 13,
            lineHeight: 1.5,
            backgroundColor: theme.colors.backgroundAlt,
            color: theme.colors.text,
            minHeight: '100%',
            height: '100%',
            overflow: 'auto'
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
