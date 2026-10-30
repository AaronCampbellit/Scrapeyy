import React, { Component, type ReactNode } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import createDOMPurify from "dompurify";
import JSZip from "jszip";
import { createDesignSnapshot } from "../../src/design/snapshot";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
class Boundary extends Component<{children: ReactNode}, {failed:boolean}> {
  override state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  override render() { return this.state.failed ? <p>HTML rejected</p> : this.props.children; }
}
describe("dependency restrictions", () => {
  it("renders and updates ordinary UI, including SVG, without raw HTML", () => {
    const click=vi.fn();
    const view=render(<button onClick={click}><svg><title>Capture</title></svg>Save</button>);
    fireEvent.click(screen.getByRole("button")); expect(click).toHaveBeenCalledOnce();
    view.rerender(<button disabled>Saved</button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("rejects raw HTML props instead of injecting strings", () => {
    vi.spyOn(console,"error").mockImplementation(()=>{});
    render(<Boundary><div dangerouslySetInnerHTML={{__html:'<img src=x onerror="alert(1)">'}} /></Boundary>);
    expect(screen.getByText("HTML rejected")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
  it("round-trips ZIP exports with Unicode and binary entries", async () => {
    const zip=new JSZip();zip.file("capture.json",JSON.stringify({title:"Café 日本",records:[1,2]}));
    zip.file("assets/pixels.bin",new Uint8Array([0,255,1,128]));
    const bytes=await zip.generateAsync({type:"uint8array",compression:"DEFLATE"});
    const restored=await JSZip.loadAsync(bytes);
    expect(await restored.file("capture.json")!.async("string")).toContain("Café 日本");
    expect(Array.from(await restored.file("assets/pixels.bin")!.async("uint8array"))).toEqual([0,255,1,128]);
  });
  it("keeps scheduler arguments and cancellation but rejects string callbacks", async () => {
    const context:any={setTimeout,clearTimeout};
    runInNewContext(readFileSync("node_modules/setimmediate/setImmediate.js","utf8"),context);
    expect(()=>context.setImmediate("globalThis.executed=true")).toThrow(/function callbacks only/);
    const cancelled=vi.fn();context.clearImmediate(context.setImmediate(cancelled));
    const result=await new Promise(resolve=>context.setImmediate((a:number,b:number)=>resolve(a+b),2,3));
    expect(result).toBe(5);expect(cancelled).not.toHaveBeenCalled();expect(context.executed).toBeUndefined();
  });
  it("aborts sanitization when the normal HTML parser fails", () => {
    const original=window.DOMParser;
    window.DOMParser=class extends original { override parseFromString():Document { throw Error("Unavailable"); } };
    try {
      const purifier=createDOMPurify(window);
      expect(()=>purifier.sanitize('<img src=x onerror="bad()">')).toThrow(/requires DOMParser/);
    } finally {window.DOMParser=original;}
  });
  it("preserves table and nested SVG nodes while removing executable attributes", async () => {
    document.body.innerHTML='<section><table><tbody><tr><td>Cell</td></tr></tbody></table><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" onclick="bad()" /></svg></section>';
    const snapshot=await createDesignSnapshot(document.querySelector("section")!);
    expect(snapshot.html).toContain("<table");expect(snapshot.html).toContain("Cell");
    expect(snapshot.html).toContain("<circle");expect(snapshot.html).not.toContain("onclick");
  });
  it("uses only reviewed dependency bytes, including production React", () => {
    const patches=JSON.parse(readFileSync("scripts/dependency-hardening.json","utf8"));
    for (const patch of patches) expect(createHash("sha256").update(readFileSync(`node_modules/${patch.path}`)).digest("hex")).toBe(patch.patchedSha256);
  });
});
