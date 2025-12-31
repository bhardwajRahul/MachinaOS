import React from 'react';
import { Tree, Card, Space, Typography } from 'antd';
import { DragOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import styled from 'styled-components';

const { Text } = Typography;

const DraggableTreeNode = styled(Card)<{ $isDraggable: boolean }>`
  cursor: ${props => props.$isDraggable ? 'grab' : 'default'};
  background-color: #f0f9ff;
  border-color: #0ea5e9;
  margin-bottom: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.$isDraggable ? '#e0f2fe' : '#f0f9ff'};
    transform: ${props => props.$isDraggable ? 'translateY(-1px)' : 'none'};
  }
`;

interface JSONTreeProps {
  data: Record<string, any>;
  nodeName: string;
  onDragStart: (e: React.DragEvent, nodeName: string, propertyPath: string, value: any) => void;
  templateName: string;
}

interface TreeNodeData extends DataNode {
  path: string;
  value: any;
  isDraggable: boolean;
}

const JSONTreeRenderer: React.FC<JSONTreeProps> = ({
  data,
  nodeName,
  onDragStart,
  templateName
}) => {
  const convertToTreeData = (
    obj: any,
    path: string = '',
    _parentKey: string = ''
  ): TreeNodeData[] => {
    return Object.entries(obj).map(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
      const isDraggable = !isObject;

      const node: TreeNodeData = {
        title: (
          <DraggableTreeNode
            size="small"
            $isDraggable={isDraggable}
            draggable={isDraggable}
            onDragStart={(e) => isDraggable && onDragStart(e, nodeName, currentPath, value)}
            bodyStyle={{ padding: 8 }}
          >
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space direction="vertical" size={0}>
                <Text code style={{ color: '#7c3aed', fontSize: 11 }}>
                  {`{{${templateName}.${currentPath}}}`}
                </Text>
                <Space size={4}>
                  <Text strong style={{ color: '#059669', fontSize: 10 }}>
                    "{key}"
                  </Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>:</Text>
                  <Text style={{
                    color: isObject ? '#7c2d12' : (typeof value === 'string' ? '#dc2626' : '#7c2d12'),
                    fontSize: 10
                  }}>
                    {isObject ? '{object}' : JSON.stringify(value)}
                  </Text>
                </Space>
              </Space>
              {isDraggable && <DragOutlined style={{ color: '#7c3aed', fontSize: 12 }} />}
            </Space>
          </DraggableTreeNode>
        ),
        key: currentPath,
        path: currentPath,
        value,
        isDraggable,
        children: isObject ? convertToTreeData(value, currentPath, key) : undefined
      };

      return node;
    });
  };

  const treeData = convertToTreeData(data);

  return (
    <Tree
      treeData={treeData}
      defaultExpandAll
      showLine
      blockNode
      style={{ background: 'transparent' }}
    />
  );
};

export default JSONTreeRenderer;