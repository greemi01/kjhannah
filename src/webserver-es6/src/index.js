/*
to update certificate
sudo systemctl stop kjhanna
sudo certbot renew5
sudo systemctl start kjhanna
*/

import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import { parse } from "csv-parse/sync";
import { fileURLToPath } from 'url';
import { accessSync, constants } from 'fs';
import fs from 'fs/promises';
import { StatusCodes } from 'http-status-codes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_HTTP_PORT = 8080;
const DEFAULT_HTTPS_PORT = 443;

const INDEX_PAGE = 'about_kj_hannah_greenberg';
const ERROR_PAGE = 'page_not_found';

const PRODUCTION_KEY_FOLDER = '/etc/letsencrypt/live/kjhannahgreenberg.net';

function fileExistsSync(f) {
    try {
        accessSync(f, constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

const IS_PRODUCTION = fileExistsSync(PRODUCTION_KEY_FOLDER);

const templateFile = 'template_bootstrap.html';
let page_template;

const PAGE_INFO = new Map();

const htmlPublic = path.resolve(`${__dirname}/../../../public_html`);
const dataFolder = path.resolve(`${__dirname}/../../../data`);

async function setupDb() {
    const rows = parse(await fs.readFile(dataFile('db/pages.csv'), "utf8"), {
        columns: true,
        skip_empty_lines: true,
    });
    for (const row of rows) {
        if (row.page_number) {
            if (PAGE_INFO.has(row.page_number)) {
                throw new Error(`Duplicate page number ${row.page_number}`);
            }
            PAGE_INFO.set(row.page_number, row);
        }
        if (row.page_route) {
            if (PAGE_INFO.has(row.page_route)) {
                throw new Error(`Duplicate page route ${row.page_route}`);
            }
            PAGE_INFO.set(row.page_route, row);
        }
    }
}


class HttpError extends Error {
    constructor(status, message) {
        super(message || 'Error');
        this.status = status;
    }
}


function webSiteFile(f) {
    return htmlPublic + '/' + f;
}

function dataFile(f) {
    return dataFolder + '/' + f;
}


function securityHeaders(req, res, next) {
    if (IS_PRODUCTION) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000 ; includeSubDomains');
    }

    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    res.setHeader('X-Frame-Options', "SAMEORIGIN");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
}


function replacePlaceholders(text, replacements) {
    return text.replace(/\{%\w+%\}/g, (match) => {
        const key = match.slice(2, -2); // strip {% and %}
        return replacements.has(key) ? replacements.get(key) : match;
    });
}

async function returnWebsitePage(res, pageName, status = StatusCodes.OK) {
    const pageData = PAGE_INFO.get(pageName);
    if (!pageData) {
        throw new HttpError(StatusCodes.NOT_FOUND);
    }

    const fileName = dataFile(`${pageData.page_route}.html`);
    const fileText = await fs.readFile(fileName, 'utf8');
    const vars = new Map([
        ['content', fileText],
        ['name', pageData.page_title]]);

    const page = replacePlaceholders(page_template, vars);

    res.setHeader('content-type', 'text/html; charset=utf8');
    res.status(status);
    res.send(page);
}


const app = express();

app.use(securityHeaders);

app.get('/', async (req, res) => {
    await returnWebsitePage(res, INDEX_PAGE);
});

app.get('/index.html', async (req, res) => {
    await returnWebsitePage(res, INDEX_PAGE);
});

app.get('/page', async (req, res) => {
    let m = (req.query.p ?? '').match(/^(\d+)_(\d+)$/);
    if (!m) {
        throw new HttpError(StatusCodes.NOT_FOUND);
    }

    const [_, m1, m2] = m;
    const pageData = PAGE_INFO.get(m2);

    if (m1 === '1' && pageData && pageData.page_route) {
        res.redirect(StatusCodes.PERMANENT_REDIRECT, "/" + pageData.page_route);
        return;
    }

    throw new HttpError(StatusCodes.NOT_FOUND);
});

app.get('/:page', async function (req, res, next) {
    const pageName = req.params.page;
    if (PAGE_INFO.has(pageName)) {
        return await returnWebsitePage(res, pageName);
    } else {
        return next();
    }
});


const IGNORE_PAGES_PATTERNS = [
  '[.]well-known/.*',             // ACME, Apple, etc.
  'favicon[.]ico',              // browser favicon
  'robots[.]txt',               // crawler instructions
  'apple-touch-icon.*[.]png',   // iOS/macOS icons
  'browserconfig[.]xml',        // Windows site metadata
  'sitemap.*[.]xml',            // search engine sitemaps
  'humans[.]txt',               // harmless info file
];


const IGNORE_PAGES = new RegExp(
  '^/(' + IGNORE_PAGES_PATTERNS.join('|') + ')$',
  'i'
);

app.use((req, res, next) => {
    if (IGNORE_PAGES.test(req.path)) {
        return res.sendStatus(404);
    }
    next();
});

app.use(express.static(htmlPublic, {
    setHeaders: (res, _filePath) => {
        res.setHeader('Cache-Control', 'max-age=86400');
    }
}));

app.use((_req, _res) => {
    // not found should throw error for to get to default error handler
    throw new HttpError(StatusCodes.NOT_FOUND);
});

app.use(async (err, req, res, _next) => {
    const code = err.status || 500;
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const clientIp = req.socket.remoteAddress;

    if (code !== StatusCodes.NOT_FOUND) {
        console.log(`Error while processing (${clientIp}): ${fullUrl}`);
        console.error(err);
    } else {
        console.log(`Page not found (${clientIp}): ${fullUrl}`);
    }

    try {
        await returnWebsitePage(res, ERROR_PAGE, code);
        return;
    } catch (err) {
        console.log("Redirect to error page failed");
        console.log(err);
    }

    if (!res.headersSent) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
    }
});


async function main() {
    try {
        await setupDb();

        page_template = await fs.readFile(webSiteFile(templateFile), 'utf8');

        let server;
        let usePort;
        let protocol;

        const defaultPort = IS_PRODUCTION ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;
        usePort = (process.argv.length > 2) ? parseInt(process.argv[2]) : defaultPort;

        if (IS_PRODUCTION) {
            protocol = "https";
            const privateKey = await fs.readFile(`${PRODUCTION_KEY_FOLDER}/privkey.pem`, 'utf8');
            const certificate = await fs.readFile(`${PRODUCTION_KEY_FOLDER}/fullchain.pem`, 'utf8');
            const credentials = { key: privateKey, cert: certificate };
            server = https.createServer(credentials, app);
        } else {
            server = http.createServer(app);
            protocol = "http";
        }

        await new Promise((resolve, reject) => server.listen(usePort, (err) => err ? reject(err) : resolve()));

        const { address, port } = server.address();
        const host = address === '::' || address === '0.0.0.0' ? 'localhost' : address;
        console.log(`Started ${protocol}://${host}:${port}`);

    } catch (err) {
        console.log(err);
    }
}

main();
