const bootstrap = require('./server/server');

async function runApp() {
    const app = await bootstrap(5000, 'dbHost', 'spare-carts')
    return app;
}

(async ()=> {
    await runApp();
})();

module.exports = runApp;