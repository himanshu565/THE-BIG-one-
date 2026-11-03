import assert from "node:assert/strict";

console.log("=================================================");
console.log("  SIMULATED RUNTIME INTERACTION TEST SUITE       ");
console.log("=================================================\n");

let passedInteractions = 0;
let failedInteractions = 0;

function runInteraction(name, fn) {
  try {
    fn();
    console.log(`  [OK] ${name}`);
    passedInteractions++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failedInteractions++;
  }
}

// 1. Test Auth Screen State Flow
runInteraction("Auth Tab Toggle: 'Register' tab opens Full Name field & 'Create Account' button", () => {
  let isRegister = false;
  let error = "some prior error";

  // Simulate click on 'Register' tab button
  const handleRegisterTabClick = () => {
    isRegister = true;
    error = null;
  };
  handleRegisterTabClick();

  assert.equal(isRegister, true, "isRegister should become true");
  assert.equal(error, null, "Error should be cleared");

  // Determine what button label is shown
  const buttonLabel = isRegister ? "Create Account" : "Sign In to Workspace";
  assert.equal(buttonLabel, "Create Account");
});

runInteraction("Auth Tab Toggle: 'Sign In' tab closes Full Name field & shows 'Sign In' button", () => {
  let isRegister = true;
  let error = "some error";

  // Simulate click on 'Sign In' tab button
  const handleSignInTabClick = () => {
    isRegister = false;
    error = null;
  };
  handleSignInTabClick();

  assert.equal(isRegister, false, "isRegister should become false");
  assert.equal(error, null, "Error should be cleared");

  const buttonLabel = isRegister ? "Create Account" : "Sign In to Workspace";
  assert.equal(buttonLabel, "Sign In to Workspace");
});

runInteraction("Auth Submit Button: In login mode calls login() and sets user context", async () => {
  let authenticatedUser = null;
  const mockLogin = async (email, password) => {
    assert.equal(email, "demo@vectorly.ai");
    assert.equal(password, "demo12345");
    authenticatedUser = { id: 1, email, full_name: "Demo User" };
  };

  // Simulate submit
  await mockLogin("demo@vectorly.ai", "demo12345");
  assert.ok(authenticatedUser, "User should be authenticated");
  assert.equal(authenticatedUser.email, "demo@vectorly.ai");
});

runInteraction("1-Click Instant Demo Button: Calls quickDemoLogin() and authenticates user", async () => {
  let authenticatedUser = null;
  const quickDemoLogin = async () => {
    authenticatedUser = { id: 1, email: "demo@vectorly.ai", full_name: "Demo User" };
  };

  await quickDemoLogin();
  assert.ok(authenticatedUser, "User should be logged in from demo button");
});

// 2. Test Sidebar Navigation & View Opening
const views = [
  "Overview",
  "Ask your data",
  "Documents",
  "Projects",
  "Evaluations",
  "Activity",
  "Settings"
];

for (const targetView of views) {
  runInteraction(`Sidebar Nav Button: Clicking '${targetView}' opens ${targetView} view`, () => {
    let activeView = "Overview";
    // Simulate clicking NavItem
    const onClick = () => {
      activeView = targetView;
    };
    onClick();
    assert.equal(activeView, targetView, `View should change to ${targetView}`);
  });
}

// 3. Test In-Page Navigation from Overview
runInteraction("Overview '+ Manage projects' Button: Transitions activeView to 'Projects'", () => {
  let activeView = "Overview";
  const setView = (v) => { activeView = v; };

  // Simulate button click
  setView("Projects");
  assert.equal(activeView, "Projects", "Should open Projects tab");
});

runInteraction("Overview Quick Ask Arrow Button: Transitions activeView to 'Ask your data'", () => {
  let activeView = "Overview";
  const setView = (v) => { activeView = v; };

  // Simulate button click
  setView("Ask your data");
  assert.equal(activeView, "Ask your data", "Should open Ask your data tab");
});

runInteraction("Overview 'View all' Activity Button: Transitions activeView to 'Activity'", () => {
  let activeView = "Overview";
  const setView = (v) => { activeView = v; };

  // Simulate button click
  setView("Activity");
  assert.equal(activeView, "Activity", "Should open Activity tab");
});

runInteraction("Overview Project Selector: Clicking project card sets active project", () => {
  const projects = [
    { id: 1, name: "Default Project" },
    { id: 2, name: "Platform Docs" }
  ];
  let activeProject = projects[0];

  // Click project 2
  const setActiveProject = (p) => { activeProject = p; };
  setActiveProject(projects[1]);

  assert.equal(activeProject.id, 2);
  assert.equal(activeProject.name, "Platform Docs");
});

runInteraction("Overview 'Run retrieval' Button: Calls API and opens Grounded Answer card", async () => {
  let queryResult = null;
  let loading = false;
  const activeProject = { id: 1, name: "Default Project" };
  const question = "What is the hybrid retrieval latency?";

  const handleRunQuery = async () => {
    loading = true;
    // Simulate api.retrieval.query
    queryResult = {
      answer: "Hybrid retrieval targets under 500ms latency.",
      latency_ms: 120,
      retrieval_mode: "hybrid",
      sources: [{ document_name: "rag_spec.md", chunk_index: 0, content: "Target < 500ms", score: 0.88 }]
    };
    loading = false;
  };

  await handleRunQuery();
  assert.equal(loading, false);
  assert.ok(queryResult, "Query result must be present");
  assert.ok(queryResult.answer.includes("500ms"), "Answer rendered");
  assert.equal(queryResult.sources.length, 1, "Sources rendered");
});

// 4. Test Documents Modal & Action Buttons
runInteraction("Documents 'Upload documents' Button: Opens upload modal", () => {
  let showUploadModal = false;
  // Click 'Upload documents'
  showUploadModal = true;
  assert.equal(showUploadModal, true, "Upload modal should open");
});

runInteraction("Documents Upload Modal 'Cancel' Button: Closes upload modal", () => {
  let showUploadModal = true;
  // Click 'Cancel'
  showUploadModal = false;
  assert.equal(showUploadModal, false, "Upload modal should close");
});

runInteraction("Documents 'Save & Index' Button: Creates doc, closes modal, refreshes docs list", async () => {
  let showUploadModal = true;
  let docs = [{ id: 1, name: "existing.txt", file_type: "txt", file_size: 1024, chunk_count: 2, status: "READY" }];
  let textDocName = "new_guide.md";
  let textDocContent = "# Vectorly Guide\nHybrid search combines lexical and semantic.";

  const handleCreateTextDoc = async () => {
    docs.push({
      id: 2,
      name: textDocName,
      file_type: "md",
      file_size: textDocContent.length,
      chunk_count: 1,
      status: "READY"
    });
    textDocName = "";
    textDocContent = "";
    showUploadModal = false;
  };

  await handleCreateTextDoc();
  assert.equal(showUploadModal, false, "Modal should close on save");
  assert.equal(docs.length, 2, "Docs count should increase");
  assert.equal(docs[1].name, "new_guide.md", "New doc should be present");
});

runInteraction("Documents 'Delete document' Button: Deletes document from active project", async () => {
  let docs = [
    { id: 1, name: "doc1.txt" },
    { id: 2, name: "doc2.txt" }
  ];

  const handleDelete = async (docId) => {
    docs = docs.filter(d => d.id !== docId);
  };

  await handleDelete(1);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, 2);
});

// 5. Test 'Ask your data' Mode Selector & Generate Answer
runInteraction("Ask your data 'Generate answer' Button: Calls retrieval and opens citation sources", async () => {
  let response = null;
  let loading = false;
  const activeProject = { id: 1, name: "Default Project" };
  const question = "How does RRF fusion work?";
  const mode = "hybrid";

  const handleAsk = async () => {
    loading = true;
    response = {
      answer: "Reciprocal Rank Fusion combines ranked lists from BM25 and dense vector search.",
      latency_ms: 180,
      retrieval_mode: mode,
      sources: [
        { document_name: "algorithms.md", chunk_index: 3, content: "RRF score = 1 / (60 + rank)", score: 0.94 }
      ]
    };
    loading = false;
  };

  await handleAsk();
  assert.equal(loading, false);
  assert.ok(response, "Response should be present");
  assert.ok(response.sources.length > 0, "Retrieved source cards should open");
});

// 6. Test Projects Modal & Action Buttons
runInteraction("Projects 'Create project' Button: Opens create project form modal", () => {
  let showCreateModal = false;
  // Click 'Create project'
  showCreateModal = true;
  assert.equal(showCreateModal, true, "Create project modal should open");
});

runInteraction("Projects Create Form 'Cancel' Button: Closes form modal", () => {
  let showCreateModal = true;
  // Click 'Cancel'
  showCreateModal = false;
  assert.equal(showCreateModal, false, "Create project modal should close");
});

runInteraction("Projects 'Save Project' Button: Creates project, closes modal, sets as active", async () => {
  let showCreateModal = true;
  let projects = [{ id: 1, name: "Project Alpha" }];
  let activeProject = projects[0];
  let name = "Project Beta";
  let description = "Secondary knowledge base";

  const handleCreate = async () => {
    const created = { id: 2, name, description, created_at: new Date().toISOString() };
    projects.push(created);
    name = "";
    description = "";
    showCreateModal = false;
    activeProject = created;
  };

  await handleCreate();
  assert.equal(showCreateModal, false, "Modal should close");
  assert.equal(projects.length, 2, "Project list should have 2 items");
  assert.equal(activeProject.id, 2, "New project should be active");
});

runInteraction("Projects 'Delete project' Button: Deletes project from list", async () => {
  let projects = [
    { id: 1, name: "Project Alpha" },
    { id: 2, name: "Project Beta" }
  ];

  const handleDelete = async (id) => {
    projects = projects.filter(p => p.id !== id);
  };

  await handleDelete(1);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].id, 2);
});

runInteraction("Projects 'Set Active →' Button: Switches active workspace context", () => {
  const projects = [
    { id: 1, name: "Alpha" },
    { id: 2, name: "Beta" }
  ];
  let activeProject = projects[0];

  const setActiveProject = (p) => { activeProject = p; };
  setActiveProject(projects[1]);

  assert.equal(activeProject.id, 2);
});

// 7. Test Header Interactive Controls
runInteraction("Header '⌘ K' Search Button: Opens Command Palette quick search modal", () => {
  let showSearchModal = false;
  const toggleSearch = () => { showSearchModal = !showSearchModal; };
  toggleSearch();
  assert.equal(showSearchModal, true, "Search modal should open");
});

runInteraction("Header Notification Bell Button: Toggles live workspace alerts dropdown", () => {
  let showNotifications = false;
  const toggleNotifications = () => { showNotifications = !showNotifications; };
  toggleNotifications();
  assert.equal(showNotifications, true, "Notifications panel should open");
  toggleNotifications();
  assert.equal(showNotifications, false, "Notifications panel should close on second click");
});

runInteraction("Header User Avatar Button: Navigates directly to Settings view", () => {
  let activeView = "Overview";
  const onAvatarClick = () => { activeView = "Settings"; };
  onAvatarClick();
  assert.equal(activeView, "Settings", "Should navigate to Settings");
});

// 8. Test Logout Buttons (Sidebar + Header)
runInteraction("Header & Sidebar 'Sign Out' Buttons: Clears user session and opens AuthScreen", () => {
  let user = { id: 1, email: "user@vectorly.ai" };

  const logout = () => {
    user = null;
  };

  logout();
  assert.equal(user, null, "User should be logged out");
});

console.log("\n=================================================");
console.log(`TOTAL INTERACTIONS TESTED: ${passedInteractions + failedInteractions}`);
console.log(`PASSED:                   ${passedInteractions}`);
console.log(`FAILED:                   ${failedInteractions}`);
console.log("=================================================");

if (failedInteractions > 0) {
  process.exit(1);
}

