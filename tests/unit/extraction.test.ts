import { beforeEach, describe, expect, it } from "vitest";

import type { FieldDefinition } from "../../src/contracts/models";
import { extractRecords } from "../../src/extraction/extract";
import { fingerprintRecord } from "../../src/extraction/fingerprint";

describe("structured extraction", () => {
  beforeEach(() => {
    document.head.innerHTML = '<base href="https://example.test/catalog/">';
    document.body.innerHTML = "";
  });

  it("extracts and normalizes repeated records", () => {
    document.body.innerHTML = `
      <article class="card">
        <h2>  Alpha   Product </h2>
        <a href="../products/alpha">View</a>
        <img src="./alpha.png" alt="Alpha">
        <span data-sku=" A-1 ">SKU</span>
      </article>
      <article class="card">
        <h2>Beta Product</h2>
        <a href="../products/beta">View</a>
        <img src="./beta.png" alt="Beta">
        <span data-sku="B-2">SKU</span>
      </article>`;
    const fields: FieldDefinition[] = [
      { id: "title", name: "Title", kind: "text", selector: "h2" },
      { id: "url", name: "URL", kind: "link", selector: "a", identity: true },
      { id: "image", name: "Image", kind: "image", selector: "img" },
      {
        id: "sku",
        name: "SKU",
        kind: "attribute",
        selector: "[data-sku]",
        attribute: "data-sku",
      },
    ];

    expect(extractRecords(document, ".card", fields)).toEqual([
      {
        title: "Alpha Product",
        url: "https://example.test/products/alpha",
        image: "https://example.test/catalog/alpha.png",
        sku: "A-1",
      },
      {
        title: "Beta Product",
        url: "https://example.test/products/beta",
        image: "https://example.test/catalog/beta.png",
        sku: "B-2",
      },
    ]);
  });

  it("uses null for missing fields without dropping the record", () => {
    document.body.innerHTML = '<article class="card"><h2>Alpha</h2></article>';

    expect(
      extractRecords(document, ".card", [
        { id: "title", name: "Title", kind: "text", selector: "h2" },
        { id: "url", name: "URL", kind: "link", selector: "a" },
      ]),
    ).toEqual([{ title: "Alpha", url: null }]);
  });

  it("fingerprints only configured identity fields when present", () => {
    const fields: FieldDefinition[] = [
      {
        id: "url",
        name: "URL",
        kind: "link",
        selector: "a",
        identity: true,
      },
      { id: "title", name: "Title", kind: "text", selector: "h2" },
    ];

    expect(
      fingerprintRecord({ url: "https://example.test/a", title: "Old" }, fields),
    ).toBe(
      fingerprintRecord({ url: "https://example.test/a", title: "New" }, fields),
    );
    expect(
      fingerprintRecord({ url: "https://example.test/a", title: "Old" }, fields),
    ).not.toBe(
      fingerprintRecord({ url: "https://example.test/b", title: "Old" }, fields),
    );
  });
});
