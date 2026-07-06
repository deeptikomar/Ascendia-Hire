// Ascendia Hire stores its data in flat XML files. Node's fs calls are async,
// so two requests hitting the same file at nearly the same time can race:
// both read the "old" version, both apply their own change, and whichever
// write finishes last silently overwrites the other one's data.
//
// This module gives every file its own promise chain ("queue"). Any
// read-modify-write sequence for a given file path is scheduled onto that
// file's queue, so operations against the same file always run one at a
// time and in order, while operations against different files still run
// concurrently.

const queues = new Map();

function runExclusive(filePath, task) {
    const previous = queues.get(filePath) || Promise.resolve();
    const current = previous
        .catch(() => {}) // don't let one failed task break the chain for later ones
        .then(() => task());

    queues.set(filePath, current);
    return current;
}

module.exports = { runExclusive };
