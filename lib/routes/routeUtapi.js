const url = require('url');
const http = require('http');
const { errors } = require('arsenal');
const { responseJSONBody } = require('arsenal').s3routes.routesUtils;
const { config } = require('../Config');

function _decodeURI(uri) {
    // do the same decoding than in S3 server
    return decodeURIComponent(uri.replace(/\+/g, ' '));
}

function createUtapiRequestOptions(req) {
    const parsedUrl = url.parse(req.url, true);
    const reqPath = _decodeURI(parsedUrl.pathname);
    // path will begin with /_/utapi
    const utapiPath = `/zenko${reqPath.substring(8)}`;
    const utapiPort = config.utapi.port || 8100;
    const utapiHost = config.utapi.host || 'localhost';

    return {
        path: utapiPath,
        port: utapiPort,
        host: utapiHost,
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-cache',
        },
        rejectUnauthorized: false,
    };
}

function routeUtapi(clientIP, request, response, log) {
    log.debug('route request', { method: 'routeUtapi' });
    let reqBody = '';
    request.on('data', chunk => {
        reqBody += chunk;
    });
    request.on('end', () => {
        // UTAPIPOST NOT BEING TRANSFORMED INTO PROPER JSON
        const utapiPost = JSON.stringify(reqBody);
        const options = createUtapiRequestOptions(request);
        const utapiRequest = http.request(options, res => {
            const resBody = [];
            res.setEncoding('utf8');
            res.on('data', chunk => resBody.push(chunk));
            res.on('end', () => {
                const responseBody = JSON.parse(resBody.join(''));
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    return responseBody;
                } else {
                    log.error('Utapi request failed', {
                        statusCode: response.statusCode,
                        body: responseBody });
                    return responseJSONBody(errors.InternalError, null,
                        response, log);
                }
            });
        });
        utapiRequest.write(utapiPost);
        utapiRequest.end();
    });
}

module.exports = routeUtapi;
