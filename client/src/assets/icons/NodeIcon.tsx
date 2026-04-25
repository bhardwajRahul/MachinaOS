/**
 * NodeIcon — single icon-rendering primitive.
 *
 * Resolves any backend-declared icon string (`lucide:Battery`,
 * `lobehub:Claude`, `asset:gmail`, emoji, URL, data URI) and renders
 * it inside a wrapper sized by Tailwind classes. The lucide / image
 * branches stretch to fill the wrapper; the emoji/text branch
 * inherits the wrapper's font size.
 *
 * The wrapper carries `currentColor` from the optional `color` prop
 * so lucide icons (which use `currentColor` for stroke) pick up the
 * brand color. Image and lobehub `.Color` icons use explicit fills
 * and ignore `color` — safe to pass at every call site.
 *
 * Replaces the per-file `renderIcon` / `getServiceIcon` /
 * `renderSkillIcon` helpers and the catalogue-adapter icon factory
 * so the resolver branches live in one place and call sites use
 * Tailwind sizing tokens (`h-6 w-6 text-2xl`) instead of pixel
 * literals.
 */

import * as React from 'react';

import { cn } from '@/lib/utils';
import { resolveIcon, resolveLibraryIcon, isImageIcon } from '.';

export interface NodeIconProps {
  /** Backend-declared icon string. May be undefined while the spec
   *  cache hydrates — the component renders the fallback in that case. */
  icon: string | undefined | null;
  /** Wrapper class. Use Tailwind sizing tokens for the box (`h-6 w-6`)
   *  and a `text-X` class to size the emoji/text branch. */
  className?: string;
  /** Brand color forwarded as currentColor (e.g. node `defaults.color`,
   *  provider `color`, skill `color`). Lucide picks it up for stroke;
   *  image / lobehub `.Color` icons ignore it. */
  color?: string;
  /** Element rendered when the icon ref does not resolve. */
  fallback?: React.ReactNode;
}

export const NodeIcon: React.FC<NodeIconProps> = ({
  icon,
  className,
  color,
  fallback = null,
}) => {
  let inner: React.ReactNode;
  const LibIcon = resolveLibraryIcon(icon);
  if (LibIcon) {
    // Lucide accepts className; `h-full w-full` makes the SVG fill the
    // wrapper, so size flows from the wrapper's Tailwind sizing class.
    inner = <LibIcon className="h-full w-full" />;
  } else {
    const resolved = resolveIcon(icon);
    if (!resolved) {
      inner = fallback;
    } else if (isImageIcon(resolved)) {
      inner = <img src={resolved} alt="" className="h-full w-full object-contain" />;
    } else {
      // Emoji / short text — inherits font-size from the wrapper's
      // `text-X` class.
      inner = <span className="leading-none">{resolved}</span>;
    }
  }
  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      style={color ? { color } : undefined}
    >
      {inner}
    </span>
  );
};

export default NodeIcon;
