'use strict';

const { Transform } = require('stream');

function getSplitLinesTransform() {
  let leftover = '';

  return new Transform({
    readableObjectMode: true,
    transform(chunk, _enc, callback) {
      try {
        const lines = (leftover + chunk.toString()).split('\n');
        leftover = lines.pop();
        for (const line of lines) {
          if (line.trim()) {
            this.push(line);
          }
        }
        callback();
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      if (leftover.trim()) {
        this.push(leftover);
      }
      callback();
    },
  });
}

module.exports = { getSplitLinesTransform };
