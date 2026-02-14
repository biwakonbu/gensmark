// Visual regression: PPTX -> PNG (LibreOffice) -> pixel diff
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { visualFixtures } from "../tests/visual/fixtures.ts";
import { gensmark } from "../src/index.ts";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const UPDATE = process.argv.includes("--update");
const KEEP_OUTPUT = process.argv.includes("--keep");

const ROOT = process.cwd();
const OUT_ROOT = process.env.VISUAL_OUT_DIR ?? join(ROOT, "tests/visual/output");
const DEFAULT_GOLDEN_ROOT =
  process.platform === "linux"
    ? join(ROOT, "tests/visual/golden")
    : join(ROOT, `tests/visual/golden-${process.platform}`);
const GOLDEN_ROOT = process.env.VISUAL_GOLDEN_DIR ?? DEFAULT_GOLDEN_ROOT;
const DIFF_ROOT = process.env.VISUAL_DIFF_DIR ?? join(ROOT, "tests/visual/diff");

const libreoffice = await findLibreOfficeBinary();
if (!libreoffice) {
  throw new Error(
    'LibreOffice (soffice) not found. Install it or set LIBREOFFICE_BIN. Example: LIBREOFFICE_BIN="/Applications/LibreOffice.app/Contents/MacOS/soffice".',
  );
}

if (!KEEP_OUTPUT) {
  rmSync(OUT_ROOT, { recursive: true, force: true });
  rmSync(DIFF_ROOT, { recursive: true, force: true });
}
mkdirSync(OUT_ROOT, { recursive: true });
mkdirSync(GOLDEN_ROOT, { recursive: true });
mkdirSync(DIFF_ROOT, { recursive: true });

let hasFailure = false;

for (const [name, spec] of Object.entries(visualFixtures)) {
  const fixtureOutDir = join(OUT_ROOT, name);
  const fixtureGoldenDir = join(GOLDEN_ROOT, name);
  const fixtureDiffDir = join(DIFF_ROOT, name);
  mkdirSync(fixtureOutDir, { recursive: true });
  mkdirSync(fixtureDiffDir, { recursive: true });

  const pptxPath = join(fixtureOutDir, `${name}.pptx`);

  const compiled = await gensmark.compile(spec, { profile: "draft" });
  if (!compiled.build.isValid) {
    const errors = compiled.validations.filter((v) => v.severity === "error");
    throw new Error(`compile failed (fixture=${name}): ${errors.map((e) => e.type).join(", ")}`);
  }
  writeFileSync(
    join(fixtureOutDir, "report.json"),
    JSON.stringify({ quality: compiled.quality, validations: compiled.validations }, null, 2),
    "utf8",
  );
  await compiled.build.toPptxFile(pptxPath);

  const pngDir = join(fixtureOutDir, "png");
  rmSync(pngDir, { recursive: true, force: true });
  mkdirSync(pngDir, { recursive: true });

  await convertPptxToPng({ libreoffice, pptxPath, outDir: pngDir });
  const actualPngs = listConvertedPngs(pngDir, basename(pptxPath, ".pptx"));
  if (actualPngs.length === 0) throw new Error(`no png generated (fixture=${name})`);

  if (UPDATE) {
    rmSync(fixtureGoldenDir, { recursive: true, force: true });
    mkdirSync(fixtureGoldenDir, { recursive: true });
    for (const p of actualPngs) {
      const dst = join(fixtureGoldenDir, basename(p));
      writeFileSync(dst, readFileSync(p));
    }
    // eslint-disable-next-line no-console
    console.log(`[visual] updated golden: ${name} (${actualPngs.length} slides)`);
    continue;
  }

  if (!existsSync(fixtureGoldenDir)) {
    throw new Error(`golden dir not found: ${fixtureGoldenDir}. Run: bun run test:visual:update`);
  }

  const goldenPngs = listConvertedPngs(fixtureGoldenDir, basename(pptxPath, ".pptx"));
  if (goldenPngs.length === 0) {
    throw new Error(`golden is empty: ${fixtureGoldenDir}. Run: bun run test:visual:update`);
  }

  const count = Math.min(actualPngs.length, goldenPngs.length);
  if (actualPngs.length !== goldenPngs.length) {
    hasFailure = true;
    // eslint-disable-next-line no-console
    console.error(
      `[visual] slide count mismatch: ${name} actual=${actualPngs.length} golden=${goldenPngs.length}`,
    );
  }

  for (let i = 0; i < count; i++) {
    const actualPath = actualPngs[i]!;
    const goldenPath = goldenPngs[i]!;
    const diffPath = join(fixtureDiffDir, `diff-${i + 1}.png`);

    const ok = diffPng({ actualPath, goldenPath, diffPath });
    if (!ok) {
      hasFailure = true;
      // eslint-disable-next-line no-console
      console.error(`[visual] diff detected: fixture=${name} slide=${i + 1}`);
    }
  }
}

if (hasFailure) {
  throw new Error("visual regression failed");
}

// -----------------------------

async function findLibreOfficeBinary(): Promise<string | null> {
  const env = process.env.LIBREOFFICE_BIN;
  if (env && existsSync(env)) return env;

  const candidates = [
    // macOS (brew cask)
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    // PATH
    "soffice",
    "libreoffice",
  ];

  for (const cmd of candidates) {
    const ok = await canRun(cmd, ["--version"]);
    if (ok) return cmd;
  }
  return null;
}

async function canRun(cmd: string, args: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore" });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

async function convertPptxToPng(args: {
  libreoffice: string;
  pptxPath: string;
  outDir: string;
}): Promise<void> {
  const pdftoppm = await findPdfToPpmBinary();
  if (!pdftoppm) {
    throw new Error("pdftoppm not found. Install poppler-utils (Linux) or poppler (macOS).");
  }

  const base = basename(args.pptxPath, ".pptx");
  const pdfPath = join(args.outDir, `${base}.pdf`);

  const proc = Bun.spawn(
    [
      args.libreoffice,
      "--headless",
      "--nologo",
      "--nolockcheck",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      "pdf",
      "--outdir",
      args.outDir,
      args.pptxPath,
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(err.trim() || `LibreOffice convert failed: exit=${code}`);
  }

  // PDF -> PNG (page-wise)
  const proc2 = Bun.spawn(
    [
      pdftoppm,
      "-png",
      "-r",
      "150",
      pdfPath,
      join(args.outDir, base),
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  const code2 = await proc2.exited;
  if (code2 !== 0) {
    const err = await new Response(proc2.stderr).text();
    throw new Error(err.trim() || `pdftoppm failed: exit=${code2}`);
  }
}

function listConvertedPngs(dir: string, base: string): string[] {
  // pdftoppm は `${base}-1.png` 形式
  const re = new RegExp(`^${escapeRe(base)}-(\\d+)\\.png$`);
  const files = readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => {
      const m = f.match(re);
      const idx = m?.[1] ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
      return { f, idx };
    })
    .sort((a, b) => a.idx - b.idx)
    .map((x) => join(dir, x.f));
  return files;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findPdfToPpmBinary(): Promise<string | null> {
  const candidates = ["pdftoppm"];
  for (const cmd of candidates) {
    const ok = await canRun(cmd, ["-h"]);
    if (ok) return cmd;
  }
  return null;
}

function diffPng(args: { actualPath: string; goldenPath: string; diffPath: string }): boolean {
  const a = PNG.sync.read(readFileSync(args.actualPath));
  const b = PNG.sync.read(readFileSync(args.goldenPath));

  if (a.width !== b.width || a.height !== b.height) {
    writeFileSync(args.diffPath, PNG.sync.write(a));
    return false;
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
    includeAA: true,
  });

  // 1px でも差分が出たら失敗扱い (golden 運用前提)
  if (diffPixels > 0) {
    writeFileSync(args.diffPath, PNG.sync.write(diff));
    return false;
  }

  return true;
}
