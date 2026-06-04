import type { SubjectCategory } from "../data/types";

// Per-category map zoom deltas. First-pass values; tune after seeing
// real subjects on the map. Smaller delta = tighter zoom.
//
// Mountain peaks need a wide view because their viewpoints can be 30+km
// away. Skylines and waterfalls are observed from much closer in. Stargazing
// goes wider because dark-sky locations are spread out.
const SUBJECT_DELTA: Record<SubjectCategory, number> = {
  mountain_peak: 1.4,
  waterfall: 0.05,
  lake_view: 0.08,
  ocean_view: 0.15,
  stargazing: 0.5,
  city_skyline: 0.05,
  other: 0.1,
};

export function subjectCameraDelta(category: SubjectCategory): number {
  return SUBJECT_DELTA[category] ?? 0.1;
}
