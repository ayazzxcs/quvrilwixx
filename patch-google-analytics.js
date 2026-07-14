const fs = require('fs');
const path = require('path');

const GA_ID = 'G-Y5QM3GGPPWE';

const GA_TAG = `
  <!-- Google Analytics -->
  https://www.googletagmanager.com/gtag/js?id=${GA_ID}script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  </script>
  <!-- End Google Analytics -->`;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (
        name === '.git' ||
        name === 'node_modules' ||
        name === '.vercel' ||
        name === '.wrangler'
      ) {
        continue;
      }

      walk(fullPath, files);
    } else if (name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

function injectIntoHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  if (
    html.includes(`gtag/js?id=${GA_ID}`) ||
    html.includes(`gtag('config', '${GA_ID}')`)
  ) {
    return false;
  }

  if (!/<\/head>/i.test(html)) {
    return false;
  }

  html = html.replace(/<\/head>/i, `${GA_TAG}\n</head>`);
  fs.writeFileSync(filePath, html);
  return true;
}

function patchGenerator(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  let js = fs.readFileSync(filePath, 'utf8');

  if (
    js.includes(`gtag/js?id=${GA_ID}`) ||
    js.includes(`gtag('config', '${GA_ID}')`)
  ) {
    return false;
  }

  if (!js.includes('</head>')) {
    return false;
  }

  js = js.replace('</head>', `${GA_TAG}\n</head>`);
  fs.writeFileSync(filePath, js);
  return true;
}

let changed = 0;

for (const filePath of walk(process.cwd())) {
  if (injectIntoHtml(filePath)) {
    changed++;
    console.log('Updated HTML:', path.relative(process.cwd(), filePath));
  }
}

const generatorFiles = [
  path.join(process.cwd(), 'generate-static-product-pages.js'),
  path.join(process.cwd(), 'scripts', 'generate-seo-pages.js')
];

for (const filePath of generatorFiles) {
  if (patchGenerator(filePath)) {
    changed++;
    console.log('Updated generator:', path.relative(process.cwd(), filePath));
  }
}

console.log(`Google Analytics patch complete. Files changed: ${changed}`);

