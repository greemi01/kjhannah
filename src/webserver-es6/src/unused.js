
let OK_START = ['/bootstrap/', '/images/', '/css/'];

app.get('/dummy/*splat', async function (req, res) {
    let filePath = req.path;


    if (filePath === '/favicon.ico') {
        filePath = '/images/favicon.png';
    }

    if (!OK_START.some(ok => filePath.startsWith(ok)) || filePath.includes('..')) {
        console.log(`Bad 'get *' request: ${req.path}`);
        return pageNotFound(res);
    }

    let file = path.join(htmlPublic, filePath);
    if (file.indexOf(htmlPublic + path.sep) !== 0) {
        // might not be needed ... but being paranoid
        return pageNotFound(res);
    }

    res.setHeader('Cache-Control', 'max-age=86400');
    res.sendFile(file, (err) => {
        if (err) {
            if (err.code === 'ECONNABORTED') {
                // console.warn('Client aborted the request');
            } else {
                console.error('File send error:', err);
                if (!res.headersSent) {
                    res.status(500).send('Internal Server Error');
                }
            }
        }
    });
});
