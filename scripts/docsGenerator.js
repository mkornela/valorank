const fs = require('fs');
const path = require('path');
const apiEndpoints = require('../src/config/docs');

function generateDocsHTML() {
    let cardsHtml = '';

    apiEndpoints.forEach(endpoint => {
        let paramsHtml = '';
        if (endpoint.params.length > 0) {
            const paramsList = endpoint.params.map(param => `<li>${param}</li>`).join('');
            paramsHtml = `
                <div class="details-section">
                    <h3 class="details-title">Parametry</h3>
                    <ul class="param-list">${paramsList}</ul>
                </div>`;
        }

        let exampleHtml = '';
        if (endpoint.example) {
            exampleHtml = `
                <div class="details-section">
                    <h3 class="details-title">Przykład</h3>
                    <div class="example-block">
                        <div class="req"><span>Request:</span> ${endpoint.example.request}</div>
                        <div class="res"><span>Response:</span> ${endpoint.example.response}</div>
                    </div>
                </div>`;
        }

        cardsHtml += `
            <div class="api-card">
                <h2 class="api-title">${endpoint.title}</h2>
                <p class="api-description">${endpoint.description}</p>
                <div class="api-endpoint">${endpoint.endpoint}</div>
                ${paramsHtml}
                ${exampleHtml}
            </div>`;
    });

    const fullHtml = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dokumentacja API</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root { --purple-glow: #a970ff; --cyan-glow: #50d7e8; --bg-dark: #111827; --bg-card: #171E2D; --border-color: rgba(255, 255, 255, 0.1); --text-primary: #f9fafb; --text-secondary: #9ca3af; --red: #f87171; --green: #4ade80; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-dark); color: var(--text-primary); min-height: 100vh; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; padding: 20px; }
        .header h1 { font-size: 2.5rem; font-weight: 700; background: linear-gradient(90deg, var(--purple-glow), var(--cyan-glow)); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header p { font-size: 1.1rem; color: var(--text-secondary); margin-top: 8px; }
        .api-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        .api-card { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 25px; }
        .api-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary); }
        .api-description { color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem; margin-bottom: 16px; }
        .api-endpoint { font-family: 'JetBrains Mono', monospace; background-color: #0c1017; padding: 12px; border-radius: 6px; color: var(--cyan-glow); border-left: 2px solid var(--cyan-glow); margin: 20px 0; font-size: 0.9rem; user-select: all; word-break: break-all; }
        .details-section { margin-top: 20px; }
        .details-title { font-weight: 600; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 10px; }
        .param-list { list-style: none; }
        .param-list li { font-family: 'JetBrains Mono', monospace; background-color: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 4px; font-size: 0.85rem; color: #ccc; margin-bottom: 6px; }
        .example-block { font-family: 'JetBrains Mono', monospace; background-color: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 6px; font-size: 0.85rem; color: #ccc; }
        .example-block div { margin-bottom: 5px; }
        .example-block span { font-weight: 600; }
        .example-block .req span { color: var(--red); }
        .example-block .res span { color: var(--green); }
        .footer { text-align: center; margin-top: 50px; padding: 20px; color: #6b7280; font-size: .9rem; }
        a { color: var(--cyan-glow); text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Dokumentacja API</h1>
            <p>Statystyki VALORANT w czasie rzeczywistym</p>
        </div>
        <div class="api-grid">${cardsHtml}</div>
        <div class="footer">
            Stworzone z ❤️ przez <a href="https://github.com/mkornela">deemdll</a> • Zasilane przez HenrikDev API
        </div>
    </div>
</body>
</html>`;

    try {
        const outputPath = path.join(process.cwd(), 'docs.html');
        fs.writeFileSync(outputPath, fullHtml, 'utf-8');
        console.log('✅ Documentation file (docs.html) has been generated successfully.');
    } catch (error) {
        console.error('❌ Error generating documentation file:', error);
    }
}

generateDocsHTML();