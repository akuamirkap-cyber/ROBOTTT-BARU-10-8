// THE WHOLE SUITE, ALL OF IT. `npm test` used to be a `&&` chain, which meant the first harness that failed hid
// every harness after it (the strike checks are currently red, so zeus + balance never ran). This runs each one in
// turn, prints every failure, and exits non-zero if ANY of them failed.
//
//     node runtests.mjs          → everything
//     node runtests.mjs balance  → only the harnesses whose script name matches
import { spawnSync } from 'node:child_process';

const SUITE = ['test:feet', 'test:pose', 'test:strike', 'test:clash', 'test:cam', 'test:crowd', 'test:zeus', 'test:balance', 'test:star', 'test:combo'];
const filter = process.argv.slice(2);
const names = filter.length ? SUITE.filter((n) => filter.some((f) => n.includes(f))) : SUITE;

const results = [];
for (const name of names) {
  process.stdout.write(`\n════════════════════════════════════════════════════════════ ${name}\n`);
  const r = spawnSync('npm', ['run', '--silent', name], { stdio: 'inherit', shell: false });
  results.push({ name, ok: r.status === 0, code: r.status });
}

const failed = results.filter((r) => !r.ok);
console.log('\n════════════════════════════════════════════════════════════ SUMMARY');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (exit ${r.code})`}`);
console.log(failed.length === 0 ? '\nALL HARNESSES PASS\n' : `\n${failed.length} HARNESS(ES) FAILED\n`);
process.exit(failed.length === 0 ? 0 : 1);
