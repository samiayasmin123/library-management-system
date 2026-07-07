async function sendMessage(){

    const session = Number(document.getElementById("session").value);

    const user = Number(document.getElementById("user").value);

    const message = document.getElementById("message").value;

    const responseBox = document.getElementById("response");

    responseBox.innerText = "Loading...";

    const response = await fetch("/chat",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify({
            session_id:session,
            user_id:user,
            message:message
        })

    });

    const data = await response.json();

    responseBox.innerText = data.response;
}