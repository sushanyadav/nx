const { exec } = require('child_process');

for (let i = 0; i < 3; i++) {
  const cp = exec(`node ./worker.js test_${i}`);
  cp.stdout.pipe(process.stdout);
}
