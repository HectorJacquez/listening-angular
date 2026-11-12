// Turns Vitest's JSON report into the Markdown shown on a GitHub Actions run page.
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2] ?? 'test-results.json', 'utf8'));
const escape = (s) => s.replace(/[<>&|]/g, (c) => `&#${c.charCodeAt(0)};`);
const mark = (status) => (status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️');

const files = report.testResults
  .map((f) => ({ ...f, name: f.name.split('/src/app/')[1] ?? f.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
const seconds = files.reduce((sum, f) => sum + (f.endTime - f.startTime), 0) / 1000;

const out = [
  `### Tests: ${report.numPassedTests} passed, ${report.numFailedTests} failed`,
  '',
  `${files.length} files · Vitest · ${seconds.toFixed(1)}s of test time`,
  '',
];

for (const file of files) {
  const tests = file.assertionResults;
  const failed = tests.some((t) => t.status === 'failed');
  out.push(
    `<details${failed ? ' open' : ''}>`,
    `<summary>${mark(file.status)} <code>${file.name}</code> · ${tests.length} ${tests.length === 1 ? 'test' : 'tests'}</summary>`,
    '',
  );
  for (const t of tests) {
    out.push(`- ${mark(t.status)} ${escape([...t.ancestorTitles, t.title].join(' › '))}`);
    for (const message of t.failureMessages) {
      out.push(
        '',
        '  ```',
        ...message
          .split('\n')
          .slice(0, 12)
          .map((l) => `  ${l}`),
        '  ```',
      );
    }
  }
  out.push('', '</details>', '');
}

console.log(out.join('\n'));
