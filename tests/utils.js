const { Transform } = require('stream');

function getSplitLinesTransform() {
  let leftover = '';

  return new Transform({
    readableObjectMode: true,
    transform(chunk, _enc, callback) {
      try {
        const lines = (leftover + chunk.toString()).split('\n');
        leftover = lines.pop(); // última linha incompleta (se houver)
        for (const line of lines) {
          if (line.trim()) this.push(line);
        }
        callback();
      } catch (err) {
        callback(err);
      }
    },
    flush(callback) {
      if (leftover.trim()) this.push(leftover);
      callback();
    },
  });
}

module.exports = { getSplitLinesTransform };
