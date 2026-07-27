/**
 * Writes the `latest.json` that her app polls.
 *
 * Doing this by hand is where releases go wrong: the signature is a long opaque
 * blob, the platform key has to match her architecture exactly, and a mistake in
 * either produces an update that silently never applies. So it is read straight
 * off the built artifacts instead.
 *
 *   npm run release:manifest
 *
 * Then attach the three named files to a GitHub release. See docs/UPDATES.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const bundleDir = path.join(root, "src-tauri/target/release/bundle/macos");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tauriConf = JSON.parse(fs.readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"));

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

if (pkg.version !== tauriConf.version) {
  fail(
    `version mismatch: package.json is ${pkg.version}, tauri.conf.json is ${tauriConf.version}. ` +
      `They must match, or the built app reports one version and the manifest advertises another.`,
  );
}

if (String(tauriConf.plugins?.updater?.pubkey ?? "").startsWith("REPLACE_WITH")) {
  fail(
    `tauri.conf.json still has the placeholder updater pubkey. Generate a keypair first:\n` +
      `  npm run tauri signer generate -- -w ~/.tauri/showa-updater.key\n` +
      `See docs/UPDATES.md.`,
  );
}

if (!fs.existsSync(bundleDir)) {
  fail(`no macOS bundle found at ${path.relative(root, bundleDir)} — run "npm run tauri build" first.`);
}

const archive = fs.readdirSync(bundleDir).find((name) => name.endsWith(".app.tar.gz"));
if (!archive) {
  fail(
    `no .app.tar.gz in ${path.relative(root, bundleDir)}. ` +
      `Check that bundle.createUpdaterArtifacts is true in tauri.conf.json.`,
  );
}

const signaturePath = path.join(bundleDir, `${archive}.sig`);
if (!fs.existsSync(signaturePath)) {
  fail(
    `${archive} has no .sig beside it. The build did not sign the update — ` +
      `export TAURI_SIGNING_PRIVATE_KEY before "npm run tauri build".`,
  );
}

const signature = fs.readFileSync(signaturePath, "utf8").trim();

/**
 * Apple Silicon reports `darwin-aarch64`. A universal build serves both keys
 * from the same archive, which costs nothing and removes a whole category of
 * "the update silently never applies" confusion.
 */
const downloadUrl =
  `https://github.com/alekpeed/showa/releases/download/v${pkg.version}/` +
  encodeURIComponent(archive);

const platform = { signature, url: downloadUrl };

const manifest = {
  version: pkg.version,
  notes: "",
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-aarch64": platform,
    "darwin-x86_64": platform,
  },
};

const outPath = path.join(bundleDir, "latest.json");
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`\nwrote ${path.relative(root, outPath)} for version ${pkg.version}\n`);
console.log("Attach these three files to a GitHub release tagged v" + pkg.version + ":");
console.log(`  ${archive}`);
console.log(`  ${archive}.sig`);
console.log("  latest.json\n");
console.log("Then install the PREVIOUS version on a fresh macOS user account,");
console.log("launch it twice, and confirm it becomes " + pkg.version + ".\n");
