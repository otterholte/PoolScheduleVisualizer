/**
 * Simple Node.js server for Pool Schedule Visualizer
 * - Serves static files
 * - Provides API endpoint to save schedule data
 * - Supports multi-facility routing via slugs
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const SCHEDULE_FILE = path.join(__dirname, 'data', 'schedule.json');
const FACILITIES_DIR = path.join(__dirname, 'data', 'facilities');

// Ensure facilities directory exists
if (!fs.existsSync(FACILITIES_DIR)) {
  fs.mkdirSync(FACILITIES_DIR, { recursive: true });
}

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

// Get list of available facilities
function getFacilities() {
  const facilities = [];
  if (fs.existsSync(FACILITIES_DIR)) {
    fs.readdirSync(FACILITIES_DIR).forEach(file => {
      if (file.endsWith('.json')) {
        const slug = file.replace('.json', '');
        try {
          const data = JSON.parse(fs.readFileSync(path.join(FACILITIES_DIR, file), 'utf8'));
          facilities.push({
            slug,
            name: data.facilityInfo?.name || slug
          });
        } catch (e) {
          console.error(`Error reading facility ${file}:`, e);
        }
      }
    });
  }
  return facilities;
}

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

  // Parse URL
  const urlParts = req.url.split('?');
  const urlPath = urlParts[0];
  const queryString = urlParts[1] || '';
  
  // API: Get facilities list
  if (req.method === 'GET' && urlPath === '/api/facilities') {
    const facilities = getFacilities();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, facilities }));
    return;
  }

  // API: Save schedule (default facility)
  if (req.method === 'POST' && urlPath === '/api/save-schedule') {
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

  // API: Get facility data
  const facilityGetMatch = urlPath.match(/^\/api\/facility\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && facilityGetMatch) {
    const slug = facilityGetMatch[1];
    const facilityFile = path.join(FACILITIES_DIR, `${slug}.json`);
    
    if (fs.existsSync(facilityFile)) {
      const content = fs.readFileSync(facilityFile, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Facility not found' }));
    }
    return;
  }

  // API: Save facility settings
  const facilityMatch = urlPath.match(/^\/api\/save-facility\/([a-z0-9-]+)$/);
  if (req.method === 'POST' && facilityMatch) {
    const slug = facilityMatch[1];
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const facilityFile = path.join(FACILITIES_DIR, `${slug}.json`);
        
        // Create backup if file exists
        if (fs.existsSync(facilityFile)) {
          const backupFile = facilityFile.replace('.json', `-backup-${Date.now()}.json`);
          fs.copyFileSync(facilityFile, backupFile);
          console.log(`Facility backup created: ${backupFile}`);
        }
        
        // Write facility data
        fs.writeFileSync(facilityFile, JSON.stringify(data, null, 2));
        console.log(`Facility '${slug}' saved: ${new Date().toISOString()}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Facility saved successfully' }));
      } catch (error) {
        console.error('Facility save error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  
  // Handle /admin route
  if (filePath === '/admin') {
    filePath = '/admin.html';
  }
  
  // Handle /pool-settings route
  if (filePath === '/pool-settings') {
    filePath = '/pool-settings.html';
  }
  
  // Handle facility-specific routes: /{slug}/admin, /{slug}/pool-settings
  const facilityAdminMatch = filePath.match(/^\/([a-z0-9-]+)\/(admin|pool-settings)$/);
  if (facilityAdminMatch) {
    const slug = facilityAdminMatch[1];
    const page = facilityAdminMatch[2];
    
    // Redirect to the page with facility query param
    res.writeHead(302, { 'Location': `/${page}.html?facility=${slug}` });
    res.end();
    return;
  }
  
  // Handle facility-specific index: /{slug}
  const facilityIndexMatch = filePath.match(/^\/([a-z0-9-]+)$/);
  if (facilityIndexMatch && facilityIndexMatch[1] !== 'admin' && facilityIndexMatch[1] !== 'pool-settings') {
    const slug = facilityIndexMatch[1];
    const facilityFile = path.join(FACILITIES_DIR, `${slug}.json`);
    
    // Check if this is a valid facility
    if (fs.existsSync(facilityFile)) {
      res.writeHead(302, { 'Location': `/index.html?facility=${slug}` });
      res.end();
      return;
    }
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

