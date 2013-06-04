var net = require('net');
var ianaServer = {host:'whois.iana.org', port:43};// the IANA server details

// Once we know the whois server for a tld, we store it here so we don't have
// to re-query IANA for the details. Each server has the following form
//      host: the hostname
//      port: port number, always 43
var whoisServers = {};

// Trim a string to remove whitespace before and after
function trim(string) {
    return string.replace(/^\s*|\s*$/g, '')
}

// Perform the actual whois lookup
// TODO: add hard whois option for .com and .net
function doWhois(session,clientWriteCallback,clientEndCallback) {
    console.log('[whois][' + session.id + '] running whois lookup');

    // Connect to the whois server. For .com and .net, the format of the query is slightly
    // different
    var whoisConnection = net.connect(whoisServers[session.tld],function() {
            console.log('[whois][' + session.id + '] connected to whois server, sending query');

            if( session.tld == 'com' || session.tld == 'net' )
                whoisConnection.write('domain ' + session.queryDomain + '\r\n');
            else
                whoisConnection.write(session.queryDomain + '\r\n');
    });

    // callback for data from the whois server
    function afterWhoisCallback(data) {
        afterWhois(session,data,clientWriteCallback);
    }

    function endWhoisCallback() {
        console.log('[whois][' + session.id + '] whois server connection ended');
        clientEndCallback();
    }

    whoisConnection.on('data',afterWhoisCallback);
    whoisConnection.on('end',endWhoisCallback);
}

function doIana(session,clientWriteCallback,clientEndCallback) {
    console.log('[whois][' + session.id + '] getting whois server from iana');

    var ianaConnection = net.connect(ianaServer,function() {
            console.log('[whois][' + session.id + '] connected to iana, sending query');
            ianaConnection.write(session.queryDomain + '\r\n');
    });

    function afterIanaCallback(data) {
        afterIana(session,data);
    }

    function endIanaCallback() {
        endIana(session,clientWriteCallback,clientEndCallback);
    }

    ianaConnection.on('data',afterIanaCallback);
    ianaConnection.on('end',endIanaCallback);
}

function afterWhois(session,data,clientWriteCallback) {
    console.log('[whois][' + session.id + '] received data from whois server');
    // TODO: validate data
    clientWriteCallback(data.toString());
}

function afterIana(session,data) {
    console.log('[whois][' + session.id + '] received data from iana');

    if( session.tld in whoisServers ) return;

    // TODO: validate data

    var lines = data.toString().split('\n');

    for( x in lines ) {
        if( lines[x].charAt(0) == '%' ) continue;
        if( trim(lines[x]) == '' ) continue;

        if( lines[x].split(':')[0] == 'refer' ) {
            console.log( '[whois][' + session.id + '] refer tag found: ' + trim(lines[x]) );
            whoisServers[session.tld] = {host:trim( lines[x].split(':')[1] ), port:43};
            return;
        }
    }
}

function endIana(session,clientWriteCallback,clientEndCallback) {
    console.log('[whois][' + session.id + '] iana connection ended');

    if( !(session.tld in whoisServers) ) {
        console.log('[whois][' + session.id + '] refer tag not found');
        clientWriteCallback('Could not find whois servers for that domain name');
        clientEndCallback();
    } else {
        doWhois(session,clientWriteCallback,clientEndCallback);
    }
}

function query(session,clientWriteCallback,clientEndCallback) {
    console.log('[whois][' + session.id + '] query received for ' + session.queryDomain);

    if( !(session.tld in whoisServers) ) {
        console.log('[whois][' + session.id + '] whois server not found for ' + session.tld);
        doIana(session,clientWriteCallback,clientEndCallback);
    } else {
        console.log('[whois][' + session.id + '] whois server found ' + JSON.stringify( whoisServers[session.tld] ) );
        doWhois(session,clientWriteCallback,clientEndCallback);
    }
}

exports.query = query;
