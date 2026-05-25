export type Subject = {
  id: string;
  name: string;
  kind: "mountain" | "landmark" | "other";
  latitude: number;
  longitude: number;
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
