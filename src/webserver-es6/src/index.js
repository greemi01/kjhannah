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

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { constants } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));

let httpPort = 8080;
let httpsPort = 443;

const INDEX_PAGE = '86';
// const MAIL_SENT = '502';

let isProduction;
const templateFile = 'template_bootstrap.html';
let template;


// const AWS = require('aws-sdk');
// AWS.config.update({ region: 'eu-central-1' });
let emailEnabled = false; // if true, need to fix AWS

let pageNames = {};

const htmlPublic = path.resolve(`${__dirname}/../../../public_html`);
const dataFolder = path.resolve(`${__dirname}/../../../data`);

async function setupDb() {
    let d = await fs.readFile(dataFile('db/pages.csv'), 'utf8');
    for (let line of d.split(/\n/)) {
        let m = line.match(/^([^,]+),(.*)/)
        if (m) {
            pageNames[m[1]] = m[2];
        }
    }
}

function webSiteFile(f) {
    return htmlPublic + '/' + f;
}

function dataFile(f) {
    return dataFolder + '/' + f;
}


function pageNotFound(res) {
    res.status(404).end();

    /*
    try {
        let page = await getWebsitePage(1, 404, null, null);
        res.setHeader('content-type', 'text/html; charset=utf8');
        return res.status(404).send(page);
    } catch {
        res.setHeader('content-type', 'text/html; charset=utf8');
        return res.status(404).send("Page not found");
        // return res.status(404).end();
    }
    */

}

async function getWebsitePage(m1, m2, var1, val1) {
    let fn;
    if (m1) {
        fn = `menu${m1}_${m2}.html`;
    } else {
        fn = `${m2}.html`;
    }

    let fileText = await fs.readFile(dataFile(fn), 'utf8');

    let page = template.replace('{%content%}', fileText);
    page = page.replace('{%name%}', pageNames[m2] ?? `no idea ${m1} ${m2}`);
    page = page.replace('{%name%}', pageNames[m2] ?? `no idea ${m1} ${m2}`);

    if (var1) {
        page = page.replace(`{%${var1}%}`, val1);
    }
    return page;
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



async function returnWebsitePage(res, m1, m2, var1, val1) {
    try {
        let page = await getWebsitePage(m1, m2, var1, val1);
        res.setHeader('content-type', 'text/html; charset=utf8');
        res.send(page);
    } catch {
        return pageNotFound(res);
    }
}

async function fileExists(f) {
    try {
        await fs.access(f, constants.R_OK);
        return true;
    } catch (err) {
        return false;
    }
}


const app = express();

app.use(securityHeaders);

app.get('/', async (req, res) => {
    // console.log(`get /  ${JSON.stringify(req.query)}`);
    await returnWebsitePage(res, '1', INDEX_PAGE);
});

app.get('/index.html', async (req, res) => {
    // console.log(`get /  ${JSON.stringify(req.query)}`);
    await returnWebsitePage(res, '1', INDEX_PAGE);
});

app.get('/page', async (req, res) => {
    // console.log(`get page ${JSON.stringify(req.query)}`);
    let m = (req.query.p ?? '').match(/^(\d+)_(\d+)$/);
    if (!m) {
        return pageNotFound(res);
    }

    return await returnWebsitePage(res, m[1], m[2]);
});

app.get('/:page', async function (req, res, next) {
    let filePath = req.path;
    const page = req.params.page;
    console.log(page);
    if (page in pageNames) {
        return await returnWebsitePage(res, null, page);
    } else {
        return next();
    }
}) ;



app.use(express.static(htmlPublic, {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'max-age=86400'); // cache for 1 day
    }
})) ;

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(err.status || 500).send('error');
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
