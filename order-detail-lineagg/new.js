const myHeaders = new Headers();
myHeaders.append("Accept", "application/pdf");
myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
myHeaders.append("Authorization", "");

const urlencoded = new URLSearchParams();
urlencoded.append("url", "https://network.infornexus.com/rest/3.1/OrderDetail/query?oql=poNumber%3D%274801373753%27");
urlencoded.append("request_method", "GET");
urlencoded.append("customer", "puma");

const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow"
};

fetch("http://10.0.0.87:8082/api/infornexus/auth", requestOptions)
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.error(error));