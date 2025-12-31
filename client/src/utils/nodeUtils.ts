// Utility functions for node operations

// Generate short node name from nodeType for parameter references
export const getShortNodeName = (nodeType: string): string => {
  const typeMap: { [key: string]: string } = {
    // AI Chat Models
    'openaiChatModel': 'openai',
    'anthropicChatModel': 'claude',
    'geminiChatModel': 'gemini',
    // AI Agents
    'aiAgent': 'ai',
    // Location Services
    'createMap': 'map',
    'addLocations': 'location',
    'showNearbyPlaces': 'places'
  };
  
  // If we have a specific mapping, use it
  if (typeMap[nodeType]) {
    return typeMap[nodeType];
  }
  
  // Otherwise, create a simplified version by removing capitals and common suffixes
  let simplified = nodeType
    .replace(/[A-Z]/g, '') // Remove capital letters
    .replace(/(Get|Set|Stop|Play|Record|Control)$/i, '') // Remove common suffixes
    .toLowerCase();
    
  // Return simplified name or fallback to 'node'
  return simplified || 'node';
};