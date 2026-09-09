import { beforeEach, describe, expect, it } from "vitest";

import { extractQuickData } from "../../src/extraction/quick-extract";
import {
  detectRecipeDatasets,
  extractSmartRecords,
} from "../../src/extraction/smart-extract";

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

  it("turns a clicked repeated card selector into records for every match", () => {
    document.body.innerHTML = `
      <article class="card"><h3>Alpha</h3><a href="/a">Open</a></article>
      <article class="card"><h3>Beta</h3><a href="/b">Open</a></article>`;

    const datasets = detectRecipeDatasets(
      document,
      "article.card",
      "https://example.test/catalog",
    );
    expect(datasets[0]).toMatchObject({
      key: "generic",
      records: [
        expect.objectContaining({ text: "Alpha Open" }),
        expect.objectContaining({ text: "Beta Open" }),
      ],
    });

    const result = extractSmartRecords(
      document,
      "article.card",
      "generic",
      [{
        id: "description",
        sourceId: "text",
        name: "Description",
        kind: "text",
        selector: ":scope",
      }],
      "https://example.test/catalog",
    );
    expect(result.records).toEqual([
      { description: "Alpha Open" },
      { description: "Beta Open" },
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
      text: "Launch Learn more Launch graphic",
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

  it("extracts a whole dashboard into metrics, grid rows, and readable page text", () => {
    document.title = "Security Overview";
    document.body.innerHTML = `
      <main id="dashboard">
        <h1>Overview</h1>
        <section aria-label="Threat Summary">
          <div class="metric"><strong>61,638</strong><span>Emails Received</span></div>
          <div class="metric"><strong>656</strong><span>Danger</span></div>
          <div class="metric" style="display:none"><strong>999</strong><span>Hidden Total</span></div>
        </section>
        <section aria-label="Top sender emails by threat level">
          <div role="table">
            <div role="row"><span role="columnheader">Sender</span><span role="columnheader">Danger</span><span role="columnheader">Caution</span></div>
            <div role="row"><span role="cell">news@example.test</span><span role="cell">0</span><span role="cell">1272</span></div>
            <div role="row"><span role="cell">alerts@example.test</span><span role="cell">2</span><span role="cell">1692</span></div>
          </div>
        </section>
      </main>`;

    const result = extractQuickData(
      document.querySelector("#dashboard")!,
      "https://example.test/overview?range=90d&code=secret&session_state=private#token",
    );

    expect(result.strategy).toBe("dashboard");
    expect(result.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        record_type: "metric",
        section: "Threat Summary",
        label: "Emails Received",
        value: "61,638",
      }),
      expect.objectContaining({
        record_type: "table_row",
        section: "Top sender emails by threat level",
        sender: "news@example.test",
        danger: "0",
        caution: "1272",
      }),
      expect.objectContaining({
        record_type: "page_text",
        text: expect.stringContaining("61,638 Emails Received"),
        source_url: "https://example.test/overview?range=90d",
      }),
    ]));
    expect(result.records.some((record) => record.text?.includes("Hidden Total"))).toBe(false);
    expect(result.fields.map((field) => field.id)).toEqual(expect.arrayContaining([
      "record_type",
      "section",
      "label",
      "value",
      "sender",
      "danger",
      "caution",
      "text",
    ]));
  });

  it("discovers a native table nested within a selected page", () => {
    document.body.innerHTML = `
      <main id="report">
        <h1>Monthly report</h1>
        <section aria-label="Accounts">
          <table><thead><tr><th>Name</th><th>Total</th></tr></thead>
          <tbody><tr><td>Acme</td><td>42</td></tr></tbody></table>
        </section>
      </main>`;

    const result = extractQuickData(document.querySelector("#report")!);

    expect(result.strategy).toBe("dashboard");
    expect(result.records).toContainEqual(expect.objectContaining({
      record_type: "table_row",
      section: "Accounts",
      name: "Acme",
      total: "42",
    }));
  });
});
