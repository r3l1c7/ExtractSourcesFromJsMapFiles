# Source Map Extractor

🔧 **Robust JavaScript source code extraction from webpack source maps**

Extract and recover original source files from JavaScript source map files (`.js.map`) with memory-efficient streaming and stall-resistant processing.

## 🚀 Features

- **Stall-resistant processing** - Handles large source maps without hanging
- **Memory efficient** - Streaming JSON parsing for large files
- **Concurrent I/O control** - Throttled file operations to prevent system overload
- **Error recovery** - Continues processing even when individual files fail
- **Progress tracking** - Real-time progress updates with file counts
- **Timeout protection** - Prevents indefinite hangs on problematic files
- **Path sanitization** - Cleans webpack paths and handles edge cases
- **Batch and single-file modes** - Process all maps or individual files

## 📋 Requirements

- Node.js 12+ 
- `stream-json` package for streaming parser
- GNU `parallel` (optional, for batch processing)

```bash
npm install stream-json
```

## 🛠 Installation

1. Clone or download the scripts
2. Install dependencies: `npm install stream-json`
3. Make scripts executable: `chmod +x *.js`

## 📖 Usage

### Batch Processing (Recommended)

Process all `.js.map` files in the current directory:

```bash
node robust_extract.js
```

**Example output:**
```
Found 209 map files to process

[1/209] Starting 1008-f4c73e5cf767cf1a.js.map
📁 Processing 1008-f4c73e5cf767cf1a.js.map...
  Processing 18 sources in batches of 10...
  1008-f4c73e5cf767cf1a.js.map: 18/18 processed, 18 written, 0 skipped
✅ 1008-f4c73e5cf767cf1a.js.map complete: 18 files written, 0 skipped

[2/209] Starting 1016-6032c78158abf86c.js.map
...
```

### Single File Processing

Process individual source map files using the streaming extractor:

```bash
node stream_extract.js app-bundle.js.map
```

### Parallel Processing

For maximum speed with many small files:

```bash
# Install GNU parallel first
sudo apt install parallel  # Ubuntu/Debian
brew install parallel      # macOS

# Process with limited concurrency
parallel -j2 'node stream_extract.js {}' ::: *.js.map
```

## 📁 Output Structure

Extracted files are organized in the `src-recovered/` directory:

```
src-recovered/
├── app-bundle/
│   ├── src/
│   │   ├── components/
│   │   │   └── Header.js
│   │   └── utils/
│   │       └── helpers.js
│   └── node_modules/
│       └── react/
│           └── index.js
├── vendor-bundle/
│   └── ...
└── chunk-12345/
    └── ...
```

Each source map gets its own subdirectory named after the map file (without `.js.map` extension).

## ⚙️ Configuration

### Memory and Performance Tuning

Edit these constants in the scripts to adjust performance:

```javascript
const MAX_CONCURRENT_WRITES = 5;    // Concurrent file operations
const BATCH_SIZE = 10;              // Files per batch
const MAX_FILE_SIZE = 1024 * 1024;  // 1MB limit per source file
const WRITE_TIMEOUT = 10000;        // 10 second write timeout
```

### For Large Source Maps

If you have very large source maps (>50MB), increase memory:

```bash
node --max-old-space-size=8192 robust_extract.js
```

## 🔧 Script Comparison

| Script | Best For | Memory Usage | Stall Resistance | Speed |
|--------|----------|--------------|------------------|-------|
| `robust_extract.js` | **Most cases** | Medium | Excellent | Medium |
| `stream_extract.js` | Large individual files | Low | Good | Fast |
| `improved_batch_extractor.js` | Small files in bulk | High | Fair | Fastest |

## 🚨 Troubleshooting

### Script Stalls at X/Y processed

**Cause:** I/O bottleneck or memory pressure  
**Solution:** Use `robust_extract.js` with lower concurrency:

```javascript
const MAX_CONCURRENT_WRITES = 2;  // Reduce from 5
const BATCH_SIZE = 5;             // Reduce from 10
```

### "Cannot access before initialization" Error

**Cause:** Variable name conflict  
**Solution:** Check for duplicate variable names in scope

### Out of Memory Errors

**Cause:** Large source map files  
**Solutions:**
- Increase Node.js memory: `--max-old-space-size=8192`
- Process files individually with `stream_extract.js`
- Reduce `MAX_FILE_SIZE` limit

### Permission Denied Errors

**Cause:** Insufficient write permissions  
**Solution:** 
```bash
chmod 755 ./src-recovered
# Or run with appropriate permissions
```

### Empty Output Directory

**Cause:** No source content in maps, or all files skipped  
**Check:** Look for warnings about missing `sourcesContent` or oversized files

## 🔍 How It Works

### Source Map Structure

JavaScript source maps contain:
- `sources[]` - Array of original file paths
- `sourcesContent[]` - Array of original file contents (what we extract)
- `mappings` - Compressed mapping data (ignored)

### Path Cleaning Process

Original webpack paths like:
```
webpack:///./src/components/Header.jsx?1234
```

Get cleaned to:
```
src/components/Header.jsx
```

### Processing Flow

1. **Scan** directory for `.js.map` files
2. **Parse** JSON with streaming or regular parser
3. **Extract** `sourcesContent` array
4. **Clean** source paths and create directory structure
5. **Write** files with collision detection
6. **Report** progress and statistics

## 📊 Performance Tips

- **Use SSD storage** for output directory
- **Process overnight** for hundreds of large source maps
- **Monitor disk space** - extracted code can be 10x larger than source maps
- **Use `parallel -j1`** on systems with limited RAM
- **Split very large batches** into smaller chunks

## 🤝 Contributing

Improvements welcome! Areas for enhancement:

- Better duplicate file handling
- Source map validation
- Resume capability for interrupted processing
- Source map merging for related chunks
- TypeScript/JSX syntax preservation

## 📝 License

MIT License - feel free to use and modify

---

**⚡ Quick Start:**
```bash
npm install stream-json
node robust_extract.js
# Check src-recovered/ directory for extracted files
```
