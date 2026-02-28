export interface ModConfig {
  version: string | null;
  configuration_options: Record<string, any>;
}

export interface WorkshopSearchResult {
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string;
}

export interface ModData {
  enabled: boolean;
  configuration_options: Record<string, unknown>;
}