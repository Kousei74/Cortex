const fs = require('fs');
const path = require('path');
function replaceOnce(file, from, to) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(to)) text = text.replace(from, to);
}
