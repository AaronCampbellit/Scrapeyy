import { beforeEach, describe, expect, it } from "vitest";

import { rankSelectorCandidates } from "../../src/extraction/selectors";

describe("rankSelectorCandidates", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("prefers a unique stable id", () => {
    document.body.innerHTML =
      '<article id="featured-product" data-product="alpha" class="card"><h2>Alpha</h2></article>';

    const candidates = rankSelectorCandidates(
      document.querySelector("article")!,
    );

    expect(candidates[0]).toMatchObject({
      selector: "#featured-product",
      matches: 1,
      reason: "id",
    });
  });

  it("prefers semantic attributes to generated identifiers and classes", () => {
    document.body.innerHTML =
      '<article id="ember781289" data-product="alpha" class="x-7812"><h2>Alpha</h2></article>';

    const candidates = rankSelectorCandidates(
      document.querySelector("article")!,
    );

    expect(candidates[0]).toMatchObject({
      selector: '[data-product="alpha"]',
      matches: 1,
      reason: "semantic",
    });
    expect(candidates.map((candidate) => candidate.selector)).not.toContain(
      "#ember781289",
    );
  });

  it("returns a structural fallback that identifies the selected sibling", () => {
    document.body.innerHTML =
      "<main><article><h2>Alpha</h2></article><article><h2>Beta</h2></article></main>";
    const selected = document.querySelectorAll("article")[1]!;

    const candidates = rankSelectorCandidates(selected);

    expect(candidates.at(-1)).toMatchObject({
      selector: "main > article:nth-of-type(2)",
      matches: 1,
      reason: "structural",
    });
  });
});
