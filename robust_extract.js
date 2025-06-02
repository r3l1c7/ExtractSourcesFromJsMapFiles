#!/usr/bin/env node
'use strict';
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { promisify } = require('util');

const setImmediateP = promisify(setImmediate);

const OUTDIR = path.join(__dirname, 'src-recovered');
const MAX_CONCURRENT_WRITES = 5; // Reduced for stability
const BATCH_SIZE = 10; // Much smaller batches
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit per file
const WRITE_TIMEOUT = 10000; // 10 second timeout per write

// Ensure output directory exists
fsSync.mkdirSync(OUTDIR, { recursive: true });

function cleanPath(sourcePath) {
  let clean = sourcePath
    .replace(/^webpack:\/\//, '')
    .replace(/^\.?\//, '')
    .replace(/\?.*$/, '')
    .replace(/\\/g, '/');
  
  if (clean.endsWith('/')) clean += 'index.js';
  if (!clean.includes('.')) clean += '.js';
  
  // Sanitize path to prevent issues
  clean = clean.replace(/[<>:"|?*]/g, '_');
  
  return clean;
}

// Simple semaphore for controlling concurrency
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }
  
  async acquire() {
    return new Promise((resolve) => {
      if (this.current < this.max) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }
  
  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const resolve = this.queue.shift();
      resolve();
    }
  }
}

const writeSemaphore = new Semaphore(MAX_CONCURRENT_WRITES);

async function writeFileWithTimeout(filepath, content) {
  const writePromise = (async () => {
    await writeSemaphore.acquire();
    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Check if file exists first
      try {
        await fs.access(filepath);
        return false; // File exists, skipped
      } catch {
        // File doesn't exist, proceed
      }
      
      await fs.writeFile(filepath, content);
      return true; // File written
    } finally {
      writeSemaphore.release();
    }
  })();
  
  // Race between write and timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Write timeout')), WRITE_TIMEOUT);
  });
  
  try {
    return await Promise.race([writePromise, timeoutPromise]);
  } catch (error) {
    console.warn(`⚠️  Write failed for ${path.basename(filepath)}: ${error.message}`);
    return false;
  }
}

async function processMapFile(mapFile) {
  const mapPath = path.join(__dirname, mapFile);
  
  try {
    console.log(`📁 Processing ${mapFile}...`);
    
    // Read with timeout
    const readPromise = fs.readFile(mapPath, 'utf8');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Read timeout')), 30000);
    });
    
    const raw = await Promise.race([readPromise, timeoutPromise]);
    
    // Check file size
    if (raw.length > 50 * 1024 * 1024) {
      console.warn(`⚠️  Skipping ${mapFile} - too large (${Math.round(raw.length / 1024 / 1024)}MB)`);
      return;
    }
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      console.error(`❌  ${mapFile} - invalid JSON: ${parseError.message}`);
      return;
    }
    
    const { sources = [], sourcesContent = [] } = parsed;
    
    if (!sources.length) {
      console.warn(`⚠️  ${mapFile} has no sources`);
      return;
    }
    
    const chunkDir = path.join(OUTDIR, path.basename(mapFile, '.js.map'));
    await fs.mkdir(chunkDir, { recursive: true });
    
    let processed = 0;
    let written = 0;
    let skipped = 0;
    
    console.log(`  Processing ${sources.length} sources in batches of ${BATCH_SIZE}...`);
    
    // Process files one by one to avoid stalls
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const content = sourcesContent[i];
      
      if (!content || typeof content !== 'string') {
        processed++;
        continue;
      }
      
      // Skip large files
      if (content.length > MAX_FILE_SIZE) {
        console.warn(`⚠️  Skipping large source ${source} (${Math.round(content.length / 1024)}KB)`);
        skipped++;
        processed++;
        continue;
      }
      
      const cleanedPath = cleanPath(source);
      const fullPath = path.join(chunkDir, cleanedPath);
      
      try {
        const wasWritten = await writeFileWithTimeout(fullPath, content);
        if (wasWritten) written++;
      } catch (error) {
        console.warn(`⚠️  Failed to write ${cleanedPath}: ${error.message}`);
      }
      
      processed++;
      
      // Progress update every 10 files
      if (processed % 10 === 0 || processed === sources.length) {
        process.stdout.write(
          `\r  ${mapFile}: ${processed}/${sources.length} processed, ${written} written, ${skipped} skipped`
        );
      }
      
      // Yield control every few files
      if (processed % 5 === 0) {
        await setImmediateP();
      }
    }
    
    console.log(`\n✅ ${mapFile} complete: ${written} files written, ${skipped} skipped`);
    
  } catch (error) {
    console.error(`❌  Error processing ${mapFile}: ${error.message}`);
  }
}

(async () => {
  try {
    // Find all map files
    const files = await fs.readdir(__dirname);
    const mapFiles = files.filter(f => f.endsWith('.js.map'));
    
    if (mapFiles.length === 0) {
      console.log('No .js.map files found in current directory');
      return;
    }
    
    console.log(`Found ${mapFiles.length} map files to process`);
    
    // Process files one at a time
    for (let i = 0; i < mapFiles.length; i++) {
      const mapFile = mapFiles[i];
      console.log(`\n[${i + 1}/${mapFiles.length}] Starting ${mapFile}`);
      
      await processMapFile(mapFile);
      
      // Brief pause between files
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🏁 All maps processed – check src-recovered/');
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
})();
