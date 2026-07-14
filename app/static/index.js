// ---------------------------------------------------
// State
// ---------------------------------------------------

let sessionId = null;
let pendingConfirmation = false;

// ---------------------------------------------------
// Page load: if we already have a token, skip login
// ---------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("token");

    if (token) {
        showChatSection();
    }

});

// ---------------------------------------------------
// Login
// ---------------------------------------------------

async function login() {

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorBox = document.getElementById("login-error");

    errorBox.innerText = "";

    try {

        const response = await fetch("/auth/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email: email,
                password: password
            })

        });

        if (!response.ok) {
            errorBox.innerText = "Invalid email or password.";
            return;
        }

        const data = await response.json();

        localStorage.setItem("token", data.access_token);

        showChatSection();

    } catch (err) {
        errorBox.innerText = "Login failed. Please try again.";
    }

}

// ---------------------------------------------------
// Logout
// ---------------------------------------------------

function logout() {

    localStorage.removeItem("token");

    sessionId = null;
    pendingConfirmation = false;

    document.getElementById("chat-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";

    document.getElementById("response").innerText = "No response yet...";
}

// ---------------------------------------------------
// Show chat UI, hide login UI
// ---------------------------------------------------

function showChatSection() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("chat-section").style.display = "block";
}

// ---------------------------------------------------
// Send a chat message
// ---------------------------------------------------

async function sendMessage() {

    const token = localStorage.getItem("token");

    if (!token) {
        document.getElementById("chat-section").style.display = "none";
        document.getElementById("login-section").style.display = "block";
        return;
    }

    const message = document.getElementById("message").value;
    const responseBox = document.getElementById("response");

    responseBox.innerText = "Loading...";

    const requestBody = {
        message: message,
        session_id: sessionId
    };

    if (pendingConfirmation) {
        requestBody.awaiting_confirmation = true;
        pendingConfirmation = false;
    }

    const response = await fetch("/chat", {

        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },

        body: JSON.stringify(requestBody)

    });

    if (response.status === 401) {
        logout();
        return;
    }

    const data = await response.json();

    sessionId = data.session_id;

    responseBox.innerText = data.response;

    if (data.awaiting_confirmation) {
        pendingConfirmation = true;
    }

    document.getElementById("message").value = "";
}