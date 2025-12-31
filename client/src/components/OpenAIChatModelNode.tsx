import React from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../types/NodeTypes';
import BaseChatModelNode from './base/BaseChatModelNode';

const OpenAIChatModelNode: React.FC<NodeProps<NodeData>> = (props) => {
  return (
    <BaseChatModelNode
      {...props}
      providerId="openai"
      displayName="OpenAI"
      icon="🤖"
      color="#00A67E"
    />
  );
};

export default OpenAIChatModelNode;