/**
 * ApiKeyInput - Reusable API key input component with central theming
 */

import React, { useState } from 'react';
import { Eye, EyeOff, Save, Trash2, CheckCircle, Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  placeholder?: string;
  loading?: boolean;
  isStored?: boolean | null;
  disabled?: boolean;
  saveLabel?: string;
  savedLabel?: string;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  value,
  onChange,
  onSave,
  onDelete,
  placeholder = 'Enter API key...',
  loading = false,
  isStored = false,
  disabled = false,
  saveLabel = 'Validate',
  savedLabel = 'Valid',
}) => {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex w-full items-stretch gap-1">
      <div className="relative flex-1">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono pr-9"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? 'Hide key' : 'Show key'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Button
        variant="outline"
        onClick={onSave}
        disabled={!value.trim() || disabled || loading}
        style={{
          backgroundColor: `${theme.dracula.green}25`,
          borderColor: `${theme.dracula.green}60`,
          color: theme.dracula.green,
        }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isStored ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {isStored ? savedLabel : saveLabel}
      </Button>

      {isStored && onDelete && (
        <Button
          variant="outline"
          size="icon"
          onClick={onDelete}
          disabled={disabled}
          style={{
            backgroundColor: `${theme.dracula.pink}25`,
            borderColor: `${theme.dracula.pink}60`,
            color: theme.dracula.pink,
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default ApiKeyInput;
