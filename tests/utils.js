const { Transform } = require('stream');

function getSplitLinesTransform() {
  let buffer = '';
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop(); // keep incomplete line
      lines.forEach((line) => callback(null, line));
    },
    flush(callback) {
      if (buffer) callback(null, buffer);
    },
  });
}

module.exports = { getSplitLinesTransform };