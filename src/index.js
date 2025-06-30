"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});
const rooms = {};
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    // Client creates a room with selected questions
    socket.on("create-room", ({ roomId, questions }) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { questions, participants: [] };
            console.log(`Room created: ${roomId} with questions`, questions);
        }
    });
    // Participant joins a room
    socket.on("join-room", ({ roomId, username }) => {
        socket.join(roomId);
        // Initialize room if doesn't exist (with empty questions by default)
        if (!rooms[roomId]) {
            rooms[roomId] = { questions: [], participants: [] };
            console.log(`Room ${roomId} auto-created with no questions`);
        }
        // Add participant if not already present
        const existing = rooms[roomId].participants.find((p) => p.id === socket.id);
        if (!existing) {
            rooms[roomId].participants.push({
                id: socket.id,
                name: username,
                status: "idle",
            });
        }
        // Notify others in room that a user joined
        socket.to(roomId).emit("user-joined", username);
        // Send current participants list to all in the room
        io.to(roomId).emit("participants-update", rooms[roomId].participants);
        // Send questions to the new participant only
        socket.emit("room-questions", rooms[roomId].questions);
    });
    // Participant updates their status (e.g., coding, idle)
    socket.on("update-status", ({ roomId, status }) => {
        const room = rooms[roomId];
        if (!room)
            return;
        const participant = room.participants.find((p) => p.id === socket.id);
        if (participant) {
            participant.status = status;
            io.to(roomId).emit("participants-update", room.participants);
        }
    });
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        // Remove participant from all rooms they are in
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.participants.findIndex((p) => p.id === socket.id);
            if (index !== -1) {
                const [removedParticipant] = room.participants.splice(index, 1);
                // Notify room participants about updated participants list
                io.to(roomId).emit("participants-update", room.participants);
                // Notify room someone left
                io.to(roomId).emit("user-left", removedParticipant.name);
            }
        }
    });
});
// Health check endpoint
app.get("/", (_req, res) => {
    res.send("Backend is running");
});
server.listen(4000, () => {
    console.log("Server running on http://localhost:4000");
});
