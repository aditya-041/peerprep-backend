import { QuestionMetadata, Parameter } from "./types";

function indent(code: string, spaces: number = 4): string {
  return code
    .split("\n")
    .map((line) => " ".repeat(spaces) + line)
    .join("\n");
}

function getStructsNeeded(meta: QuestionMetadata): string {
  let structs = "";
  const types = [
    meta.returnType,
    ...meta.parameters.map((p) => p.type),
  ];

  if (types.includes("ListNode*")) {
    structs += `
struct ListNode {
  int val;
  ListNode* next;
  ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* buildList(const vector<int>& vals) {
  if (vals.empty()) return nullptr;
  ListNode* head = new ListNode(vals[0]);
  ListNode* curr = head;
  for (int i = 1; i < vals.size(); ++i) {
    curr->next = new ListNode(vals[i]);
    curr = curr->next;
  }
  return head;
}

void printList(ListNode* head) {
  cout << "[";
  while (head) {
    cout << head->val;
    if (head->next) cout << ",";
    head = head->next;
  }
  cout << "]" << endl;
}
`;
  }

  // Add TreeNode, Graph, etc., as needed
  return structs.trim();
}

function generateCppInputParsing(params: Parameter[]): string {
  return params
    .map((p) => {
      if (p.type === "int" || p.type === "bool" || p.type === "string")
        return `${p.type} ${p.name}; cin >> ${p.name};`;

      if (p.type === "vector<int>")
        return `int n_${p.name}; cin >> n_${p.name}; vector<int> ${p.name}(n_${p.name}); for(int i=0;i<n_${p.name};++i) cin >> ${p.name}[i];`;

      if (p.type === "ListNode*")
        return `int n_${p.name}; cin >> n_${p.name}; vector<int> vals_${p.name}(n_${p.name}); for(int i=0;i<n_${p.name};++i) cin >> vals_${p.name}[i]; ListNode* ${p.name} = buildList(vals_${p.name});`;

      return `// TODO: parsing for ${p.type}`;
    })
    .join("\n");
}

function generateCppOutputPrint(returnType: string): string {
  if (returnType === "int" || returnType === "bool" || returnType === "string")
    return `cout << result << endl;`;

  if (returnType === "vector<int>")
    return `cout << "["; for(size_t i = 0; i < result.size(); ++i) { cout << result[i]; if(i < result.size() - 1) cout << ","; } cout << "]" << endl;`;

  if (returnType === "ListNode*") return `printList(result);`;

  return `// TODO: print for ${returnType}`;
}

export function generateCppWrapper(
  userCode: string,
  meta: QuestionMetadata
): string {
  const inputParsing = generateCppInputParsing(meta.parameters);
  const argList = meta.parameters.map((p) => p.name).join(", ");
  const outputPrint = generateCppOutputPrint(meta.returnType);
  const structs = getStructsNeeded(meta);

  return `
#include <iostream>
#include <vector>
#include <string>
using namespace std;

${structs}

${userCode}

int main() {
${indent(inputParsing)}

    ${meta.returnType} result = ${meta.functionName}(${argList});
${indent(outputPrint)}

    return 0;
}
`.trim();
}
