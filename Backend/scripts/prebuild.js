const { execFileSync } = require("child_process");

function run(label, cmd, args) {
  console.log(`[prebuild] ${label}...`);
  try {
    execFileSync(cmd, args, { stdio: "inherit", shell: true });
  } catch {
    console.error(`\n❌ ${label} FAILED — build aborted.`);
    process.exit(1);
  }
}

run("TypeScript type-check", "npm", ["run", "type-check"]);
run("Dead code check", "npm", ["run", "dead-code"]);

console.log("✅ All prebuild checks passed");
