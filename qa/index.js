const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');
const nodemailer = require('nodemailer');
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const scopes = 'read_products';
const forwardingAddress = "https://sfshopify.com:3001"; // Replace this with your HTTPS Forwarding address
const fs = require('fs');
const split = require('split');
const http = require('http');
const https = require("https");

app.get('/shopify', (req, res) => {
    const shop = req.query.shop;
    const name = req.query.name;
    const email = req.query.email;
    const sim = req.query.sim;
    if (shop) {
      if (shop != "republicwireless-test.myshopify.com") 
        return res.status(400).send('Invalid parameter. Please add the appropriate parameters to your request');
      else {
          if (sim) {
            const state = nonce();
            res.cookie('state', state);
	    checksim(name, email, sim, res);
          } else {
            return res.status(400).send('Missing parameter. Please add the appropriate parameters to your request');
          }
      }
    } else {
      return res.status(400).send('Missing parameter. Please add the appropriate parameters to your request');
    }
});

const privateKey = fs.readFileSync('/etc/letsencrypt/live/sfshopify.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/sfshopify.com/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/sfshopify.com/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(3000, () => {
	console.log('Sim Validation App listening on port 3000 for HTTP Server');
});

httpsServer.listen(3001, () => {
	console.log('Sim Validation App listening on port 3001 for HTTPS Server');
});

function sendmail(name, email, sim) {

    let transporter = nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail' 
    });
    transporter.sendMail({
        from: 'sim@republicwireless.com',
        to: 'ibis@softwarefactoryexperts.com',
        subject: 'Sim Activation',
        text: 'SIM: ' + sim + '\nNAME: ' + name + '\nEMAIL: ' + email
    }, (err, info) => {
        console.log(info.envelope);
        console.log(info.messageId);
    });

}

function checksim(name, email, sim, res) {
    var list = [];
    var read = fs.createReadStream('iccid_data_sim.csv')
    .pipe(split())
    .on('data',function(data){
       list.push(data);
    })
    .on('end', function(data){
       console.log('Read finished');
       console.log(list);
       validateCsvRow(name, email, sim, list, res);
    })
}

function validateCsvRow(name, email, simNo, list, res) {
   let found = false;
   for (var i = 0; i < list.length; i++) {
	console.log("comparing " + simNo + " and " + list[i]);
      if (simNo==list[i]) {
        console.log ("valid number");
        found = true;
      } else {
         console.log ("invalid number");
      }
   }
    console.log("found? " + found);
    if (found) {
       sendmail(name, email, simNo);
       return res.status(200).send('{"valid": "true"}');
    } else {
       return res.status(200).send('{"valid": "false"}');
    }

}

