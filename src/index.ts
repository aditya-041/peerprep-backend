import express, { type Request, type Response } from "express"
import http from "http"
import cors from "cors"
import { Server, type Socket } from "socket.io"
import mongoose from "mongoose"
import { calculateScore } from "./scoringUtils"
import { compileCode } from "./controllers/judgeController"
import { getLanguages } from "./controllers/judgeController"
import { fetchLanguagesFromJudge0 } from "./controllers/judgeController"
import { Question } from "./models/Question"
import { generateFunctionSignature } from "./utils/generateSignature"

const app = express()

// Use environment variables
const PORT = process.env.PORT || 4000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/coding-platform"
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000"

// CORS configuration for production
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [CORS_ORIGIN, FRONTEND_URL]
      : ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST"],
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json())

const server = http.createServer(app)

// Socket.IO configuration for production
const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  allowEIO3: true,
})

app.get("/api/languages", getLanguages)
app.post("/api/compile", compileCode)

// MongoDB connection with error handling
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

app.get("/api/questions", async (_req: Request, res: Response) => {
  try {
    const questions = await Question.find()
    res.json(questions)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Failed to fetch questions" })
  }
})

app.post("/api/questions", async (req: Request, res: Response) => {
  try {
    const questionData = req.body
    const newQuestion = new Question(questionData)
    await newQuestion.save()
    res.status(201).json(newQuestion)
  } catch (err) {
    console.log(err)
    res.status(400).json({ error: "Failed to add question" })
  }
})

interface Participant {
  id: string
  name: string
  status: string
  score: number
  timeSpent: string
  scoresPerQuestion: Record<number, number>
  joinTime: number
}

interface TestCase {
  id: number
  input: string
  expectedOutput: string
}

interface QuestionType {
  _id: string
  title: string
  description: string
  example: string
  testCases: TestCase[]
  difficulty: "Easy" | "Medium" | "Hard"
  functionMetadata?: {
    functionName: string
    returnType: string
    parameters: { name: string; type: string }[]
  }
}

interface Room {
  questions: QuestionType[]
  participants: Participant[]
}

const rooms: Record<string, Room> = {}

io.on("connection", (socket: Socket) => {
  console.log("✅ User connected:", socket.id)

  socket.on("create-room", ({ roomId, questions }: { roomId: string; questions: QuestionType[] }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { questions, participants: [] }
      console.log(`📁 Room created: ${roomId} with questions`, questions)
    }
  })

  socket.on("join-room", ({ roomId, username }: { roomId: string; username: string }) => {
    socket.join(roomId)

    if (!rooms[roomId]) {
      rooms[roomId] = { questions: [], participants: [] }
    }

    const now = Date.now()

    const existingParticipant = rooms[roomId].participants.find((p) => p.name === username)
    if (existingParticipant) {
      existingParticipant.id = socket.id
      existingParticipant.status = "idle"
      existingParticipant.joinTime = existingParticipant.joinTime || now
    } else {
      rooms[roomId].participants.push({
        id: socket.id,
        name: username,
        status: "idle",
        score: 0,
        timeSpent: "00:00",
        scoresPerQuestion: {},
        joinTime: now,
      })
      socket.to(roomId).emit("user-joined", username)
    }

    io.to(roomId).emit("participants-update", rooms[roomId].participants)

    const enhancedQuestions = rooms[roomId].questions.map((q) => {
      let functionSignature = ""
      if (
        q.functionMetadata &&
        q.functionMetadata.functionName &&
        q.functionMetadata.returnType &&
        q.functionMetadata.parameters
      ) {
        functionSignature = generateFunctionSignature({
          functionName: q.functionMetadata.functionName,
          returnType: q.functionMetadata.returnType,
          parameters: q.functionMetadata.parameters,
        })
      }

      return {
        ...q,
        functionMetadata: {
          ...(q.functionMetadata || {}),
          signature: functionSignature,
        },
      }
    })

    socket.emit("room-questions", enhancedQuestions)
  })

  socket.on("update-status", ({ roomId, username, status }: { roomId: string; username: string; status: string }) => {
    const room = rooms[roomId]
    if (!room) return

    const participant = room.participants.find((p) => p.id === socket.id || p.name === username)
    if (participant) {
      participant.status = status
      io.to(roomId).emit("participants-update", room.participants)
    }
  })

  socket.on(
    "update-score",
    ({
      roomId,
      questionIndex,
      passedTestCases,
      wrongAttempts,
      elapsedMinutes,
    }: {
      roomId: string
      questionIndex: number
      passedTestCases: number
      wrongAttempts: number
      elapsedMinutes: number
    }) => {
      const room = rooms[roomId]
      if (!room) return

      const participant = room.participants.find((p) => p.id === socket.id)
      const question = room.questions[questionIndex]

      if (participant && question) {
        const totalTestCases = question.testCases.length

        const score = calculateScore({
          difficulty: question.difficulty,
          passedTestCases,
          totalTestCases,
          wrongAttempts,
          elapsedMinutes,
        })

        const previousScore = participant.scoresPerQuestion[questionIndex] || 0

        if (score > previousScore) {
          participant.score = (participant.score || 0) - previousScore + score
          participant.scoresPerQuestion[questionIndex] = score
        }

        participant.status = "submitted"
        console.log("➡️ Scoring Params:")
        console.log({
          difficulty: question.difficulty,
          passedTestCases,
          totalTestCases,
          wrongAttempts,
          elapsedMinutes,
        })

        console.log(`📝 Score updated for ${participant.name} (${participant.id}) with score ${participant.score}`)
        io.to(roomId).emit("participants-update", room.participants)
      }
    },
  )

  socket.on("leave-room", ({ roomId, username }: { roomId: string; username: string }) => {
    socket.leave(roomId)

    const room = rooms[roomId]
    if (room) {
      const index = room.participants.findIndex((p) => p.id === socket.id)
      if (index !== -1) {
        const [removed] = room.participants.splice(index, 1)
        io.to(roomId).emit("participants-update", room.participants)
        socket.to(roomId).emit("user-left", username)
        console.log(`🚪 ${username} permanently left room ${roomId}`)
      }
    }
  })

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id)

    for (const roomId in rooms) {
      const room = rooms[roomId]
      const participant = room.participants.find((p) => p.id === socket.id)

      if (participant) {
        participant.status = "idle"
        io.to(roomId).emit("participants-update", room.participants)
        io.to(roomId).emit("user-left", participant.name)
        console.log(`ℹ️ Marked ${participant.name} as idle in room ${roomId}`)
      }
    }
  })
})

app.get("/", (_req: Request, res: Response) => {
  res.send("🚀 Backend is running on Render")
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    mongoose.connection.close()
    process.exit(0)
  })
})

server.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
  await fetchLanguagesFromJudge0()
})
