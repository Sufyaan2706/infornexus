export class Config {
    static get env() { return import.meta.env; }

    static get credentials() {
        const { VITE_UNAME, VITE_AUTH } = this.env;
        if (!VITE_UNAME || !VITE_AUTH) {
            throw new Error("Missing VITE_UNAME or VITE_AUTH in .env.");
        }
        return btoa(`${VITE_UNAME}:${VITE_AUTH}`);
    }

    static get proxyUrl() { return "http://10.0.0.87:8082/api/infornexus/auth"; }
    static get apiBaseUrl() { return "https://network.infornexus.com/rest/3.1.0"; }
    static get customerId() { return "adidas_sa_ltd"; }
    static get catalogListId() { return 'adidasWeightsUnified5717989018343878'; }
}