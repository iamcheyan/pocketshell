import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("missing staged app directory");
const decoder = new TextDecoder("gbk");
const characters = new Set<string>();
for (let high = 0xb0; high <= 0xf7; high++) {
  for (let low = 0xa1; low <= 0xfe; low++) {
    const character = decoder.decode(new Uint8Array([high, low]));
    if (character !== "\ufffd") characters.add(character);
  }
}
for (let codepoint = 0x3041; codepoint <= 0x30ff; codepoint++) characters.add(String.fromCodePoint(codepoint));
for (const file of ["launcher-catalog.ts", "i18n.ts", "main.tsx", "save-manager.tsx", "file-browser.tsx"]) {
  try {
    const src = readFileSync(join(__dirname, "../app", file), "utf8");
    for (const char of src) {
      if (char.codePointAt(0)! > 127) characters.add(char);
    }
  } catch {}
}
writeFileSync(join(directory, "library-characters.txt"), [...characters].join(""));
const configPath = join(directory, "fonts.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.characterFiles = [...(config.characterFiles ?? []), "library-characters.txt"];
writeFileSync(configPath, JSON.stringify(config, null, 2));
