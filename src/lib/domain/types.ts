export type Role = "admin" | "member";

export type User = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
};

export type PublicUser = Omit<User, "password_hash">;

export type Team = {
  id: number;
  name: string;
  created_at: string;
};

export type TeamMember = {
  team_id: number;
  user_id: number;
  seat_title: string | null;
  joined_at: string;
};

export type VTO = {
  id: number;
  team_id: number;
  core_values: string[];
  core_focus: { purpose?: string; niche?: string };
  ten_year_target: string;
  marketing_strategy: {
    target_market?: string;
    three_uniques?: string[];
    proven_process?: string;
    guarantee?: string;
  };
  three_year_picture: {
    future_date?: string;
    revenue?: string;
    profit?: string;
    measurables?: string;
    looks_like?: string[];
  };
  one_year_plan: {
    future_date?: string;
    revenue?: string;
    profit?: string;
    measurables?: string;
    goals?: string[];
  };
  updated_at: string;
  updated_by: number | null;
};

export type Seat = {
  id: number;
  team_id: number;
  parent_seat_id: number | null;
  title: string;
  user_id: number | null;
  roles: string[];
  sort_order: number;
  created_at: string;
};

export type RockStatus = "on_track" | "off_track" | "done";

export type Rock = {
  id: number;
  team_id: number;
  owner_id: number | null;
  title: string;
  description: string;
  is_company_rock: boolean;
  quarter: number;
  year: number;
  due_date: string | null;
  status: RockStatus;
  sort_order: number;
  created_at: string;
};

export type RockMilestone = {
  id: number;
  rock_id: number;
  title: string;
  done: boolean;
  due_date: string | null;
  sort_order: number;
};

export type Direction = "higher_better" | "lower_better";
export type MetricFormat = "count" | "percentage" | "currency";
export type Aggregation = "sum" | "average";

export type ScorecardOwner = {
  id: number;
  team_id: number;
  name: string;
  user_id: number | null;
  is_rollup: boolean;
  sort_order: number;
};

export type ScorecardMetric = {
  id: number;
  team_id: number;
  name: string;
  predicts: string;
  direction: Direction;
  format: MetricFormat;
  aggregation: Aggregation;
  sort_order: number;
  archived: boolean;
  created_at: string;
};

export type ScorecardTarget = {
  metric_id: number;
  owner_id: number;
  target_value: number;
};

export type ScorecardEntry = {
  id: number;
  metric_id: number;
  owner_id: number;
  week_start: string;
  value: number | null;
  entered_by: number | null;
  entered_at: string;
};

export type IssueStatus = "open" | "solved";
export type IssueTerm = "short_term" | "long_term";

export type Issue = {
  id: number;
  team_id: number;
  title: string;
  description: string;
  raised_by: number | null;
  owner_id: number | null;
  status: IssueStatus;
  term: IssueTerm;
  sort_order: number;
  created_at: string;
  solved_at: string | null;
};

export type TodoStatus = "open" | "done";

export type Todo = {
  id: number;
  team_id: number;
  title: string;
  owner_id: number | null;
  due_date: string | null;
  status: TodoStatus;
  meeting_id: number | null;
  created_at: string;
  done_at: string | null;
};

export type MeetingStatus = "scheduled" | "in_progress" | "completed";

export type Meeting = {
  id: number;
  team_id: number;
  scheduled_at: string | null;
  status: MeetingStatus;
  current_segment: string | null;
  segment_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  avg_rating: number | null;
  created_by: number | null;
  created_at: string;
};

export type MeetingHeadline = {
  id: number;
  meeting_id: number;
  type: "customer" | "employee";
  content: string;
  created_by: number | null;
  created_at: string;
};
