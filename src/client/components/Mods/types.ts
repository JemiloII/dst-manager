export interface ModConfig {
  enabled: boolean;
  configuration_options: Record<string, unknown>;
}

export interface ModInfo {
  title: string;
  description: string;
  previewUrl: string;
  version?: string;
  configuration_options?: Record<string, any>;
}

export interface SearchResult {
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string;
}