
const AWS = require('aws-sdk');
AWS.config.update({region: 'eu-central-1'});

let params = {
  Destination: { 
    CcAddresses: [    ],
    ToAddresses: [
	'greemi01@gmail.com', 'drkarenjoy@yahoo.com'
    ]
  },
  Message: {
    Body: { /*
      Html: {
       Charset: "UTF-8",
       Data: "HTML_FORMAT_BODY"
      }, */
      Text: {
       Charset: "UTF-8",
       Data: "this is a test\nhello"
      }
     },
     Subject: {
      Charset: 'UTF-8',
      Data: 'Message from Website'
     }
    },
  Source: 'greemi01@gmail.com',
  ReplyToAddresses: [  ],
};

async function doIt() {
    try {
	await new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();
	console.log('sent') ;
    } catch (err) {
	console.log(err) ;
    }
}
 
doIt() ;
