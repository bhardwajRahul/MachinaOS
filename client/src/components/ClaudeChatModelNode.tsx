import React from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import BaseChatModelNode from './base/BaseChatModelNode';

const ClaudeChatModelNode: React.FC<NodeProps<NodeData>> = (props) => {
  return (
    <BaseChatModelNode
      {...props}
      providerId="anthropic"
      displayName="Claude"
      icon="🧠"
      color="#FF6B35"
    />
  );
};

export default ClaudeChatModelNode;