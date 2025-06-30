export function generateCppWrapperCode(
  functionCode: string,
  functionMetadata: {
    functionName: string;
    returnType: string;
    parameters: { name: string; type: string }[];
  },
  testCases: {
    input: { [key: string]: any };
    expectedOutput: any;
  }[]
): string {
  const { functionName, parameters, returnType } = functionMetadata;
  const usesListNode = parameters.some((p) => p.type.includes("ListNode"));
  const usesTreeNode = parameters.some((p) => p.type.includes("TreeNode"));
  const returnsVecVecInt = returnType.includes("vector<vector<int>>");

  const headers = `#include<bits/stdc++.h>\nusing namespace std;`;

  const helpers = `
${usesListNode ? `
struct ListNode {
  int val;
  ListNode* next;
  ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* buildList(const vector<int>& arr) {
  if (arr.empty()) return nullptr;
  ListNode* head = new ListNode(arr[0]);
  ListNode* curr = head;
  for (int i = 1; i < arr.size(); ++i) {
    curr->next = new ListNode(arr[i]);
    curr = curr->next;
  }
  return head;
}

void printList(ListNode* head) {
  cout << "[";
  bool first = true;
  while (head) {
    if (!first) cout << ",";
    cout << head->val;
    first = false;
    head = head->next;
  }
  cout << "]" << endl;
}
` : ""}

${usesTreeNode ? `
struct TreeNode {
  int val;
  TreeNode* left;
  TreeNode* right;
  TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

TreeNode* buildTree(const vector<string>& arr) {
  if (arr.empty() || arr[0] == "null") return nullptr;
  TreeNode* root = new TreeNode(stoi(arr[0]));
  queue<TreeNode*> q;
  q.push(root);
  int i = 1;
  while (!q.empty() && i < arr.size()) {
    TreeNode* curr = q.front();
    q.pop();
    if (arr[i] != "null") {
      curr->left = new TreeNode(stoi(arr[i]));
      q.push(curr->left);
    }
    i++;
    if (i < arr.size() && arr[i] != "null") {
      curr->right = new TreeNode(stoi(arr[i]));
      q.push(curr->right);
    }
    i++;
  }
  return root;
}

void printTree(TreeNode* root) {
  queue<TreeNode*> q;
  q.push(root);
  cout << "[";
  while (!q.empty()) {
    TreeNode* node = q.front();
    q.pop();
    if (node) {
      cout << node->val << ",";
      q.push(node->left);
      q.push(node->right);
    } else {
      cout << "null,";
    }
  }
  cout << "]" << endl;
}
` : ""}

${returnsVecVecInt ? `
void printVecVec(const vector<vector<int>>& vec) {
  cout << "[";
  for (size_t i = 0; i < vec.size(); ++i) {
    cout << "[";
    for (size_t j = 0; j < vec[i].size(); ++j) {
      cout << vec[i][j];
      if (j + 1 < vec[i].size()) cout << ",";
    }
    cout << "]";
    if (i + 1 < vec.size()) cout << ",";
  }
  cout << "]" << endl;
}
` : ""}
`;

  let mainBody = "";

  testCases.forEach((testCase, idx) => {
    const args = parameters.map((param) => {
      const paramType = param.type;
      const paramName = param.name;
      const value = testCase.input[paramName];

      if (paramType.includes("vector<vector<int>>")) {
        return `{${value.map((arr: number[]) => `{${arr.join(",")}}`).join(",")}}`;
      } else if (paramType.includes("vector<int>")) {
        return `{${value.join(",")}}`;
      } else if (paramType.includes("ListNode")) {
        return `buildList({${value.join(",")}})`;
      } else if (paramType.includes("TreeNode")) {
        return `buildTree({${value.map((v: string) => `"${v}"`).join(",")}})`;
      } else if (paramType.includes("string")) {
        return `"\${String(value).replace(/"/g, '\\"')}"`;
      }
      else {
        return `${value}`;
      }
    }).join(", ");

    mainBody += `
    // Test case ${idx + 1}
    auto result${idx} = ${functionName}(${args});
    ${usesListNode && returnType.includes("ListNode*")
        ? `printList(result${idx});`
        : usesTreeNode && returnType.includes("TreeNode*")
          ? `printTree(result${idx});`
          : returnsVecVecInt
            ? `printVecVec(result${idx});`
            : returnType.includes("vector<int>")
              ? `cout << "["; for (int i = 0; i < result${idx}.size(); i++) { cout << result${idx}[i]; if(i != result${idx}.size()-1) cout << ","; } cout << "]" << endl;`
              : returnType.includes("bool")
                ? `cout << (result${idx} ? "true" : "false") << endl;`
                : `cout << result${idx} << endl;`
      }`;
  });

  const fullCode = `${headers}

${helpers}

${functionCode}

int main() {${mainBody}
    return 0;
}`;

  return fullCode;
}
