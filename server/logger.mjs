function write(level, event, details = {}) {
  const payload = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...details,
  });
  const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  output(payload);
}

export const logger = Object.freeze({
  info(event, details) {
    write("info", event, details);
  },
  warn(event, details) {
    write("warn", event, details);
  },
  error(event, details) {
    write("error", event, details);
  },
});
