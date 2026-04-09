import { uname, pw } from './secrets.js';

export const creds = btoa(`${uname}:${pw}`);

export const PROXY_URL = "http://10.0.0.87:8082/api/infornexus/auth";
export const API_BASE_URL = "https://network.infornexus.com/rest/3.1.0";
export const CUSTOMER_ID = "adidas_sa_ltd";