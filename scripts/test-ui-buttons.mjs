import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("=================================================");
console.log("  VECTORLY UI BUTTONS VERIFICATION TEST SUITE   ");
console.log("=================================================\n");

const pagePath = path.resolve("app/page.tsx");
const pageCode = fs.readFileSync(pagePath, "utf-8");

const testedButtons = [];
let passedCount = 0;
let failedCount = 0;

function testButton(name, category, expectations) {
  try {
    expectations();
    testedButtons.push({ name, category, status: "PASS" });
    passedCount++;
    console.log(`  [PASS] (${category}) -> ${name}`);
  } catch (err) {
    testedButtons.push({ name, category, status: "FAIL", error: err.message });
    failedCount++;
    console.error(`  [FAIL] (${category}) -> ${name}: ${err.message}`);
  }
}

console.log("--- 1. Testing AuthScreen Buttons ---");

testButton("Sign In Tab Button", "Auth", () => {
  assert.ok(
    pageCode.includes("setIsRegister(false)"),
    "Sign In button must set isRegister to false to open login form"
  );
  assert.ok(
    pageCode.includes('!isRegister ? "bg-black text-white shadow-sm" : "text-zinc-500 hover:text-black"'),
    "Sign In button must have active visual styling when selected"
  );
});

testButton("Register Tab Button", "Auth", () => {
  assert.ok(
    pageCode.includes("setIsRegister(true)"),
    "Register button must set isRegister to true to open registration form"
  );
  assert.ok(
    pageCode.includes("isRegister && ("),
    "Register state must open the Full Name input field"
  );
});

testButton("Auth Form Submit Button", "Auth", () => {
  assert.ok(
    pageCode.includes('type="submit"'),
    "Auth form must have a submit button"
  );
  assert.ok(
    pageCode.includes("await register(email, password, fullName)") && pageCode.includes("await login(email, password)"),
    "Submitting must call register or login and open the main dashboard upon success"
  );
  assert.ok(
    pageCode.includes("isRegister ? \"Create Account\" : \"Sign In to Workspace\""),
    "Submit button label must dynamically reflect current auth mode"
  );
});

testButton("⚡ 1-Click Instant Demo Login Button", "Auth", () => {
  assert.ok(
    pageCode.includes("onClick={handleDemo}"),
    "Demo login button must bind to handleDemo"
  );
  assert.ok(
    pageCode.includes("await quickDemoLogin()"),
    "handleDemo must call quickDemoLogin to open dashboard immediately"
  );
});

console.log("\n--- 2. Testing Sidebar Navigation Buttons (NavItem) ---");

const navViews = [
  "Overview",
  "Ask your data",
  "Documents",
  "Projects",
  "Evaluations",
  "Activity",
  "Settings",
];

for (const view of navViews) {
  testButton(`Nav Button: "${view}"`, "Navigation", () => {
    const navRegex = new RegExp(`label="${view.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?onClick={\\(\\) => setActiveView\\("${view.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)}`);
    assert.ok(
      navRegex.test(pageCode),
      `NavItem for '${view}' must have onClick handler setting activeView to '${view}'`
    );
    assert.ok(
      pageCode.includes(`"${view}":`) || pageCode.includes(`${view}:`),
      `viewContent must have matching view renderer for '${view}'`
    );
  });
}

testButton("Sidebar User Profile Sign Out Button", "Navigation", () => {
  assert.ok(
    pageCode.includes('onClick={logout} title="Sign out"'),
    "User profile in sidebar must have Sign Out button bound to logout"
  );
});

console.log("\n--- 3. Testing Header Buttons ---");

testButton("Header 'Sign Out' Button", "Header", () => {
  assert.ok(
    pageCode.includes("onClick={logout}"),
    "Header sign out button must call logout"
  );
});

testButton("Header Quick Search '⌘ K' Button", "Header", () => {
  assert.ok(
    pageCode.includes("onClick={() => setShowSearchModal(true)}"),
    "Header search button must open the Quick Search / Command Palette modal"
  );
  assert.ok(
    pageCode.includes("showSearchModal && ("),
    "showSearchModal state must render the search modal"
  );
});

testButton("Header Notification Bell Button", "Header", () => {
  assert.ok(
    pageCode.includes("onClick={() => setShowNotifications(!showNotifications)}"),
    "Notification bell button must toggle notifications popover"
  );
  assert.ok(
    pageCode.includes("showNotifications && ("),
    "showNotifications state must render the notification popover panel"
  );
});

testButton("Header User Avatar Button", "Header", () => {
  assert.ok(
    pageCode.includes('onClick={() => setActiveView("Settings")}'),
    "Header user avatar button must navigate to Settings view"
  );
});

console.log("\n--- 4. Testing Overview View Buttons ---");

testButton("'Manage projects' Button in Overview", "Overview", () => {
  assert.ok(
    pageCode.includes('onClick={() => setView("Projects")}'),
    "Manage projects button must open the Projects tab"
  );
});

testButton("'Ask your knowledge base' Arrow Button in Overview", "Overview", () => {
  assert.ok(
    pageCode.includes('onClick={() => setView("Ask your data")}'),
    "Overview knowledge base arrow button must open the 'Ask your data' tab"
  );
});

testButton("'Run retrieval' Button in Overview", "Overview", () => {
  assert.ok(
    pageCode.includes("onClick={handleRunQuery}"),
    "Run retrieval button must trigger handleRunQuery"
  );
  assert.ok(
    pageCode.includes("api.retrieval.query(activeProject.id, question.trim(), 5, \"hybrid\")"),
    "handleRunQuery must execute hybrid retrieval query"
  );
  assert.ok(
    pageCode.includes("queryResult && ("),
    "Successful retrieval query must open/render the Grounded Answer result card"
  );
});

testButton("Project Card Selector Buttons in Overview", "Overview", () => {
  assert.ok(
    pageCode.includes("onClick={() => setActiveProject(project)}"),
    "Clicking a project card in Overview must switch the active project"
  );
});

testButton("'View all' Activity Button in Overview", "Overview", () => {
  assert.ok(
    pageCode.includes('onClick={() => setView("Activity")}'),
    "View all activity button must open the Activity tab"
  );
});

console.log("\n--- 5. Testing Documents View Buttons ---");

testButton("'Upload documents' Action Button", "Documents", () => {
  assert.ok(
    pageCode.includes("onClick={() => setShowUploadModal(true)}"),
    "Upload documents button must set showUploadModal to true to open upload panel"
  );
  assert.ok(
    pageCode.includes("showUploadModal && ("),
    "showUploadModal state must render the upload panel/modal"
  );
});

testButton("'Cancel' Button in Upload Modal", "Documents", () => {
  assert.ok(
    pageCode.includes("onClick={() => setShowUploadModal(false)}"),
    "Cancel button in upload modal must close the upload modal"
  );
});

testButton("'Click to browse file' Upload Box", "Documents", () => {
  assert.ok(
    pageCode.includes("onClick={() => fileInputRef.current?.click()}"),
    "File drop zone must open the OS native file picker on click"
  );
  assert.ok(
    pageCode.includes("onChange={handleFileUpload}"),
    "Selecting a file must trigger handleFileUpload"
  );
});

testButton("'Save & Index' Direct Text Document Button", "Documents", () => {
  assert.ok(
    pageCode.includes("onSubmit={handleCreateTextDoc}"),
    "Text doc form submit must trigger handleCreateTextDoc"
  );
  assert.ok(
    pageCode.includes("api.documents.create(activeProject.id, textDocName.trim(), textDocContent.trim())"),
    "handleCreateTextDoc must call api.documents.create and index chunk content"
  );
});

testButton("Delete Document Trash Button", "Documents", () => {
  assert.ok(
    pageCode.includes("onClick={() => handleDelete(doc.id)}"),
    "Delete button on document rows must trigger handleDelete"
  );
  assert.ok(
    pageCode.includes("api.documents.delete(activeProject.id, docId)"),
    "handleDelete must call api.documents.delete"
  );
});

console.log("\n--- 6. Testing 'Ask your data' View Buttons ---");

testButton("'Generate answer' Button", "AskData", () => {
  assert.ok(
    pageCode.includes("onClick={handleAsk}"),
    "Generate answer button must trigger handleAsk"
  );
  assert.ok(
    pageCode.includes("api.retrieval.query(activeProject.id, question.trim(), 5, mode)"),
    "handleAsk must call retrieval API with chosen mode (hybrid/bm25/semantic)"
  );
  assert.ok(
    pageCode.includes("response && ("),
    "handleAsk success must open and display the Grounded Answer and citations"
  );
});

console.log("\n--- 7. Testing Projects View Buttons ---");

testButton("'Create project' Action Button", "Projects", () => {
  assert.ok(
    pageCode.includes("onClick={() => setShowCreateModal(true)}"),
    "Create project button must set showCreateModal to true to open project form"
  );
  assert.ok(
    pageCode.includes("showCreateModal && ("),
    "showCreateModal state must render the Create New Project form"
  );
});

testButton("'Cancel' Button in Create Project Form", "Projects", () => {
  assert.ok(
    pageCode.includes("onClick={() => setShowCreateModal(false)}"),
    "Cancel button in create project form must close the form"
  );
});

testButton("'Save Project' Submit Button", "Projects", () => {
  assert.ok(
    pageCode.includes("onSubmit={handleCreate}"),
    "Project form must trigger handleCreate on submit"
  );
  assert.ok(
    pageCode.includes("api.projects.create(name.trim(), description.trim() || undefined)"),
    "handleCreate must call api.projects.create"
  );
});

testButton("Delete Project Trash Button", "Projects", () => {
  assert.ok(
    pageCode.includes("onClick={() => handleDelete(project.id)}"),
    "Delete project button must trigger handleDelete"
  );
  assert.ok(
    pageCode.includes("api.projects.delete(id)"),
    "handleDelete in projects must call api.projects.delete"
  );
});

testButton("'Set Active →' Project Button", "Projects", () => {
  assert.ok(
    pageCode.includes("onClick={() => setActiveProject(project)}"),
    "Set Active button on project cards must trigger setActiveProject"
  );
});

console.log("\n=================================================");
console.log(`TOTAL BUTTONS TESTED: ${testedButtons.length}`);
console.log(`PASSED:               ${passedCount}`);
console.log(`FAILED:               ${failedCount}`);
console.log("=================================================");

if (failedCount > 0) {
  process.exit(1);
}
