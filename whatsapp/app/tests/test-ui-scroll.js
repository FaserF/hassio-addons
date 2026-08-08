import express from 'express';
import http from 'http';
import { renderDashboard } from '../src/routes/ui/index.js';

const app = express();
app.get('/', (req, res) => {
  res.send(renderDashboard('default'));
});

const server = http.createServer(app);
server.listen(3999, () => {
  console.log('Test UI server running at http://localhost:3999');
  
  // Verify HTML output contains required containers and stylesheet links
  const html = renderDashboard('default');
  console.log('HTML length:', html.length);
  console.log('Contains main-content:', html.includes('class="main-content"'));
  console.log('Contains content-body:', html.includes('class="content-body"'));
  console.log('Contains tab-telegram:', html.includes('id="tab-telegram"'));
  
  server.close(() => console.log('Test UI server closed successfully'));
});
