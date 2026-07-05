// Chart palette — the single source for every chart colour, drawn from the
// design-language tokens (docs/design-language.md). Components import from here
// and never hard-code chart colours.
//
// Charts share ONE static palette across light and dark: ECharts renders to a
// canvas that is not re-themed at runtime, so each hue was validated to read on
// both the light (#ffffff) and dark (#171b21) chart surface. Sign is also
// encoded positionally (bars sit above/below the zero baseline) and in the
// signed figures, so the profit/loss pair never relies on hue alone.
export const POS = "#2bad70"; // profit bars
export const NEG = "#e05561"; // loss bars
export const LINE = "#4785e0"; // cumulative / equity line (accent family)

// Chart chrome: a theme-invariant muted ink for axis labels and hairline
// gridlines that reads acceptably on either surface.
export const AXIS = "#898781";
export const GRID = "rgba(137, 135, 129, 0.18)";

// Spread into every ECharts xAxis/yAxis so the plot furniture matches the chrome.
export const axis = {
  axisLabel: { color: AXIS },
  axisLine: { lineStyle: { color: GRID } },
  axisTick: { lineStyle: { color: GRID } },
  splitLine: { lineStyle: { color: GRID } },
} as const;
