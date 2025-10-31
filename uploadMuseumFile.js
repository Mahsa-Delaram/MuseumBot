
import 'dotenv/config';
import fs from 'fs';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  try {
    
    const fileStream = fs.createReadStream('./data/museum.json');

    const file = await client.files.create({
      file: fileStream,
      purpose: 'assistants',
    });

    console.log('✅ Uploaded file:');
    console.log(file);

    console.log('\n👉 Save this in .env as:');
    console.log(`ASSISTANTS_FILE_ID=${file.id}\n`);
  } catch (err) {
    console.error('❌ Upload failed:', err);
  }
}

main();
