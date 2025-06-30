// // models/Question.ts
// import mongoose from "mongoose";

// const TestCaseSchema = new mongoose.Schema({
//   input: String,
//   expectedOutput: String,
// });

// const QuestionSchema = new mongoose.Schema({
//   title: String,
//   difficulty: {
//     type: String,
//     enum: ["Easy", "Medium", "Hard"],
//   },
//   category: String,
//   tags: [String],
//   timeLimit: Number,
//   description: String,
//   acceptanceRate: Number,
//   exampleInput: String,
//   exampleOutput: String,
//   constraints: [String],
//   testCases: [TestCaseSchema],

//   functionMetadata: {
//     functionName: String,
//     returnType: String,
//     parameters: [
//       {
//         type: new mongoose.Schema({
//           name: String,
//           type: String
//         }, {_id: false})

//       }
//     ]
//   },
// });

// export const Question = mongoose.model("Question", QuestionSchema);


// models/Question.ts

import mongoose from "mongoose";

const TestCaseSchema = new mongoose.Schema({
  input: { type: mongoose.Schema.Types.Mixed, required: true },
  expectedOutput: { type: mongoose.Schema.Types.Mixed, required: true },
});

const ParameterSchema = new mongoose.Schema(
  {
    name: String,
    type: String,
  },
  { _id: false }
);

const FunctionMetadataSchema = new mongoose.Schema(
  {
    functionName: String,
    returnType: String,
    parameters: [ParameterSchema],
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema({
  title: String,
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
  },
  category: String,
  tags: [String],
  timeLimit: Number,
  description: String,
  acceptanceRate: Number,
  exampleInput: mongoose.Schema.Types.Mixed,  // <-- CHANGED to Mixed
  exampleOutput: mongoose.Schema.Types.Mixed, // <-- CHANGED to Mixed
  constraints: [String],
  testCases: [TestCaseSchema],
  functionMetadata: FunctionMetadataSchema,
});

export const Question = mongoose.model("Question", QuestionSchema);

