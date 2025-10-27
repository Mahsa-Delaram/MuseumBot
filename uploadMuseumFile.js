// uploadMuseumFile.js
import 'dotenv/config';
import fs from 'fs';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  try {
    // Use your existing JSON file
    const fileStream = fs.createReadStream('./data/museum.json');

    const file = await client.files.create({
      file: fileStream,
      // For grounding with Assistants / tools, use "assistants".
      // (Use "fine-tune" only if you're uploading a proper .jsonl training dataset.)
      purpose: 'assistants',
      // Optional: auto-expire the uploaded file after ~30 days
      // expires_after: { anchor: 'created_at', seconds: 2592000 }
    });

    console.log('✅ Uploaded file:');
    console.log(file);

    // Handy: print just the id for your .env
    console.log('\n👉 Save this in .env as:');
    console.log(`ASSISTANTS_FILE_ID=${file.id}\n`);
  } catch (err) {
    console.error('❌ Upload failed:', err);
  }
}

main();
