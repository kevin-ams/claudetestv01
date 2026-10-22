export type Currency = "GTQ" | "USD";

export type User = {
  id: number;
  google_sub: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  password_hash: string | null;
  active: boolean;
  role: "admin" | "member";
  created_at: string;
  last_login_at: string | null;
};

export type StageKind = "open" | "won" | "lost";

export type PipelineStage = {
  id: number;
  pipeline_id: number;
  name: string;
  position: number;
  probability: number;
  kind: StageKind;
};

export type StageWithCount = PipelineStage & { deal_count: number };
