/*

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

async function sendMail(message) {
    try {
        if (!emailEnabled) {
            console.log(message);
            return;
        }
        let params = {
            Destination: {
                CcAddresses: [],
                ToAddresses: [
                    'greemi01@gmail.com', 'drkarenjoy@yahoo.com'
                ]
            },
            Message: {
                Body: {
                    Text: {
                        Charset: 'UTF-8',
                        Data: message
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'Message from Website'
                }
            },
            Source: 'greemi01@gmail.com',
            ReplyToAddresses: []
        };

        await new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
    } catch (err) {
        throw err;
    }
}

*/

/*
app.post('/action_page', async (req, res) => {
    let name = req.body.fname.trim();
    let email = req.body.email.trim();
    let country = req.body.country.trim();
    let body = req.body.message.trim();

    let rep;
    if (!name || !email || !country || !body) {
        rep = 'Please fill in all fields.';
    } else if (!validateEmail(email)) {
        rep = 'Please enter a valid email address.';
    } else {
        try {
            await sendMail(`Email from the website\nName: ${name}\nEmail: ${email}\nCountry: ${country}\n${body}`);
            rep = 'Thank you for your message.';
        } catch (err) {
            console.log(err);
            rep = 'A problem occurred sending the message.  Please try again later.';
        }
    }
    await returnWebsitePage(res, '1', MAIL_SENT, 'Message', rep);
});
*/
