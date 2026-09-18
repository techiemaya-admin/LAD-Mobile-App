/** Captured tier comparison table; hydration rotates the selected tier into `recommended_index`. */
export interface TierMatrix {
  selector: string;
  recommended_index: number;
  tiers: { name: string; cells: string[] }[];
}

export interface TemplateStats {
  template_path: string;
  tags_placed_count: number;
  loops_collapsed_count: number;
  conditional_rows_wrapped_count: number;
  mutations_applied_count: number;
  details?: Array<{
    action: string;
    target: string;
    applied: boolean;
    info?: string;
  }>;
  tier_matrix?: TierMatrix;
}

export interface TemplateGenerationResponse {
  success: boolean;
  template_path: string;
  tags_placed_count: number;
  loops_collapsed_count: number;
  conditional_rows_wrapped_count: number;
  mutations_applied_count: number;
  details?: Array<{
    action: string;
    target: string;
    applied: boolean;
    info?: string;
  }>;
}

export interface TemplateStatusResponse {
  success: boolean;
  exists: boolean;
  template_path: string | null;
  filesize: number | null;
  stats: TemplateStats | null;
}
