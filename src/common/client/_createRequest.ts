import crypto from 'crypto';
import mime from 'mime';
import dateFormat from 'dateformat';
import copy from 'copy-to';
import path from 'path';
import debug from 'debug';
import { getResource } from '../utils/getResource';
import { authorization } from '../utils/authorization';
import { getReqUrl } from '../utils/getReqUrl';

const _debug = debug('ali-oss');

interface Headers {
  [propName: string]: any
  'x-oss-date': string,
  'x-oss-user-agent': string,
}

interface ReqParams {
  [propName: string]: any
}

function getHeader(headers: Headers, name: string) {
  return headers[name] || headers[name.toLowerCase()];
}

function delHeader(headers: Headers, name: string) {
  delete headers[name];
  delete headers[name.toLowerCase()];
}

export function _createRequest(this: any, params) {
  let date = new Date();
  if (this.options.amendTimeSkewed) {
    date = +new Date() + this.options.amendTimeSkewed;
  }
  const headers: Headers = {
    'x-oss-date': dateFormat(date, 'UTC:ddd, dd mmm yyyy HH:MM:ss \'GMT\''),
    'x-oss-user-agent': this.userAgent
  };

  if (this.userAgent.includes('nodejs')) {
    headers['User-Agent'] = this.userAgent;
  }

  if (this.options.isRequestPay) {
    Object.assign(headers, { 'x-oss-request-payer': 'requester' });
  }

  if (this.options.stsToken) {
    headers['x-oss-security-token'] = this.options.stsToken;
  }

  copy(params.headers).to(headers);

  if (!getHeader(headers, 'Content-Type')) {
    if (params.mime && params.mime.indexOf('/') > 0) {
      headers['Content-Type'] = params.mime;
    } else {
      headers['Content-Type'] = mime.getType(params.mime || path.extname(params.object || ''));
    }
  }

  if (!getHeader(headers, 'Content-Type')) {
    delHeader(headers, 'Content-Type');
  }

  if (params.content) {
    headers['Content-Md5'] = crypto
      .createHash('md5')
      .update(Buffer.from(params.content, 'utf8'))
      .digest('base64');
    if (!headers['Content-Length']) {
      headers['Content-Length'] = params.content.length;
    }
  }

  const authResource = getResource(params);
  headers.authorization = authorization(params.method, authResource, params.subres, headers, this.options);

  const url = getReqUrl(params, this.options);
  _debug('request %s %s, with headers %j, !!stream: %s', params.method, url, headers, !!params.stream);
  const timeout = params.timeout || this.options.timeout;
  const reqParams: ReqParams = {
    method: params.method,
    content: params.content,
    stream: params.stream,
    headers,
    timeout,
    writeStream: params.writeStream,
    customResponse: params.customResponse,
    ctx: params.ctx || this.ctx
  };
  if (this.agent) {
    reqParams.agent = this.agent;
  }
  if (this.httpsAgent) {
    reqParams.httpsAgent = this.httpsAgent;
  }

  return {
    url,
    params: reqParams
  };
}