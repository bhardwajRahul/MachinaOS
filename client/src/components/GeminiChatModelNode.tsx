import React from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import BaseChatModelNode from './base/BaseChatModelNode';

const GeminiChatModelNode: React.FC<NodeProps<NodeData>> = (props) => {
  return (
    <BaseChatModelNode
      {...props}
      providerId="gemini"
      displayName="Gemini"
      icon="⭐"
      color="#4285F4"
    />
  );
};

export default GeminiChatModelNode;