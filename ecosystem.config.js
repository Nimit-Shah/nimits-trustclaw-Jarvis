module.exports = {
  apps: [
    {
      name: "trustclaw-web",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "mnemosyne-bridge",
      script: "scripts/mnemosyne_bridge.py",
      interpreter: "python3",
      env: {
        MNEMOSYNE_DATA_DIR: "./.mnemosyne/data",
      },
    },
  ],
};
