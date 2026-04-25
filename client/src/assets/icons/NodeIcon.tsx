/**
 * NodeIcon — single icon-rendering primitive.
 *
 * Resolves any backend-declared icon string (`lobehub:Claude`,
 * `asset:gmail`, `lucide:Battery`, emoji, URL, data URI) and renders
 * it inside a wrapper sized by Tailwind classes. The lucide / image
 * branches stretch to fill the wrapper; the emoji/text branch
 * inherits the wrapper's font size.
 *
 * The wrapper does NOT apply a parent color to the resolved icon.
 * Each icon source carries its own color contract:
 *   - lobehub `.Color` SVGs: multi-color brand artwork (some paths
 *     use `currentColor` — applying a parent `color` would mono-tint
 *     the brand mark, which is wrong)
 *   - asset SVGs: explicit per-path fills (`<img>` is immune to
 *     parent CSS color)
 *   - lucide icons: stroke-based currentColor (used for monochrome
 *     glyphs only — backend nodes ship colored asset SVGs instead)
 *   - emoji / text: native glyph color
 *
 * Sites that need a tinted backdrop set `style={{ color: brandColor }}`
 * on their parent container alongside `bg-tint-soft` / `border-tint`;
 * NodeIcon sits inside without contributing to the color cascade.
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
  /** Element rendered when the icon ref does not resolve. */
  fallback?: React.ReactNode;
}

export const NodeIcon: React.FC<NodeIconProps> = ({
  icon,
  className,
  fallback = null,
}) => {
  let inner: React.ReactNode;
  const LibIcon = resolveLibraryIcon(icon);
  if (LibIcon) {
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
    <span className={cn('inline-flex items-center justify-center', className)}>
      {inner}
    </span>
  );
};

export default NodeIcon;
