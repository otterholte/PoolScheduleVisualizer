/**
 * Simple Node.js server for Pool Schedule Visualizer
 * - Serves static files
 * - Provides API endpoint to save schedule data
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const SCHEDULE_FILE = path.join(__dirname, 'data', 'schedule.json');

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Save schedule
  if (req.method === 'POST' && req.url === '/api/save-schedule') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Validate JSON
        const data = JSON.parse(body);
        
        // Create backup before saving
        const backupFile = SCHEDULE_FILE.replace('.json', `-backup-${Date.now()}.json`);
        if (fs.existsSync(SCHEDULE_FILE)) {
          fs.copyFileSync(SCHEDULE_FILE, backupFile);
          console.log(`Backup created: ${backupFile}`);
          
          // Keep only last 5 backups
          cleanupBackups();
        }
        
        // Write new data
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
        console.log(`Schedule saved: ${new Date().toISOString()}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Schedule saved successfully' }));
      } catch (error) {
        console.error('Save error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  // Remove query string
  filePath = filePath.split('?')[0];
  
  // Handle /admin route
  if (filePath === '/admin') {
    filePath = '/admin.html';
  }
  
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Cleanup old backups (keep last 5)
function cleanupBackups() {
  const dataDir = path.join(__dirname, 'data');
  const backups = fs.readdirSync(dataDir)
    .filter(f => f.startsWith('schedule-backup-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  // Remove all but the last 5
  backups.slice(5).forEach(backup => {
    fs.unlinkSync(path.join(dataDir, backup));
    console.log(`Deleted old backup: ${backup}`);
  });
}

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║     Pool Schedule Visualizer Server                ║
╠════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}          ║
║  Admin panel:       http://localhost:${PORT}/admin    ║
║                                                    ║
║  Auto-save enabled - changes save automatically    ║
╚════════════════════════════════════════════════════╝
  `);
});

