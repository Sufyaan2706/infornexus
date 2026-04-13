const { VITE_UNAME, VITE_AUTH } = import.meta.env;

if (!VITE_UNAME || !VITE_AUTH) {
    throw new Error(
        "VITE_UNAME and VITE_AUTH must be defined in .env. If you are running Vite from the refactored folder, move .env into refactored/ or use vite.config.js with envDir set to the repo root."
    );
}

export const uname = VITE_UNAME;
export const auth = VITE_AUTH;
export const creds = btoa(`${uname}:${auth}`);

export const PROXY_URL = "http://10.0.0.87:8082/api/infornexus/auth";
export const API_BASE_URL = "https://network.infornexus.com/rest/3.1.0";
export const CUSTOMER_ID = "adidas_sa_ltd";