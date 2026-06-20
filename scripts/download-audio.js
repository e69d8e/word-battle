const fs = require("fs")
const path = require("path")
const https = require("https")

// Word JSON files to parse
const wordFiles = ["cet4.json", "cet6.json", "toefl.json", "ielts.json"]
const dataDir = path.join(__dirname, "../src/data/words")
const outputDir = path.join(__dirname, "../public/audio")

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Extract all unique words
const words = new Set()
wordFiles.forEach((file) => {
  const filePath = path.join(dataDir, file)
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
      data.forEach((item) => {
        if (item.word) {
          // Normalize to lowercase and remove spaces
          words.add(item.word.toLowerCase().trim())
        }
      });
    } catch (e) {
      console.error(`Error reading ${file}:`, e)
    }
  }
})

console.log(`Found ${words.size} unique words across all vocabulary lists.`)

const wordArray = Array.from(words)
const CONCURRENCY = 10 // Max concurrent downloads
const BATCH_DELAY = 100 // Delay between downloads in ms

function downloadWord(word) {
  return new Promise((resolve) => {
    // Replace characters that are invalid in filenames
    const safeWord = encodeURIComponent(word)
    const dest = path.join(outputDir, `${word}.mp3`)

    if (fs.existsSync(dest)) {
      resolve({ word, skipped: true })
      return
    }

    // Youdao TTS US Accent voice
    const url = `https://dict.youdao.com/dictvoice?audio=${safeWord}&type=2`
    const file = fs.createWriteStream(dest)

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {})
        resolve({ word, error: `HTTP Status ${response.statusCode}` })
        return
      }
      response.pipe(file)
      file.on("finish", () => {
        file.close()
        resolve({ word, success: true })
      })
    }).on("error", (err) => {
      fs.unlink(dest, () => {})
      resolve({ word, error: err.message })
    })
  })
}

async function run() {
  console.log(`Starting download of ${wordArray.length} word audio files to public/audio/...`)
  
  const activeDownloads = []
  let completedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (let i = 0; i < wordArray.length; i++) {
    const word = wordArray[i]

    const promise = downloadWord(word).then((res) => {
      completedCount++
      if (res.skipped) {
        skippedCount++
      } else if (res.error) {
        failedCount++
        console.error(`[${completedCount}/${wordArray.length}] Failed "${word}": ${res.error}`)
      }

      if (completedCount % 500 === 0) {
        console.log(`Progress: ${completedCount}/${wordArray.length} processed. (Skipped: ${skippedCount}, Failed: ${failedCount})`)
      }

      const idx = activeDownloads.indexOf(promise)
      if (idx > -1) activeDownloads.splice(idx, 1)
    })

    activeDownloads.push(promise)

    if (activeDownloads.length >= CONCURRENCY) {
      await Promise.race(activeDownloads)
    }

    await new Promise((r) => setTimeout(r, BATCH_DELAY))
  }

  await Promise.all(activeDownloads)
  console.log(`\nDownload completed!`)
  console.log(`Total words: ${wordArray.length}`)
  console.log(`Successfully downloaded/verified: ${completedCount - failedCount}`)
  console.log(`Skipped (already exists): ${skippedCount}`)
  console.log(`Failed: ${failedCount}`)
}

run()
