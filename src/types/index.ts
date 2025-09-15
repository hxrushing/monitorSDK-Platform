export interface EventDefinition {
  id?: string;
  projectId: string;
  eventName: string;
  description: string;
  paramsSchema: Record<string, any>;
}

export interface EventData {
  projectId: string;
  eventName: string;
  eventParams?: Record<string, any>;
  uid?: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
  };
  timestamp: number;
}

export interface EventStats {
  date: string;
  pv: number;
  uv: number;
} 