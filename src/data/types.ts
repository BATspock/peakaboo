export type SubjectCategory =
  | "mountain_peak"
  | "waterfall"
  | "lake_view"
  | "ocean_view"
  | "stargazing"
  | "city_skyline"
  | "other";

export const SUBJECT_CATEGORIES: { value: SubjectCategory; label: string }[] = [
  { value: "mountain_peak", label: "Mountain peak" },
  { value: "waterfall", label: "Waterfall" },
  { value: "lake_view", label: "Lake view" },
  { value: "ocean_view", label: "Ocean view" },
  { value: "stargazing", label: "Stargazing" },
  { value: "city_skyline", label: "City skyline" },
  { value: "other", label: "Other" },
];

export type Subject = {
  id: string;
  name: string;
  kind: SubjectCategory;
  latitude: number;
  longitude: number;
  description?: string | null;
  createdBy?: string | null;
  placeId?: string | null;
  createdAt?: string | null;
};

export type Viewpoint = {
  id: string;
  subjectId: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
};

export type SightingCondition = "clear" | "cloudy" | "snowy" | "hazy" | "rainy";

export type Sighting = {
  id: string;
  viewpointId: string;
  userId: string;
  observedAt: string;
  observedOn: string;
  visible: boolean;
  visibility: number | null;
  conditions: SightingCondition | null;
  notes: string | null;
};

export type ReportTargetType = "sighting" | "viewpoint" | "subject";
