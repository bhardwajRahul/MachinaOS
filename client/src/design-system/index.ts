/**
 * Owned design-system public API.
 *
 * Primitives replace antd equivalents. See docs-internal/ui_migration_plan.md.
 * Tokens: client/src/design-system/tokens/index.css (imported once in main.tsx).
 */

export { cn } from './lib/cn';

export { Button, buttonVariants } from './primitives/Button';
export type { ButtonProps } from './primitives/Button';

export { Badge, badgeVariants } from './primitives/Badge';
export type { BadgeProps } from './primitives/Badge';

export { Stack } from './primitives/Stack';
export type { StackProps } from './primitives/Stack';

export { Inline } from './primitives/Inline';
export type { InlineProps } from './primitives/Inline';

export { Spinner, SpinnerOverlay } from './primitives/Spinner';
export type { SpinnerProps, SpinnerOverlayProps } from './primitives/Spinner';

export { Alert, AlertTitle, AlertDescription } from './primitives/Alert';
export type { AlertProps } from './primitives/Alert';

export { Text } from './primitives/Text';
export type { TextProps } from './primitives/Text';

export { Heading } from './primitives/Heading';
export type { HeadingProps } from './primitives/Heading';

export { Toaster } from './primitives/Toaster';
export { toast } from './lib/toast';
export type { Toast } from './lib/toast';
