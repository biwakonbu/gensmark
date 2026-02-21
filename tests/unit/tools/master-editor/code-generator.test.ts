import { test, expect, describe } from "bun:test";
import { generateMasterCode } from "../../../../src/tools/master-editor/code-generator.ts";
import { createStandardMaster } from "../../../../src/master/presets/standard.ts";
import { defaultTheme } from "../../../../src/master/presets/themes/default.ts";
import { darkTheme } from "../../../../src/master/presets/themes/dark.ts";

describe("generateMasterCode", () => {
  test("standard/default マスターのコードを生成できる", () => {
    const master = createStandardMaster(defaultTheme);
    const code = generateMasterCode(master);

    // import 文が含まれる
    expect(code).toContain('import { gensmark, ph } from "gensmark"');

    // テーマ定義が含まれる
    expect(code).toContain('gensmark.defineTheme');
    expect(code).toContain('"default"');
    expect(code).toContain('"#2B579A"');

    // マスター定義が含まれる
    expect(code).toContain('gensmark.defineMaster');
    expect(code).toContain('"standard"');

    // レイアウト名が含まれる
    expect(code).toContain('"title-slide"');
    expect(code).toContain('"section-header"');
    expect(code).toContain("content");
    expect(code).toContain('"two-column"');

    // ph.* ヘルパーが使われている
    expect(code).toContain("ph.title");
    expect(code).toContain("ph.subtitle");
    expect(code).toContain("ph.body");
  });

  test("dark テーマのコードを生成できる", () => {
    const master = createStandardMaster(darkTheme);
    const code = generateMasterCode(master);

    expect(code).toContain('"dark"');
    expect(code).toContain('"#5B9BD5"');
  });

  test("アスペクト比が含まれる", () => {
    const master = createStandardMaster(defaultTheme);
    const code = generateMasterCode(master);
    expect(code).toContain('"16:9"');
  });

  test("マージンが含まれる", () => {
    const master = createStandardMaster(defaultTheme);
    const code = generateMasterCode(master);
    // standard マスターは margins を持つ
    expect(code).toContain("margins:");
  });

  test("固定要素が含まれる", () => {
    const master = createStandardMaster(defaultTheme);
    const code = generateMasterCode(master);
    expect(code).toContain("fixedElements:");
    expect(code).toContain('type: "rect"');
  });

  test("背景定義が含まれる", () => {
    const master = createStandardMaster(defaultTheme);
    const code = generateMasterCode(master);
    expect(code).toContain('type: "solid"');
  });

  test("デフォルト値と同じプロパティは省略される", () => {
    const master = createStandardMaster(defaultTheme);
    const code = generateMasterCode(master);

    // ph.title() のデフォルト x=0.75 のままの場合は x が省略されるべき
    // content レイアウトのタイトルは x がデフォルトのまま
    // ただし y は異なるので y は出力される
    const lines = code.split("\n");
    const contentTitleLine = lines.find(
      (l) => l.includes("ph.title") && l.includes("fontSize: 28"),
    );
    if (contentTitleLine) {
      // x がデフォルト値なので含まれないはず
      expect(contentTitleLine).not.toContain("x:");
    }
  });
});
