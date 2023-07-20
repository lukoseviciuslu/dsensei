import { DimensionSliceKey } from "./types";

export function serializeDimensionSliceKey(key: DimensionSliceKey): string {
  return key
    .sort((k1, k2) =>
      k1.dimension.toLowerCase() > k2.dimension.toLowerCase() ? -1 : 1
    )
    .map((k) => `${k.dimension}:${k.value}`)
    .join(" AND ");
}

export function getRegexMatchPatternForDimensionSliceKey(
  key: DimensionSliceKey
): RegExp {
  return new RegExp(
    key
      .sort((k1, k2) =>
        k1.dimension.toLowerCase() > k2.dimension.toLowerCase() ? -1 : 1
      )
      .map((k) => `${k.dimension}:`)
      .join(".*")
  );
}
