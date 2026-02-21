import { test, expect, describe } from "bun:test";
import { MasterStore } from "../../../../src/tools/master-editor/master-store.ts";
import { createStandardMaster } from "../../../../src/master/presets/standard.ts";
import { defaultTheme } from "../../../../src/master/presets/themes/default.ts";

describe("MasterStore", () => {
  test("初期化時にビルトインマスターが2つプリロードされる", () => {
    const store = new MasterStore();
    const list = store.list();
    expect(list.length).toBe(2);
    expect(list[0]!.source).toBe("builtin");
    expect(list[1]!.source).toBe("builtin");
  });

  test("マスターを追加できる", () => {
    const store = new MasterStore();
    const master = createStandardMaster(defaultTheme);
    const id = store.add(master, "imported");
    expect(id).toBeDefined();
    expect(store.list().length).toBe(3);
  });

  test("ID でマスターを取得できる", () => {
    const store = new MasterStore();
    const list = store.list();
    const first = list[0]!;
    const entry = store.get(first.id);
    expect(entry).toBeDefined();
    expect(entry!.master.name).toBe("standard");
  });

  test("存在しない ID は undefined を返す", () => {
    const store = new MasterStore();
    expect(store.get("999")).toBeUndefined();
  });

  test("マスターを削除できる", () => {
    const store = new MasterStore();
    const master = createStandardMaster(defaultTheme);
    const id = store.add(master, "imported");
    expect(store.delete(id)).toBe(true);
    expect(store.get(id)).toBeUndefined();
    expect(store.list().length).toBe(2);
  });

  test("存在しない ID の削除は false を返す", () => {
    const store = new MasterStore();
    expect(store.delete("999")).toBe(false);
  });
});
