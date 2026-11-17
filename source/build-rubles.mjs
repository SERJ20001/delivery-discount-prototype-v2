import { buildEntry, updateEntryManifest } from './build-entry.mjs';
import { readFile, writeFile, copyFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'rubles');
await copyFile(path.join(root, 'percent/discount-model.js'), path.join(output, 'discount-model.js'));
const entryScreen = await buildEntry(root, output);
const versions = {};
let html = await readFile(path.join(root, 'source/rubles.template.html'), 'utf8');
html = html.replace('{{ENTRY_SCREEN}}', entryScreen);
for (const file of ['entry-screen.css', 'entry-screen.js', 'style.css', 'discount-model.js', 'catalog.js', 'motion.js', 'app.js']) {
  versions[file] = createHash('sha256').update(await readFile(path.join(output, file))).digest('hex').slice(0, 12);
  html = html.replace(`"${file}"`, `"${file}?v=${versions[file]}"`);
}
await writeFile(path.join(output, 'index.html'), html);
await writeFile(path.join(output, 'build.json'), JSON.stringify({ versions, revision: createHash('sha256').update(html).digest('hex') }, null, 2) + '\n');
const bundledAssets = {};
const mime = { '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
for (const relative of await readdir(path.join(output, 'assets'), { recursive: true })) {
  if (!mime[path.extname(relative)]) continue;
  const bytes = await readFile(path.join(output, 'assets', relative));
  bundledAssets[`assets/${relative}`] = `data:${mime[path.extname(relative)]};base64,${bytes.toString('base64')}`;
}
let standalone = await readFile(path.join(root, 'source/rubles.template.html'), 'utf8');
standalone = standalone.replace('{{ENTRY_SCREEN}}', entryScreen);
standalone = standalone.replace('<link rel="stylesheet" href="entry-screen.css">', `<style>${await readFile(path.join(output, 'entry-screen.css'), 'utf8')}</style>`);
standalone = standalone.replace('<link rel="stylesheet" href="style.css">', `<style>${await readFile(path.join(output, 'style.css'), 'utf8')}</style>`);
let runtime = await readFile(path.join(output, 'app.js'), 'utf8');
runtime = runtime.replace('const asset = name => `assets/current/${name}`;', "const asset = name => bundledAssets[`assets/current/${name}`];");
runtime = runtime.replaceAll("'assets/checkbox-inactive.svg'", JSON.stringify(bundledAssets['assets/checkbox-inactive.svg']));
runtime = runtime.replace('`url("assets/avito-sans-text-${name}.woff2")`', '`url("${bundledAssets[`assets/avito-sans-text-${name}.woff2`]}")`');
const scripts = [await readFile(path.join(output, 'entry-screen.js'), 'utf8'), await readFile(path.join(output, 'discount-model.js'), 'utf8'), await readFile(path.join(output, 'catalog.js'), 'utf8'), await readFile(path.join(output, 'motion.js'), 'utf8'), `const bundledAssets = ${JSON.stringify(bundledAssets)};\n${runtime}`];
standalone = standalone.replace(/<script src="[^"]+" defer><\/script>\n/g, '');
standalone = standalone.replace(/src="(assets\/[^"]+)"/g, (_, file) => `src="${bundledAssets[file]}"`);
standalone = standalone.replace(/url\((['"]?)(?:\.\/)?(assets\/[^)'"]+)\1\)/g, (_, quote, file) => `url("${bundledAssets[file]}")`);
standalone = standalone.replace('</body>', `<script>${scripts.join('\n')}</script>\n</body>`);
await mkdir(path.join(root, 'exports'), { recursive: true });
await writeFile(path.join(root, 'exports/delivery-discount-rubles.html'), standalone);
console.log(JSON.stringify(versions));

const manifestPath = path.join(root, 'asset-manifest-rubles.json');
await updateEntryManifest(root, output, manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const newAssets = [
  ['86592.svg', '3544:55840', [14, 16], 'original item edit icon'],
  ['38777.svg', '3544:59146', [10, 16], 'original small clear icon'],
  ['54616.svg', '3570:98312', [21, 21], 'inverse selected checkbox'],
  ['9befd.svg', '3573:111193', [21, 21], 'retired inverse checkbox'],
  ['49135.svg', '3570:98253', [14, 16], 'custom amount edit icon'],
  ['bc31a.svg', '3570:96506', [14, 20], 'discount limits notice tag'],
  ['3c5f8.svg', '3573:111201', [14, 20], 'toast close icon'],
  ['5b3cf.svg', '2043:154632', [32, 18], 'limit switch on', '3574:114010']
];
for (const [name, nodeId, dimensions, role, designContext = '3573:111220'] of newAssets) {
  const file = 'assets/current/' + name;
  const bytes = await readFile(path.join(output, file));
  const entry = { id: name.split('.')[0], file, path: 'rubles/' + file, kind: 'image', used: true, review: 'agent-checked', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), logical: dimensions, physical: dimensions, dimensions, scale: 1, role, sourceNodes: [nodeId], source: { fileKey: 'OaolVHaabrE8Nv9upVA0wD', nodeId }, designContext };
  const index = manifest.assets.findIndex(asset => asset.file === file);
  if (index < 0) manifest.assets.push(entry);
  else manifest.assets[index] = entry;
}
for (const file of Object.keys(bundledAssets)) {
  if (manifest.assets.some(entry => entry.file === file)) continue;
  throw new Error(`Missing asset provenance: ${file}`);
}
manifest.section = '3573:111220';
const retired = ['9befd.svg', 'c8762.svg', 'f84ba.svg', '228b7.svg', 'a31ca.svg', '44895.png', 'd4af4.png', '3d0bd.png', '385c1.png', '38777.svg', '64152.svg', '8bc71.svg', '96048.svg', 'e157a.svg', 'e6ee2.svg', 'ec93c.svg', 'cffe9.png', 'd83ab.png'];
for (const entry of manifest.assets) if (retired.some(name => entry.file === 'assets/current/' + name)) entry.used = false;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
