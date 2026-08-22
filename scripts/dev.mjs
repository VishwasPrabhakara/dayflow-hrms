import { spawn } from "node:child_process";

const processes = [
  ["server", "npm", ["run", "dev:server"]],
  ["client", "npm", ["run", "dev:client", "--", "--host", "127.0.0.1", "--port", "5173"]],
];

for (const [name, command, args] of processes) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exit(code);
    }
  });
}
