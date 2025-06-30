export type Parameter = {
  name: string;
  type: string;
};

export type QuestionMetadata = {
  functionName: string;
  returnType: string;
  parameters: Parameter[];
};
