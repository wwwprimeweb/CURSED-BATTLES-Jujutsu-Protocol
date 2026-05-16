// scripts/generate-icons.js
// Uses Node.js built-in global fetch (available in Node 18+)

const fs = require('fs');
const path = require('path');

const API_KEY = "AIzaSyD20sT3KUOg5RxkUwhmTLRy_ZIJMe2oQUA";
const MODEL_NAME = "gemini-2.5-flash-image";
const OUTPUT_DIR = "client/assets";

const characters = [
  { name: "gojo",    prompt: "Minimalist dark icon of Satoru Gojo from Jujutsu Kaisen. Single blue glowing eye (Six Eyes) centered, half face with white hair. Minimal line art, very dark background, only cyan blue accent. Seinen aesthetic. 512x512." },
  { name: "sukuna",  prompt: "Minimalist dark icon of Sukuna from Jujutsu Kaisen. Minimalist 2D shrine torii structure with diagonal cuts across it. Only blood red accent. Dark background. 512x512." },
  { name: "yuta",    prompt: "Minimalist dark icon of Yuta Okkotsu from Jujutsu Kaisen. 2D circular ring with depth (concentric layers), glowing energy flames rising from the edge. Only royal blue accent. Dark background. 512x512." },
  { name: "yuji",    prompt: "Minimalist dark icon of Yuji Itadori from Jujutsu Kaisen. Fist with bandages wrapping forearm, pink cursed energy sparks. Only dark pink accent. Dark background. 512x512." },
  { name: "megumi",  prompt: "Minimalist dark icon of Megumi Fushiguro from Jujutsu Kaisen. 2D Mahoraga wheel with depth (concentric layers, 8 spokes, detailed center, spinning effect). Shadow aura around the wheel. Only dark purple accent. 512x512." },
  { name: "hakari",  prompt: "Minimalist dark icon of Kinji Hakari from Jujutsu Kaisen. 2D isometric dice with number 7, neon electric sparks around it. Only neon green accent. Dark background. 512x512." },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateImage(character, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: character.prompt }] }],
          }),
        }
      );
      if (res.status === 429) {
        const wait = Math.min(15, attempt * 5);
        console.log(`  Rate limited. Retrying in ${wait}s (attempt ${attempt}/${retries})...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.json();
        console.error(`API error ${character.name}:`, res.status, err.error?.message || JSON.stringify(err));
        return null;
      }
      const data = await res.json();
      for (const part of data.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.mimeType === 'image/png') return part.inlineData.data;
      }
      console.error(`No PNG data for ${character.name}:`, JSON.stringify(data).slice(0, 500));
      return null;
    } catch (e) {
      console.error(`Exception for ${character.name} (attempt ${attempt}):`, e.message);
      if (attempt < retries) await sleep(5000);
    }
  }
  console.error(`Failed ${character.name} after ${retries} attempts`);
  return null;
}

async function saveImage(character, base64) {
  if (!base64) return;
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const fp = path.join(OUTPUT_DIR, `${character.name}-icon.png`);
  fs.writeFileSync(fp, Buffer.from(base64, 'base64'));
  console.log(`  Saved ${character.name}-icon.png`);
}

(async () => {
  for (const c of characters) {
    console.log(`\nGenerating ${c.name}...`);
    const data = await generateImage(c);
    if (data) await saveImage(c, data);
    else console.log(`  Skipped ${c.name}`);
    await sleep(3000); // Delay between characters
  }
  console.log('\nDone!');
})();
