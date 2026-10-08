import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Resolve through the actual consumers, not through a separately installed
// copy: these tests must exercise the patched production/tooling graph.
const mobileRequire = createRequire(
  new URL("../../artifacts/xucasa-mobile/package.json", import.meta.url),
);
const cliRequire = createRequire(mobileRequire.resolve("@expo/cli"));
const metroRequire = createRequire(cliRequire.resolve("@expo/metro/package.json"));
const fileMapRequire = createRequire(metroRequire.resolve("metro-file-map"));
const micromatchRequire = createRequire(fileMapRequire.resolve("micromatch"));
const braces = micromatchRequire("braces");
const forge = cliRequire("node-forge");
const actualMetroRequire = createRequire(metroRequire.resolve("metro/package.json"));
const metroAssets = actualMetroRequire("./src/Assets.js");

test("Metro uses the fixed image parser for buffers and asset files", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  assert.deepEqual(metroAssets.getAssetSize("png", png, "test.png"), { width: 1, height: 1 });
  assert.equal(typeof actualMetroRequire("image-size").imageSize, "function");
  const directory = mkdtempSync(join(tmpdir(), "metro-image-test-"));
  try {
    const file = join(directory, "test.png");
    writeFileSync(file, png);
    const asset = await metroAssets.getAssetData(file, "test.png", [], null, "/assets");
    assert.equal(asset.width, 1);
    assert.equal(asset.height, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("braces keeps normal expansion and matching behavior", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/{a,b}.js"), [
    "src/app/a.js", "src/app/b.js", "src/lib/a.js", "src/lib/b.js",
  ]);
  assert.deepEqual(braces.expand("item-{1..3}"), ["item-1", "item-2", "item-3"]);
  assert.equal(braces.compile("file-{a,b}.js"), "file-(a|b).js");
  assert.equal(braces.stringify(braces.parse("src/{a,b}")), "src/{a,b}");
  assert.deepEqual(braces.expand("\\{literal\\}"), ["{literal}"]);
});

test("braces rejects deeply nested strings before recursive walkers run", () => {
  for (const pattern of [
    "{".repeat(5000) + "a,b" + "}".repeat(5000),
    "(".repeat(5000) + "a" + ")".repeat(5000),
    "{(".repeat(2500) + "a,b" + ")}".repeat(2500),
    "{".repeat(5000),
  ]) {
    for (const method of ["parse", "compile", "expand", "stringify"]) {
      assert.throws(() => braces[method](pattern), SyntaxError);
    }
  }
});

test("braces guards caller-supplied deep and cyclic ASTs", () => {
  let ast = { type: "text", value: "x" };
  for (let i = 0; i < 5000; i++) ast = { type: "root", nodes: [ast] };
  const cyclic = { type: "root", nodes: [] };
  cyclic.nodes.push(cyclic);
  const wide = { type: "root", nodes: Array.from(
    { length: 65537 }, () => ({ type: "text", value: "x" }),
  ) };
  for (const method of ["compile", "expand", "stringify"]) {
    for (const input of [ast, cyclic, wide]) {
      assert.throws(() => braces[method](input), SyntaxError);
    }
  }
});

// The advisory specifically concerns low-exponent RSA keys.
const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
const digest = forge.md.sha256.create().update("security regression");
const digestBytes = digest.digest().getBytes();
const { asn1 } = forge;
const element = (type, constructed, value) =>
  asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
const algorithmOid = () => element(
  asn1.Type.OID, false, asn1.oidToDer(forge.oids.sha256).getBytes(),
);
const nullParameter = () => element(asn1.Type.NULL, false, "");
const signatureWithAlgorithm = (algorithmElements, extraRoot = []) => {
  const info = element(asn1.Type.SEQUENCE, true, [
    element(asn1.Type.SEQUENCE, true, algorithmElements),
    element(asn1.Type.OCTETSTRING, false, digestBytes),
    ...extraRoot,
  ]);
  return forge.pki.rsa.encrypt(asn1.toDer(info).getBytes(), keys.privateKey, 0x01);
};

test("forge still verifies standard signatures and optional SHA parameters", () => {
  assert.equal(keys.publicKey.verify(digestBytes, keys.privateKey.sign(digest)), true);
  for (const elements of [[algorithmOid()], [algorithmOid(), nullParameter()]]) {
    assert.equal(keys.publicKey.verify(digestBytes, signatureWithAlgorithm(elements)), true);
  }
  assert.equal(keys.publicKey.verify("wrong digest", keys.privateKey.sign(digest)), false);
});

test("forge rejects extra DigestAlgorithm elements, with or without NULL", () => {
  for (const elements of [
    [algorithmOid(), nullParameter(), nullParameter()],
    [algorithmOid(), element(asn1.Type.OCTETSTRING, false, "garbage")],
    [algorithmOid(), nullParameter(), element(asn1.Type.SEQUENCE, true, [nullParameter()])],
  ]) {
    assert.throws(
      () => keys.publicKey.verify(digestBytes, signatureWithAlgorithm(elements)),
      /valid RSASSA-PKCS1-v1_5/,
    );
  }
  assert.throws(
    () => keys.publicKey.verify(digestBytes, signatureWithAlgorithm(
      [algorithmOid(), nullParameter()], [nullParameter()],
    )),
    /valid RSASSA-PKCS1-v1_5/,
  );
});

test("security patches are registered for fresh and frozen installs", () => {
  const workspace = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
  assert.match(workspace, /braces@3\.0\.3: patches\/braces@3\.0\.3\.patch/);
  assert.match(workspace, /node-forge@1\.4\.0: patches\/node-forge@1\.4\.0\.patch/);
});

test("actual consumers load the exact security patches recorded in the lockfile", () => {
  const lockfile = readFileSync(new URL("../../pnpm-lock.yaml", import.meta.url), "utf8");
  for (const [name, version, consumer] of [
    ["braces", "3.0.3", micromatchRequire],
    ["node-forge", "1.4.0", cliRequire],
  ]) {
    const patch = readFileSync(new URL(
      `../../patches/${name}@${version}.patch`, import.meta.url,
    ));
    const hash = createHash("sha256").update(patch).digest("hex");
    const entry = `${name}@${version}:\n    hash: ${hash}\n    path: patches/${name}@${version}.patch`;
    assert.ok(lockfile.includes(entry), `${name}: lockfile must match patch contents`);
    assert.ok(
      consumer.resolve(name).includes(`${name}@${version}_patch_hash=${hash}/`),
      `${name}: consumer must load the patched copy, not a stale installation`,
    );
  }
});
