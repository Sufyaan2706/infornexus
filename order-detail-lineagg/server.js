const myHeaders = new Headers();

myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

myHeaders.append("Authorization", "Basic YWRtaW46L0s1PSI4NEBwM2xiIw == ");


const urlencoded = new URLSearchParams();

urlencoded.append("url", "https://network.infornexus.com/rest / 3.1.0 / OrderDetail / 540027620376");

urlencoded.append("request_method", "GET");

urlencoded.append("customer", "adidas_sa_ltd");


const requestOptions = {

    method: "POST",

    headers: myHeaders,

    body: urlencoded,

    redirect: "follow"

};


fetch("http://10.0.0.87:8082/api/infornexus/auth",
    requestOptions)

    .then((response) => response.text())

    .then((result) => console.log(result))

    .catch((error) => console.error(error));