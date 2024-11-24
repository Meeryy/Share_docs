import express from "express";
import { Server } from "socket.io";
import http from "http";
import * as Diff from "diff";

const PORT = 8080;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = {};
let text = "Hello world";

app.use(express.static("public"));

function applyDiff(diff) {
    let index = 0;
    diff.forEach(part => {
        if (part.removed) {
            text = text.slice(0, index) + text.slice(index + part.count);
        } else if (part.added) {
            text = text.slice(0, index) + part.value + text.slice(index);
        }
        index += part.count;
    });
}

io.on("connection", (socket) => {
    console.log("User connected: " + socket.id);

    socket.on("COMM_JOIN", (user) => {
        users[socket.id] = user;
        console.log("User joined: " + socket.id);
        socket.emit("COMM_DOCUMENT_SET", text);
        io.emit("COMM_USERS", users);
    });

    socket.on("COMM_LEAVE", () => {
        delete users[socket.id];
        console.log("User left: " + socket.id);
        io.emit("COMM_USERS", users);
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        console.log("User disconnected: " + socket.id);
        io.emit("COMM_USERS", users);
    });

    socket.on("COMM_DOCUMENT_SET", (incoming) => {
        text = incoming;
        socket.broadcast.emit("COMM_DOCUMENT_SET", text);
    });

    socket.on("COMM_DOCUMENT_UPDATE", (incoming) => {
        applyDiff(incoming);
        socket.broadcast.emit("COMM_DOCUMENT_UPDATE", incoming);
    });

    socket.on("COMM_CURSOR", (position) => {
        users[socket.id].ptrX = position.x;
        users[socket.id].ptrY = position.y;
        io.emit("COMM_USERS", users);
    });
    
    // New event for highlighting text
    socket.on("COMM_TEXT_HIGHLIGHT", (highlightData) => {
        socket.broadcast.emit("COMM_TEXT_HIGHLIGHT", highlightData);
    });

    socket.on('COMM_HIGHLIGHT', (highlightData) => {
        // Broadcast the highlight data to all other connected users
        socket.broadcast.emit('COMM_HIGHLIGHT', highlightData);
    });
    
});


socket.on('connect', () => {
    // Po připojení zkontrolujte a nahrajte neodeslané aktualizace
    if (pendingUpdates.length > 0) {
        pendingUpdates.forEach(diff => {
            socket.emit("COMM_DOCUMENT_UPDATE", diff);
        });
    }

    // Obnovit text, pokud je uložen v localStorage
    const savedText = localStorage.getItem('documentText');
    if (savedText) {
        socket.emit("COMM_DOCUMENT_SET", savedText);
    }
});


server.listen(PORT);
console.log("Server listening at port " + PORT);


