/**
 * Import word dictionaries from youdaokaoshendict
 * Downloads zip files, extracts JSON, and converts to project format
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const BOOKS = {
  cet4: 'http://ydschool-online.nos.netease.com/1524052539052_CET4luan_2.zip',
  cet6: 'http://ydschool-online.nos.netease.com/1524052554766_CET6_2.zip',
  ielts: 'http://ydschool-online.nos.netease.com/1521164624473_IELTSluan_2.zip',
  toefl: 'http://ydschool-online.nos.netease.com/1521164640451_TOEFL_2.zip',
};

const TEMP_DIR = path.join(__dirname, '_temp');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'words');

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    console.log(`  Downloading: ${url}`);
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

function extractZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

function convertEntry(entry) {
  const word = entry.headWord || '';
  const content = entry.content?.word?.content || {};
  const trans = content.trans || [];
  const sentences = content.sentence?.sentences || [];

  // Get phonetic (prefer US, fallback to UK)
  const phonetic = content.usphone || content.ukphone || '';

  // Get English meaning from first translation
  const meaning = trans[0]?.tranOther || '';

  // Get Chinese meaning - combine all translations
  const meaningCn = trans.map(t => {
    const pos = t.pos ? `${t.pos}. ` : '';
    return pos + (t.tranCn || '');
  }).filter(Boolean).join('；') || '';

  // Get example sentence
  const example = sentences[0]?.sContent || '';

  return { word, phonetic: phonetic ? `/${phonetic}/` : '', meaning, meaningCn, example };
}

function findJsonFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findJsonFiles(fullPath));
    } else if (item.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function processBook(level, url) {
  console.log(`\n[${level}] Processing...`);

  const zipPath = path.join(TEMP_DIR, `${level}.zip`);
  const extractDir = path.join(TEMP_DIR, level);

  // Download
  await downloadFile(url, zipPath);
  console.log(`  Downloaded to ${zipPath}`);

  // Extract
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
  extractZip(zipPath, extractDir);
  console.log(`  Extracted to ${extractDir}`);

  // Find JSON files
  const jsonFiles = findJsonFiles(extractDir);
  console.log(`  Found ${jsonFiles.length} JSON file(s)`);

  // Convert all entries (NDJSON format - one JSON object per line)
  const allWords = [];
  const seen = new Set();
  for (const jsonFile of jsonFiles) {
    try {
      const content = fs.readFileSync(jsonFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const converted = convertEntry(entry);
          if (converted.word && !seen.has(converted.word.toLowerCase())) {
            seen.add(converted.word.toLowerCase());
            allWords.push(converted);
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    } catch (e) {
      console.log(`  Warning: Failed to read ${jsonFile}: ${e.message}`);
    }
  }

  // Sort by word
  allWords.sort((a, b) => a.word.localeCompare(b.word));

  // Write output
  const outputPath = path.join(OUTPUT_DIR, `${level}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allWords, null, 2), 'utf8');
  console.log(`  Wrote ${allWords.length} words to ${outputPath}`);

  // Cleanup zip
  fs.unlinkSync(zipPath);

  return allWords.length;
}

async function main() {
  // Ensure temp dir exists
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  let total = 0;
  for (const [level, url] of Object.entries(BOOKS)) {
    const count = await processBook(level, url);
    total += count;
  }

  // Cleanup temp dir
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log(`\nDone! Imported ${total} words total.`);
}

main().catch(e => { console.error(e); process.exit(1); });
