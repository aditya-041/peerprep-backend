// utils/generateFunctionSignature.ts
export function generateFunctionSignature({
  functionName,
  returnType,
  parameters,
}: {
  functionName: string
  returnType: string
  parameters: { name: string; type: string }[]
}): string {
  const paramList = parameters.map((p) => `${p.type} ${p.name}`).join(", ")
  return `${returnType} ${functionName}(${paramList});`
}
