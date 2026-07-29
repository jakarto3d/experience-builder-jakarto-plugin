#!/usr/bin/env node
// Builds the release artifacts for a given tag:
//
//   <out-dir>/Jakartowns-<tag>.zip         source only, for a Developer Edition
//   <out-dir>/Jakartowns-<tag>-portal.zip  built, for an ArcGIS Enterprise portal
//
// This is the single code path used both by `.github/workflows/release.yml`
// and by `just build-release` locally, so a release can be rehearsed in full
// before the tag that publishes it is ever pushed — see
// docs/adr/0016-rehearsable-release-build.md.
//
// The portal build needs the ArcGIS Experience Builder SDK, which is
// downloaded on demand via ./fetch-exb-sdk.mjs and then cached, unpacked and
// `npm install`ed, under --cache-dir. That directory is several GB and is
// deliberately reused across runs; `--fresh` throws it away.
//
// Usage: node scripts/build-release.mjs [options]
//
//   --tag <name>       release tag to name the zips after (default: v<manifest version>)
//   --out-dir <dir>    where to write the zips (default: dist-release)
//   --cache-dir <dir>  where to keep the SDK zip and its unpacked copy (default: .exb-cache)
//   --source-only      skip the portal build (fast; no SDK download)
//   --fresh            re-download and re-unpack the SDK instead of reusing the cache
//   --skip-node-check  build even if the running Node version isn't 20.x

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widgetDir = path.join(repoRoot, "widgets", "Jakartowns");

// ArcGIS Experience Builder's own build breaks on newer Node with a
// `tinyglobby` error, so the SDK build has to run on 20.x — the same
// constraint widgets/Jakartowns/README.md documents for `npm start`.
const REQUIRED_NODE_MAJOR = 20;

const options = parseArgs(process.argv.slice(2));

const manifest = JSON.parse(readFileSync(path.join(widgetDir, "manifest.json"), "utf8"));
const tag = options.tag ?? `v${manifest.version}`;
const outDir = path.resolve(repoRoot, options["out-dir"] ?? "dist-release");
const cacheDir = path.resolve(repoRoot, options["cache-dir"] ?? ".exb-cache");
// The downloads page publishes one zip per major.minor; manifest.json pins a
// full major.minor.patch.
const exbVersion = manifest.exbVersion.split(".").slice(0, 2).join(".");

// Checked up front rather than after the source zip is written, so a wrong
// Node version doesn't leave half a release behind.
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (!options["source-only"] && nodeMajor !== REQUIRED_NODE_MAJOR && !options["skip-node-check"]) {
  fail(
    `The Experience Builder SDK build needs Node ${REQUIRED_NODE_MAJOR}.x, but this is ` +
      `Node ${process.versions.node}. Newer versions fail on a 'tinyglobby' error.\n` +
      `Re-run under the right version, e.g.:\n` +
      `  fnm exec --using v20.20.2 node scripts/build-release.mjs ${process.argv.slice(2).join(" ")}\n` +
      `Or pass --source-only to skip the portal build, or --skip-node-check to try anyway.`
  );
}

mkdirSync(outDir, { recursive: true });

const sourceZip = path.join(outDir, `Jakartowns-${tag}.zip`);
step(`Packaging the source-only zip for ${tag}`);
zipDir(path.join(repoRoot, "widgets"), "Jakartowns", sourceZip);

if (options["source-only"]) {
  console.log(`\nDone (source only):\n  ${path.relative(repoRoot, sourceZip)}`);
  process.exit(0);
}

if (options.fresh) {
  rmSync(cacheDir, { recursive: true, force: true });
}
mkdirSync(cacheDir, { recursive: true });

const sdkZip = path.join(cacheDir, `arcgis-experience-builder-${exbVersion}.zip`);
if (existsSync(sdkZip)) {
  step(`Reusing the cached Experience Builder ${exbVersion} SDK zip`);
} else {
  step(`Downloading the Experience Builder ${exbVersion} SDK`);
  run(process.execPath, [path.join(repoRoot, "scripts", "fetch-exb-sdk.mjs"), exbVersion, sdkZip]);
}

const sdkDir = path.join(cacheDir, `sdk-${exbVersion}`);
const clientDir = path.join(sdkDir, "ArcGISExperienceBuilder", "client");
if (existsSync(clientDir)) {
  step(`Reusing the unpacked SDK in ${path.relative(repoRoot, sdkDir)}`);
} else {
  step("Unpacking the SDK");
  rmSync(sdkDir, { recursive: true, force: true });
  run("unzip", ["-q", sdkZip, "-d", sdkDir]);
  if (!existsSync(clientDir)) {
    fail(`The SDK zip did not contain the expected ${path.relative(sdkDir, clientDir)} folder.`);
  }
}

if (existsSync(path.join(clientDir, "node_modules"))) {
  step("Reusing the SDK's installed dependencies");
} else {
  step("Installing the SDK's dependencies (slow, cached for later runs)");
  run("npm", ["install"], clientDir);
}

step("Copying the widget into the SDK's your-extensions/widgets/");
const extensionDir = path.join(clientDir, "your-extensions", "widgets", "Jakartowns");
rmSync(extensionDir, { recursive: true, force: true });
mkdirSync(path.dirname(extensionDir), { recursive: true });
cpSync(widgetDir, extensionDir, { recursive: true });

step("Building the widget against the SDK");
// build:prod appends to whatever is already in dist-prod/, which would let a
// previous run's stale output survive into the zip.
rmSync(path.join(clientDir, "dist-prod"), { recursive: true, force: true });
run("npm", ["run", "build:prod"], clientDir);

const builtWidgetDir = path.join(clientDir, "dist-prod", "widgets", "Jakartowns");
// The whole point of this artifact is the compiled bundle a portal loads:
// shipping a zip without it registers a widget that 404s at runtime
// (see ADR-0015).
for (const required of ["manifest.json", path.join("dist", "runtime", "widget.js")]) {
  if (!existsSync(path.join(builtWidgetDir, required))) {
    fail(`The build did not produce ${required} — refusing to package a broken portal zip.`);
  }
}

const portalZip = path.join(outDir, `Jakartowns-${tag}-portal.zip`);
step("Packaging the portal-ready zip");
zipDir(path.join(clientDir, "dist-prod", "widgets"), "Jakartowns", portalZip);

console.log(
  `\nDone:\n  ${path.relative(repoRoot, sourceZip)}\n  ${path.relative(repoRoot, portalZip)}`
);

function parseArgs(argv) {
  const flags = new Set(["source-only", "fresh", "skip-node-check"]);
  const values = new Set(["tag", "out-dir", "cache-dir"]);
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    if (flags.has(name)) {
      parsed[name] = true;
    } else if (values.has(name)) {
      parsed[name] = argv[++i];
      if (parsed[name] === undefined) fail(`--${name} needs a value.`);
    } else {
      fail(`Unknown argument: ${argv[i]}. See the usage comment at the top of this file.`);
    }
  }
  return parsed;
}

// `zip -r` updates an existing archive in place rather than replacing it, so a
// stale zip from an earlier run would keep files that no longer exist.
function zipDir(parentDir, dirName, zipPath) {
  rmSync(zipPath, { force: true });
  run("zip", ["-qr", zipPath, dirName], parentDir);
}

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(" ")} exited with code ${result.status}.`);
}

function step(message) {
  console.log(`\n==> ${message}`);
}

function fail(message) {
  console.error(`\nbuild-release: ${message}`);
  process.exit(1);
}
