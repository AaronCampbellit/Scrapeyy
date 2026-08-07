import { beforeEach, describe, expect, it } from "vitest";

import { extractQuickData } from "../../src/extraction/quick-extract";

describe("extractQuickData", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("turns a selected table into named records", () => {
    document.body.innerHTML = `
      <table id="prices">
        <thead><tr><th>Plan</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td>Basic</td><td>$10</td></tr>
          <tr><td>Pro</td><td>$20</td></tr>
        </tbody>
      </table>`;

    expect(extractQuickData(document.querySelector("#prices")!)).toEqual({
      strategy: "table",
      fields: [
        expect.objectContaining({ id: "plan", name: "Plan" }),
        expect.objectContaining({ id: "price", name: "Price" }),
      ],
      records: [
        { plan: "Basic", price: "$10" },
        { plan: "Pro", price: "$20" },
      ],
    });
  });

  it("infers common fields from repeated cards", () => {
    document.body.innerHTML = `
      <div id="cards">
        <article class="card"><h3>Alpha</h3><a href="/a">Open</a><img src="/a.png" alt="Alpha"></article>
        <article class="card"><h3>Beta</h3><a href="/b">Open</a><img src="/b.png" alt="Beta"></article>
      </div>`;

    const result = extractQuickData(
      document.querySelector("#cards")!,
      "https://example.test/",
    );

    expect(result.strategy).toBe("repeated");
    expect(result.records).toEqual([
      expect.objectContaining({
        title: "Alpha",
        link: "https://example.test/a",
        image: "https://example.test/a.png",
      }),
      expect.objectContaining({
        title: "Beta",
        link: "https://example.test/b",
        image: "https://example.test/b.png",
      }),
    ]);
  });

  it("falls back to visible text, links, images, source, and descriptor", () => {
    document.body.innerHTML = `
      <section id="hero"><h2>Launch</h2>
        <a href="/learn">Learn more</a>
        <img src="/hero.png" alt="Launch graphic">
      </section>`;

    const result = extractQuickData(
      document.querySelector("#hero")!,
      "https://example.test/page",
    );

    expect(result.strategy).toBe("generic");
    expect(result.records[0]).toMatchObject({
      text: "Launch Learn more",
      links: "Learn more — https://example.test/learn",
      images: "Launch graphic — https://example.test/hero.png",
      source_url: "https://example.test/page",
      element: "section#hero",
    });
  });

  it("excludes embedded scripts and styles from readable text", () => {
    document.body.innerHTML = `
      <article id="post">
        <script>SML.load(["internal-module"]);</script>
        <style>.post { color: red; }</style>
        <h1>Useful title</h1>
        <p>Useful body text.</p>
      </article>`;

    const result = extractQuickData(document.querySelector("#post")!);

    expect(result.records[0]?.text).toBe("Useful title Useful body text.");
  });
});
