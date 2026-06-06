import type { Ionicons } from "@expo/vector-icons";

export type SubjectCategory =
  | "mountain_peak"
  | "waterfall"
  | "lake_view"
  | "ocean_view"
  | "stargazing"
  | "city_skyline"
  | "other";

type IoniconName = keyof typeof Ionicons.glyphMap;

export const SUBJECT_CATEGORIES: {
  value: SubjectCategory;
  label: string;
  icon: IoniconName;
}[] = [
  { value: "mountain_peak", label: "Mountain peak", icon: "triangle" },
  { value: "waterfall", label: "Waterfall", icon: "rainy" },
  { value: "lake_view", label: "Lake view", icon: "water" },
  { value: "ocean_view", label: "Ocean view", icon: "boat-outline" },
  { value: "stargazing", label: "Stargazing", icon: "moon" },
  { value: "city_skyline", label: "City skyline", icon: "business" },
  { value: "other", label: "Other", icon: "ellipsis-horizontal" },
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
