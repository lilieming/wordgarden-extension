import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = import.meta.dirname;
const manifest = JSON.parse(readFileSync(resolve(root, "static/manifest.json"), "utf8"));
const version = manifest.version;
const releaseDir = resolve(root, "release");
const outputs = [
  ["dist", `word-garden-extension-chrome-${version}.zip`],
  ["dist-safari-mac", `word-garden-extension-safari-macos-${version}.zip`],
  ["dist-safari-ios", `word-garden-extension-safari-ios-${version}.zip`]
];

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

const files = [];
for (const [source, name] of outputs) {
  const sourceDir = resolve(root, source);
  if (!existsSync(resolve(sourceDir, "manifest.json"))) {
    throw new Error(`缺少构建产物：${source}/manifest.json`);
  }
  const target = resolve(releaseDir, name);
  execFileSync("zip", ["-qrX", target, "."], { cwd: sourceDir });
  files.push(target);
}

const hashes = files.map((file) => {
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  return `${digest}  ${basename(file)}`;
});
writeFileSync(resolve(releaseDir, "SHA256SUMS.txt"), `${hashes.join("\n")}\n`);

console.log(`扩展 ${version} 安装包：`);
for (const line of hashes) console.log(`  ${line}`);
