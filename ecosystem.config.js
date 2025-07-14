module.exports = {
    apps: [
        {
            name: "IMS-Bridge",
            script: "server.js",
            instances: 1,
            autorestart: true,
            watch: false,
        },
    ],
};
