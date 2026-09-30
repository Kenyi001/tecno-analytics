const seconds = Number(process.env.RUN_TIMEOUT_SECONDS || 1200);
const timer = setTimeout(() => {
  console.error("corte a los " + seconds + " segundos");
  process.exit(0);
}, seconds * 1000);

console.log("ok");
clearTimeout(timer);
process.exit(0);
