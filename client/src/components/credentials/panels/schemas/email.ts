import { z } from 'zod';

export const PROVIDER_OPTIONS = [
  { label: 'Gmail', value: 'gmail' },
  { label: 'Outlook / Office 365', value: 'outlook' },
  { label: 'Yahoo Mail', value: 'yahoo' },
  { label: 'iCloud Mail', value: 'icloud' },
  { label: 'ProtonMail (Bridge)', value: 'protonmail' },
  { label: 'Fastmail', value: 'fastmail' },
  { label: 'Custom / Self-hosted', value: 'custom' },
] as const;

export const AUTH_NOTES: Record<string, string> = {
  gmail: 'Use an App Password from Google Account > Security > 2-Step Verification.',
  outlook: 'Use your account password or an App Password.',
  yahoo: 'Use an App Password from Yahoo Account Security.',
  icloud: 'Use an App-Specific Password from your Apple ID.',
  protonmail: 'Requires ProtonMail Bridge running locally (127.0.0.1).',
  fastmail: 'Use an App Password from Settings > Privacy & Security.',
  custom: 'Enter credentials for your self-hosted IMAP/SMTP server below.',
};

const PROVIDER_VALUES = PROVIDER_OPTIONS.map((p) => p.value) as [string, ...string[]];

/**
 * Build a zod schema for the email form. Password is required only when no
 * credential is stored yet (toggle via the `passwordRequired` flag).
 */
export function createEmailFormSchema(passwordRequired: boolean) {
  return z
    .object({
      provider: z.enum(PROVIDER_VALUES),
      address: z
        .string()
        .min(1, 'Email address is required')
        .pipe(z.email('Enter a valid email address')),
      password: passwordRequired
        ? z.string().min(1, 'Password is required')
        : z.string().optional(),
      imapHost: z.string().optional(),
      imapPort: z.number().int().min(1).max(65535).optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.number().int().min(1).max(65535).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.provider !== 'custom') return;
      if (!data.imapHost?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['imapHost'],
          message: 'IMAP host is required for custom provider',
        });
      }
      if (!data.smtpHost?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['smtpHost'],
          message: 'SMTP host is required for custom provider',
        });
      }
    });
}

export type EmailFormValues = z.infer<ReturnType<typeof createEmailFormSchema>>;
