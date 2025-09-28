import { match } from 'path-to-regexp';
/*
to update certificate
sudo systemctl stop kjhanna
sudo certbot renew5
sudo systemctl start kjhanna
*/

import express from 'express';
import util from 'util';
import path from 'path';
import http from 'http';
import https from 'https';
import { parse } from "csv-parse/sync";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { constants } from 'fs';
import { StatusCodes } from 'http-status-codes';
import { getReasonPhrase } from 'http-status-codes';

const __dirname = dirname(fileURLToPath(import.meta.url));

let httpPort = 8080;
let httpsPort = 443;

const INDEX_PAGE = '86';
// const MAIL_SENT = '502';

let isProduction;
const templateFile = 'template_bootstrap.html';
let template;

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
            PAGE_INFO.set(row.page_number, row);
        }
        if (row.page_route) {
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
    if (isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000 ; includeSubDomains');
    }
    // the 'data:' is needed because bootstrap includes some inline images (for the menu bar icon)
    // res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; script-src 'nonce-abAC'");
    res.setHeader('X-Frame-Options', "SAMEORIGIN");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
}


async function fileExists(f) {
    try {
        await fs.access(f, constants.R_OK);
        return true;
    } catch (err) {
        return false;
    }
}



async function returnWebsitePage(res, m1, m2, var1, val1) {
    try {
        const pageData = PAGE_INFO.get(m2);
        if (!pageData) {
            throw new HttpError(StatusCodes.NOT_FOUND);
        }

        if (pageData.page_route && m1) {
            console.log("should redirect");
            res.redirect(StatusCodes.PERMANENT_REDIRECT, pageData.page_route) ;
            return ;
        }
        let page = await getWebsitePage(pageData, var1, val1);
        res.setHeader('content-type', 'text/html; charset=utf8');
        res.send(page);
    } catch {
        throw new HttpError(StatusCodes.NOT_FOUND);

    }
}

async function getWebsitePage(pageData, var1, val1) {
    let fn;
    if (pageData.page_route) {
        fn = `${pageData.page_route}.html`;
    } else {
        fn = `menu1_${pageData.page_number}.html`;
    }

    let fileText = await fs.readFile(dataFile(fn), 'utf8');

    let page = template.replace('{%content%}', fileText);

    page = page.replaceAll('{%name%}', pageData.page_title);

    if (var1) {
        page = page.replaceAll(`{%${var1}%}`, val1);
    }
    return page;
}


const app = express();

app.use(securityHeaders);

app.get('/', async (req, res) => {
    await returnWebsitePage(res, '1', INDEX_PAGE);
});

app.get('/index.html', async (req, res) => {
    await returnWebsitePage(res, '1', INDEX_PAGE);
});

app.get('/page', async (req, res) => {
    let m = (req.query.p ?? '').match(/^(\d+)_(\d+)$/);
    if (!m) {
        throw new HttpError(StatusCodes.NOT_FOUND);
    }

    return await returnWebsitePage(res, m[1], m[2]);
});

app.get('/:page', async function (req, res, next) {
    const page = req.params.page;
    if (PAGE_INFO.has(page)) {
        return await returnWebsitePage(res, null, page);
    } else {
        return next();
    }
});

app.use(express.static(htmlPublic, {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'max-age=86400');
    }
}));


app.use((err, req, res, next) => {
    console.error(err.message);
    const code = err.status || 500;

    function safeReasonPhrase(code) {
        try {
            return getReasonPhrase(code);
        } catch {
            return 'Unknown Status';
        }
    }

    // Direct to the error page if possible instead
    res.status(code).send(safeReasonPhrase(code));
});


async function main() {
    await setupDb();

    let productionKeyFolder = '/etc/letsencrypt/live/kjhannahgreenberg.net';
    isProduction = await fileExists(productionKeyFolder);
    let keyFolder = isProduction ? productionKeyFolder : __dirname;

    if (process.argv.length > 2) {
        httpPort = parseInt(process.argv[2]);
    }

    if (process.argv.length > 3) {
        templateFile = process.argv[3];
    }

    template = await fs.readFile(webSiteFile(templateFile), 'utf8');

    if (isProduction) {
        try {
            let privateKey = await fs.readFile(`${keyFolder}/privkey.pem`, 'utf8');
            let certificate = await fs.readFile(`${keyFolder}/fullchain.pem`, 'utf8');
            let credentials = { key: privateKey, cert: certificate };
            let httpsServer = https.createServer(credentials, app);
            httpsServer.listen(httpsPort);
            console.log('Started https on port ' + httpsPort);
        } catch (err) {
            console.log(err);
        }
    } else {
        let httpServer = http.createServer(app);
        httpServer.listen(httpPort);
        console.log('Started http on port ' + httpPort);
    }
}


main();
