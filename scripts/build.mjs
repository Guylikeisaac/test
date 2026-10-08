import { copyFile, cp, mkdir } from 'node:fs/promises';
await mkdir('dist/web', { recursive: true });
await cp('src/web/fonts', 'dist/web/fonts', { recursive: true, filter: source => !source.endsWith('.md') });
await Promise.all(['index.html', 'styles.css'].map(file => copyFile(`src/web/${file}`, `dist/web/${file}`)));
console.log('Built local server and browser assets.');
