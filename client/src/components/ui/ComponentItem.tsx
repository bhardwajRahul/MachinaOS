import React, { useState } from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import { INodeTypeDescription } from '../../types/INodeProperties';

interface ComponentItemProps {
  definition: INodeTypeDescription;
  onDragStart: (event: React.DragEvent, definition: INodeTypeDescription) => void;
}

const ComponentItem: React.FC<ComponentItemProps> = ({ definition, onDragStart }) => {
  const theme = useAppTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Helper to get colors from new interface format
  const getNodeColor = () => definition.defaults.color || '#9E9E9E';
  const isImageIcon = () => {
    const icon = definition.icon;
    return icon && (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/'));
  };
  const getIconBackground = () => isImageIcon() ? theme.colors.backgroundAlt : getNodeColor();
  const getBorderColor = () => {
    // Create a darker shade for border
    const color = getNodeColor();
    // Simple color darkening - could be enhanced
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 40);
      const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 40);
      const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 40);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return color;
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e, definition);
      }}
      onDragEnd={() => setIsDragging(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '12px',
        backgroundColor: theme.colors.background,
        border: `2px solid ${isHovered ? getBorderColor() : theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        cursor: 'grab',
        transition: `all ${theme.transitions.fast}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: isHovered
          ? theme.isDarkMode
            ? `0 4px 12px ${getNodeColor()}25, 0 0 0 1px ${getNodeColor()}15`
            : `0 4px 12px ${getNodeColor()}30, 0 0 0 1px ${getNodeColor()}20`
          : theme.isDarkMode
            ? `0 1px 3px ${theme.colors.shadowLight}`
            : `0 1px 4px rgba(0,0,0,0.08)`,
        transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0)',
        opacity: isDragging ? 0.5 : 1,
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gradient Background on Hover */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.isDarkMode
          ? `linear-gradient(135deg, ${getNodeColor()}08 0%, ${getNodeColor()}12 100%)`
          : `linear-gradient(135deg, ${getNodeColor()}06 0%, ${getNodeColor()}12 100%)`,
        opacity: isHovered ? 1 : 0,
        transition: `opacity ${theme.transitions.fast}`,
        pointerEvents: 'none',
      }} />
      
      {/* Icon */}
      <div
        style={{
          fontSize: '18px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.borderRadius.md,
          backgroundColor: getIconBackground(),
          boxShadow: `0 2px 4px ${getNodeColor()}30`,
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {definition.icon && (definition.icon.startsWith('data:') || definition.icon.startsWith('http') || definition.icon.startsWith('/')) ? (
          <img src={definition.icon} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
        ) : (
          definition.icon || '📦'
        )}
      </div>
      
      {/* Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          fontWeight: theme.fontWeight.medium,
          fontSize: theme.fontSize.base,
          color: theme.colors.text,
          marginBottom: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {definition.displayName}
        </div>
        <div style={{
          fontSize: theme.fontSize.xs,
          color: theme.colors.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '1.3',
        }}>
          {definition.description}
        </div>
      </div>

      {/* Drag Indicator */}
      <div style={{
        fontSize: '14px',
        color: theme.colors.textSecondary,
        opacity: isHovered ? 0.6 : 0.3,
        transition: `opacity ${theme.transitions.fast}`,
        position: 'relative',
        zIndex: 1,
      }}>
        ⋮⋮
      </div>
    </div>
  );
};

export default ComponentItem;