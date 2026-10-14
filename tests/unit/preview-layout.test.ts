import { expect, it } from "vitest";
import { previewPaneWidth } from "../../src/platform/preview-layout";

it('fits screenshots within toolbar and screen bounds without magnifying small images', () => {
  expect(previewPaneWidth(350)).toBe(420);
  expect(previewPaneWidth(600)).toBe(632);
  expect(previewPaneWidth(1600)).toBe(780);
  expect(previewPaneWidth(1600, 500)).toBe(480);
  expect(previewPaneWidth()).toBe(720);
  expect(previewPaneWidth(NaN)).toBe(720);
});
