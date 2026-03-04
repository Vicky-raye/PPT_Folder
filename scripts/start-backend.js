const path = require("path");
const { spawn } = require("child_process");

const backendDir = path.resolve(__dirname, "..", "backend");
const isWin = process.platform === "win32";

// Windows 下用 python，非 Windows 用 python3
const pyCmd = isWin ? "python" : "python3";
const pyArgs = ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"];

console.log("[backend] 正在启动后端 http://localhost:8000 ...");
console.log("[backend] 工作目录:", backendDir);

const child = spawn(pyCmd, pyArgs, {
  cwd: backendDir,
  env: { ...process.env, PYTHONPATH: backendDir },
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error("[backend] 启动失败:", err.message);
  console.error("[backend] 请确认：1) 已安装 Python  2) 在 backend 目录执行过 pip install -r requirements.txt");
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error("[backend] 进程退出，code=" + code);
    process.exit(code);
  }
  if (signal) process.exit(1);
});
