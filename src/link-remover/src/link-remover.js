'use strict';


// builtin 
import path from 'path';
import { promises as fs } from 'fs';
import * as commander from "commander";
import { SERVFAIL } from 'dns';

async function processFile(file, allBroken) {
    console.log(`Processing ${file}`);
    let d = await fs.readFile(file, 'utf8');
    let mod = d.replace(/<a\s+href=['"](.*?)['"].*?>([\S\s]*?)<[/]a>/igm, (str, url, txt) => {
        url = url.replaceAll('&amp;', '&');

        // console.log(`checking: ${str} -- ${url} -- ${txt}`);
        if (allBroken.has(url)) {
            console.log(`remove reference to ${url}`);
            return txt;
        } else {
            return str;
        }
    });
    await fs.writeFile(file, mod, 'utf8') ;
}

async function main() {
    try {
        const program = new commander.Command();
        program
            .description('Link remover')
            .allowExcessArguments(false);

        program.command('remove-dead-links <deadLinkFile> <dataFolder>')
            .description('remove dead links based on output from  "blc https://kjhannahgreenberg.net -roi"\n' + 
                         'blc http://localhost:8080 -roi')
            .action(async function (deadLinkFile, dataFolder, cmdObj) {
                let allBroken = new Set();
                let allFiles = new Set();
                let dlF = await fs.readFile(deadLinkFile, 'utf-8');
                for (let line of dlF.split(/\r?\n/)) {
                    let broken = line.match(/─BROKEN─ (https?:\S*)/);
                    let page = line.match(/Getting links from: https:[/][/](kjhannahgreenberg.net|localhost:8443)[/]page[?]p=(.*)/);
                    if (broken) {
                        allBroken.add(broken[1]);
                        if (broken[1].endsWith('/')) {
                          allBroken.add(broken[1].slice(0,-1));  
                        }
                    } else if (page) {
                        allFiles.add(path.join(dataFolder, `menu${page[2]}.html`));
                    }
                }
                // console.log([...allBroken]);
                // console.log([...allFiles]);

                for (let f of allFiles) {
                    await processFile(f, allBroken);
                }
            });



        if (process.argv.length === 2 && import.meta.url.includes('src-new/link-remover/')) {
            // so ... if you want to run in the debugger, you can set a command line here
            // this will only happen if running in a source environment (in case this code is accidentally put into production)
            console.log('***** Using hardwired command line *****');
            let cmd = 'remove-dead-links /home/mlg/broken.log /home/mlg/mlg-src/WebSite/public_html/data';
            cmd = 'remove-dead-links /home/mlg/xxx.txt /home/mlg/mlg-src/WebSite/public_html/data' ;
            process.argv = ['', '', ...cmd.trim().split(/ +/)];
        }
        await program.parseAsync(process.argv);
    } catch (err) {
        console.log(err);
    }
}


main();



