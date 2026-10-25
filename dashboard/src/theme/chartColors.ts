import { customColors } from "./customColors";

export const CHART_COLOR_ARRAY = [
  customColors.nileBlue600,
  customColors.campusGreen600,
  customColors.torchGold600,
  customColors.brickTerracotta500,
  customColors.classroomSlate600,
  customColors.nileBlue300,
  customColors.nileBlue800,
  customColors.campusGreen700,
  customColors.torchGold700,
  customColors.brickTerracotta300,
  customColors.classroomSlate700,
  customColors.nileBlue500,
] as const;

export const getChartColor = (index: number): string =>
  CHART_COLOR_ARRAY[index % CHART_COLOR_ARRAY.length];

export const SEMESTER_COLORS = {
  FIRST: customColors.nileBlue600,
  SECOND: customColors.campusGreen600,
} as const;

export const GRADE_BAND_COLORS = {
  excellent: customColors.campusGreen600,
  good: customColors.torchGold600,
  below: customColors.classroomSlate600,
} as const;

export const buildCategoryColors = <T extends string>(
  items: readonly T[],
): Map<T, string> =>
  new Map(
    [...new Set(items)]
      .sort()
      .map((item, index) => [item, getChartColor(index)]),
  );

