/**
 * FieldRenderer — generic schema-driven field renderer (n8n CredentialInputs pattern).
 * Takes a FieldDef[] array + the form shim from useCredentialPanel.
 */

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDef } from '../types';

interface CredentialFormShim {
  getFieldValue: (key: string) => string | undefined;
  setFieldValue: (key: string, value: string) => void;
}

interface Props {
  fields: FieldDef[];
  form: CredentialFormShim;
}

const FieldRenderer: React.FC<Props> = ({ fields, form }) => {
  return (
    <div className="flex w-full flex-col gap-3">
      {fields.map((f) => (
        <FieldRow key={f.key} field={f} form={form} />
      ))}
    </div>
  );
};

interface FieldRowProps {
  field: FieldDef;
  form: CredentialFormShim;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, form }) => {
  const [revealed, setRevealed] = useState(false);
  const value = form.getFieldValue(field.key) ?? '';
  const isSecret = !!field.secret;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`field-${field.key}`} className="text-xs">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={`field-${field.key}`}
          type={isSecret && !revealed ? 'password' : 'text'}
          value={value}
          onChange={(e) => form.setFieldValue(field.key, e.target.value)}
          placeholder={field.placeholder}
          className={isSecret ? 'font-mono pr-9' : 'font-mono'}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={revealed ? 'Hide value' : 'Show value'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldRenderer;
