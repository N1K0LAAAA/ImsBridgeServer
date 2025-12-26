module.exports = {
  apps: [
    {
      name: "IMS-Bridge",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
