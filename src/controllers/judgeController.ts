import axios from "axios"
import type { Request, Response } from "express"
import { Question } from "../models/Question"
import { generateCppWrapperCode } from "../utils/codeGenerator"

const JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true"
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "YOUR_API_KEY"

let cachedLanguages: any[] = []

export const fetchLanguagesFromJudge0 = async () => {
  try {
    const response = await axios.get("https://judge0-ce.p.rapidapi.com/languages", {
      headers: {
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
    })

    cachedLanguages = response.data
    console.log("✅ Judge0 languages cached.")
  } catch (err) {
    console.error("❌ Failed to fetch Judge0 languages:", err)
  }
}

export const getLanguages = async (_req: Request, res: Response): Promise<void> => {
  if (cachedLanguages.length === 0) {
    await fetchLanguagesFromJudge0()
  }

  if (cachedLanguages.length > 0) {
    res.status(200).json(cachedLanguages)
  } else {
    res.status(500).json({ error: "Could not fetch languages" })
  }
}

const encodeToBase64 = (str: string): string => {
  return Buffer.from(str, "utf-8").toString("base64")
}

const decodeFromBase64 = (str: string): string => {
  try {
    return Buffer.from(str, "base64").toString("utf-8")
  } catch {
    return str
  }
}

export const compileCode = async (req: Request, res: Response): Promise<void> => {
  const { source_code, language_id, questionId } = req.body

  console.log("🔍 Request Details:")
  console.log("- Language ID:", language_id)
  console.log("- Question ID:", questionId)
  console.log("- Source Code Length:", source_code?.length)

  try {
    let wrappedCode = source_code

    if (language_id === 54) {
      if (!questionId) {
        console.log("⚠️ No questionId provided, cannot generate test wrapper.")
        res.status(400).json({ error: "Missing questionId for C++ code." })
        return
      }

      const question = await Question.findById(questionId)

      if (question?.functionMetadata && question?.testCases) {
        const functionMetadata = {
          functionName: question.functionMetadata.functionName ?? "",
          returnType: question.functionMetadata.returnType ?? "void",
          parameters: (question.functionMetadata.parameters ?? []).map((param: any) => ({
            name: param.name ?? "param",
            type: param.type ?? "int",
          })),
        }

        const testCases = question.testCases.map((tc: any) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
        }))

        wrappedCode = generateCppWrapperCode(source_code, functionMetadata, testCases)
        console.log("✅ Successfully generated full C++ wrapper.")
      }
    }

    console.log("🔧 Final wrapped code:")
    console.log("=".repeat(50))
    console.log(wrappedCode)
    console.log("=".repeat(50))

    const encodedSourceCode = encodeToBase64(wrappedCode)
    const encodedStdin = encodeToBase64("")

    console.log("🚀 Sending code to Judge0...")

    const response = await axios.post(
      JUDGE0_API_URL,
      {
        source_code: encodedSourceCode,
        language_id,
        stdin: encodedStdin,
      },
      {
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": JUDGE0_API_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
        timeout: 30000, // 30 second timeout
      },
    )

    const result = response.data

    if (result.stdout) {
      result.stdout = decodeFromBase64(result.stdout)
    }
    if (result.stderr) {
      result.stderr = decodeFromBase64(result.stderr)
    }
    if (result.compile_output) {
      result.compile_output = decodeFromBase64(result.compile_output)
    }

    console.log("✅ Judge0 Response Received.")
    res.status(200).json(result)
  } catch (error: any) {
    console.error("❌ Compilation error:", error.response?.data || error.message)

    if (error.response?.status === 400) {
      res.status(400).json({
        error: "Bad request to Judge0 API",
        details: error.response.data,
      })
    } else if (error.response?.status === 429) {
      res.status(429).json({
        error: "Rate limit exceeded. Please try again later.",
      })
    } else {
      res.status(500).json({
        error: "Compilation failed",
        details: error.message,
      })
    }
  }
}
