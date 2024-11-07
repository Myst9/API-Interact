parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === "function" && parcelRequire;
  var nodeRequire = typeof require === "function" && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        var currentRequire =
          typeof parcelRequire === "function" && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        if (previousRequire) {
          return previousRequire(name, true);
        }

        if (nodeRequire && typeof name === "string") {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = "MODULE_NOT_FOUND";
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x) {
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    var mainExports = newRequire(entry[entry.length - 1]);

    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;
    } else if (typeof define === "function" && define.amd) {
      define(function () {
        return mainExports;
      });
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  parcelRequire = newRequire;

  if (error) {
    throw error;
  }

  return newRequire;
})(
  {
    "sotagger.js": [
      function (require, module, exports) {

        async function get_url_s() {
          chrome.runtime.onMessage.addListener(async function (message, sender, sendResponse) {
            console.log("Message received in content script:", message);

            if (message.url.startsWith("https://pytorch.org/docs/")) {
              console.log("yes it is pytorch");
              let backend_url = message.backendUrl;
              let github_token = message.githubToken;

              const codeCells = [];
              let i = 0;
              let codeCell;

              const loadCodeMirror = () => {
                return new Promise((resolve) => {
                  const cssLink = document.createElement("link");
                  cssLink.rel = "stylesheet";
                  cssLink.href = chrome.runtime.getURL("lib/codemirror.css");
                  document.head.appendChild(cssLink);

                  const script = document.createElement("script");
                  script.src = chrome.runtime.getURL("lib/codemirror.js");
                  script.onload = () => {
                    const pythonModeScript = document.createElement("script");
                    pythonModeScript.src = chrome.runtime.getURL("lib/mode/python/python.js");
                    pythonModeScript.onload = () => {
                      resolve();
                    };
                    document.head.appendChild(pythonModeScript);
                  };
                  document.head.appendChild(script);
                });
              };

              const urlSegments = message.url.split("/");
              const lastSegment = urlSegments[urlSegments.length - 1].split("#")[0];
              const term = lastSegment.replace('.html', '');
              console.log(term);

              async function fetchGithubExamples(query) {
                const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}+language:python+in:file&per_page=10`;

                try {
                  const response = await fetch(url, {
                    headers: {
                      'Accept': 'application/vnd.github.v3+json',
                      'Authorization': `Bearer ${github_token}`
                    }
                  });

                  const result = await response.json();

                  const examples = await Promise.all(result.items.map(async (item) => {
                    const fileContent = await fetchRawGithubFile(item.repository.full_name, item.path);
                    const repoDetails = await fetchRepoDetails(item.repository.full_name);

                    // Prepend repo details as a comment to the code
                    const modifiedContent = `
# Repository: https://github.com/${item.repository.full_name}
# ⭐ Stars: ${repoDetails.stars}
# 🍴 Forks: ${repoDetails.forks}
# File: ${item.path}

${fileContent}`;

                    return {
                      repoName: item.repository.full_name,
                      filePath: item.path,
                      htmlUrl: item.html_url,
                      fileContent: modifiedContent
                    };
                  }));

                  return examples;

                } catch (error) {
                  console.error("Error fetching GitHub examples:", error);
                  return [];
                }
              }

              async function fetchRawGithubFile(repoFullName, filePath) {
                const defaultBranch = await getDefaultBranch(repoFullName);
                if (!defaultBranch) {
                  console.error("Default branch not found");
                } else {
                  const url = `https://raw.githubusercontent.com/${repoFullName}/${defaultBranch}/${filePath}`;

                  try {
                    const response = await fetch(url);

                    if (!response.ok) {
                      throw new Error(`Error fetching file: ${response.status} ${response.statusText}`);
                    }

                    const fileContent = await response.text();

                    return fileContent;

                  } catch (error) {
                    console.error("Error fetching raw GitHub file:", error);
                    return null;
                  }
                }
              }

              // Fetch repository stars and forks
              async function fetchRepoDetails(repoFullName) {
                const url = `https://api.github.com/repos/${repoFullName}`;

                try {
                  const response = await fetch(url, {
                    headers: {
                      'Accept': 'application/vnd.github.v3+json',
                      'Authorization': `Bearer ${github_token}`
                    }
                  });

                  if (!response.ok) {
                    throw new Error(`Error fetching repository: ${response.status} ${response.statusText}`);
                  }

                  const repoData = await response.json();
                  return {
                    stars: repoData.stargazers_count,
                    forks: repoData.forks_count
                  };

                } catch (error) {
                  console.error("Error fetching repository details:", error);
                  return { stars: 0, forks: 0 };
                }
              }

              async function getDefaultBranch(repoFullName) {
                const url = `https://api.github.com/repos/${repoFullName}`;

                try {
                  const response = await fetch(url, {
                    headers: {
                      'Accept': 'application/vnd.github.v3+json',
                      'Authorization': `Bearer ${github_token}`
                    }
                  });

                  if (!response.ok) {
                    throw new Error(`Error fetching repository: ${response.status} ${response.statusText}`);
                  }

                  const repoData = await response.json();
                  return repoData.default_branch; // Returns the default branch name (main or master)

                } catch (error) {
                  console.error("Error fetching default branch:", error);
                  return null;
                }
              }

              let currentExampleIndex = 0; 
              let examples = []; // Array to store fetched examples

              await loadCodeMirror();

              while ((codeCell = document.getElementById(`codecell${i}`)) !== null) {
                let codeContent;

                if (codeCell.hasAttribute("data-original-code")) {
                  // If the attribute exists, get the code from it
                  codeContent = codeCell.getAttribute("data-original-code");
                } else {
                  // Otherwise, fall back to using innerText
                  codeContent = codeCell.innerText;
                }
                codeCells.push(codeContent);

                const originalCodeContent = codeContent;

                // Check if '>>>' exists in the code
                const hasTripleGreaterThan = codeContent.includes(">>>");

                codeContent = codeContent
                  .split("\n")
                  .filter((line) => {
                    // If '>>>' is present, filter out lines that don't start with '>>>', '...', or '#'
                    if (hasTripleGreaterThan) {
                      return line.startsWith(">>>") || line.startsWith("...") || line.startsWith("#");
                    }
                    // Otherwise, keep all lines
                    return true;
                  })
                  .map((line) => {
                    // Remove leading >>> or ... while preserving indentation
                    if (line.startsWith(">>>")) {
                      return line.slice(4); // Remove '>>>'
                    } else if (line.startsWith("...")) {
                      return line.slice(3); // Remove '...'
                    } else {
                      return line;
                    }
                  })
                  .join("\n");

                const processedCodeContent = codeContent;

                //console.log(codeContent);

                // Select all copy buttons
                const copyButtons = document.getElementsByClassName('copybtn o-tooltip--left');

                // Loop through each copy button and add an event listener
                Array.from(copyButtons).forEach((button, index) => {
                  button.addEventListener('click', () => {
                    // Find the corresponding code cell 
                    const codeCell = document.getElementById(`codecell${index}`);
                    if (codeCell) {
                      // Find the CodeMirror instance associated with this code cell
                      const codeMirrorInstance = codeCell.querySelector('.CodeMirror').CodeMirror;
                      if (codeMirrorInstance) {
                        const code = codeMirrorInstance.getValue();
                        //console.log("Code to copy:", code);
                        navigator.clipboard.writeText(code);
                      }
                    }
                  });
                });

                const textArea = document.createElement("textarea");
                textArea.value = codeContent; // Set initial value to processed code

                const codeContainer = document.createElement("div");
                codeContainer.style.position = "relative";

                codeCell.innerHTML = "";
                codeContainer.appendChild(textArea);
                codeCell.appendChild(codeContainer);

                const codeMirrorInstance = CodeMirror.fromTextArea(textArea, {
                  mode: "text/x-python",
                  lineNumbers: true,
                  theme: "default",
                  extraKeys: {
                    "Ctrl-C": false,
                    "Cmd-C": false
                  }
                });

                const linkOverlay = {
                  token: function (stream) {
                    const urlPattern = /https?:\/\/[^\s)]+/; // Match URLs
                    const match = stream.match(urlPattern, false);

                    if (match) {
                      stream.match(urlPattern);
                      return "link";
                    } else {
                      stream.next();
                      return null;
                    }
                  }
                };

                const st = document.createElement('style');
                const css = `
  .cm-link {
    color: blue;
    text-decoration: underline;
    cursor: pointer;
  }
`;
                if (st.styleSheet) {
                  st.styleSheet.cssText = css;
                } else {
                  st.appendChild(document.createTextNode(css));
                }
                document.head.appendChild(st);

                // Apply the overlay to CodeMirror
                codeMirrorInstance.addOverlay(linkOverlay);

                // Add event listener to handle clicks inside the CodeMirror editor
                codeMirrorInstance.getWrapperElement().addEventListener("click", (event) => {
                  const target = event.target;
                  if (target.classList.contains("cm-link")) {
                    const url = target.textContent.match(/(https?:\/\/[^\s)]+)/)[0];
                    if (url) {
                      window.open(url, "_blank");
                    }
                  }
                });

                const fontAwesomeLink = document.createElement("link");
                fontAwesomeLink.rel = "stylesheet";
                fontAwesomeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css";
                document.head.appendChild(fontAwesomeLink);

                const runButton = document.createElement("button");
                runButton.innerHTML = '<i class="fas fa-play"></i>';
                runButton.title = "Run API Code";
                runButton.style.position = "absolute";
                runButton.style.top = "10px";
                runButton.style.right = "20px";

                runButton.style.padding = "8px";
                runButton.style.backgroundColor = "#b03a52";
                runButton.style.color = "white";
                runButton.style.border = "none";
                runButton.style.borderRadius = "5px";
                runButton.style.cursor = "pointer";
                runButton.style.transition = "background-color 0.3s";

                // Add hover effect
                runButton.onmouseover = function () {
                  runButton.style.backgroundColor = "#de8e9e";
                };
                runButton.onmouseout = function () {
                  runButton.style.backgroundColor = "#b03a52";
                };
                codeContainer.appendChild(runButton);

                // Create a container for the buttons
                const buttonContainer = document.createElement("div");
                buttonContainer.style.display = "flex";
                buttonContainer.style.justifyContent = "space-between";
                buttonContainer.style.alignItems = "center";
                buttonContainer.style.marginTop = "10px";
                buttonContainer.style.position = "relative";

                // Previous button
                const previousButton = document.createElement("button");
                previousButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
                previousButton.style.padding = "10px 15px";
                previousButton.title = "Previous";
                previousButton.style.border = "none";
                previousButton.style.borderRadius = "5px";
                previousButton.style.backgroundColor = "#4CAF50";
                previousButton.style.color = "white";
                previousButton.disabled = true;
                previousButton.style.opacity = "0.5";
                previousButton.style.cursor = "not-allowed";
                buttonContainer.appendChild(previousButton);

                // Exercise button
                const exerciseButton = document.createElement("button");
                exerciseButton.innerText = "Exercise";
                exerciseButton.style.padding = "10px 15px";
                exerciseButton.style.border = "none";
                exerciseButton.style.borderRadius = "5px";
                exerciseButton.style.backgroundColor = "#4CAF50";
                exerciseButton.style.color = "white";
                buttonContainer.appendChild(exerciseButton);

                // Answer button
                const answerButton = document.createElement("button");
                answerButton.innerText = "Solution";
                answerButton.style.padding = "10px 15px";
                answerButton.style.border = "none";
                answerButton.style.borderRadius = "5px";
                answerButton.style.backgroundColor = "#4CAF50";
                answerButton.style.color = "white";
                buttonContainer.appendChild(answerButton);

                // Next button
                const nextButton = document.createElement("button");
                nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
                nextButton.style.padding = "10px 15px";
                nextButton.title = "Next";
                nextButton.style.border = "none";
                nextButton.style.borderRadius = "5px";
                nextButton.style.backgroundColor = "#4CAF50";
                nextButton.style.color = "white";
                nextButton.disabled = true;
                nextButton.style.opacity = "0.5";
                nextButton.style.cursor = "not-allowed";
                buttonContainer.appendChild(nextButton);

                codeContainer.appendChild(buttonContainer);

                // Output box
                const outputBox = document.createElement("pre");
                outputBox.style.border = "1px solid #ccc";
                outputBox.style.borderRadius = "8px";
                outputBox.style.padding = "10px";
                outputBox.style.marginTop = "10px";
                outputBox.style.backgroundColor = "#f9f9f9";
                outputBox.style.color = "#333";
                outputBox.style.fontFamily = "'Courier New', Courier, monospace";
                outputBox.style.whiteSpace = "pre-wrap";
                outputBox.style.overflowX = "auto";
                outputBox.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                outputBox.style.maxHeight = "300px";
                outputBox.style.overflowY = "auto";
                codeContainer.appendChild(outputBox);


                // Load Example from GitHub button
                const loadExampleButton = document.createElement("button");
                loadExampleButton.style.display = "flex";
                loadExampleButton.style.alignItems = "center";
                loadExampleButton.style.padding = "10px 15px";
                loadExampleButton.style.marginTop = "10px";
                loadExampleButton.style.marginLeft = "10px";
                loadExampleButton.style.border = "none";
                loadExampleButton.style.borderRadius = "5px";
                loadExampleButton.style.backgroundColor = "#24292e";
                loadExampleButton.style.color = "white";
                loadExampleButton.style.cursor = "pointer";
                loadExampleButton.style.transition = "background-color 0.3s";

                // Replace the existing Load Example button creation with this new View Examples button
                const viewExamplesButton = document.createElement("button");
                viewExamplesButton.style.display = "flex";
                viewExamplesButton.style.alignItems = "center";
                viewExamplesButton.style.padding = "10px 15px";
                viewExamplesButton.style.marginTop = "10px";
                viewExamplesButton.style.marginLeft = "10px";
                viewExamplesButton.style.border = "none";
                viewExamplesButton.style.borderRadius = "5px";
                viewExamplesButton.style.backgroundColor = "#24292e";
                viewExamplesButton.style.color = "white";
                viewExamplesButton.style.cursor = "pointer";
                viewExamplesButton.style.transition = "background-color 0.3s";

                // GitHub icon
                const githubIcon = document.createElement("i");
                githubIcon.className = "fab fa-github";
                githubIcon.style.marginRight = "8px";
                viewExamplesButton.appendChild(githubIcon);

                // Button text
                viewExamplesButton.appendChild(document.createTextNode("View Examples from GitHub"));

                // Add hover effect
                viewExamplesButton.onmouseover = function () {
                  viewExamplesButton.style.backgroundColor = "#1c1e22";
                };
                viewExamplesButton.onmouseout = function () {
                  viewExamplesButton.style.backgroundColor = "#24292e";
                };

                codeContainer.appendChild(viewExamplesButton);

                // Create examples list container (hidden by default)
                const examplesListContainer = document.createElement("div");
                examplesListContainer.style.display = "none";
                examplesListContainer.style.marginTop = "10px";
                examplesListContainer.style.padding = "10px";
                examplesListContainer.style.border = "1px solid #e1e4e8";
                examplesListContainer.style.borderRadius = "6px";
                examplesListContainer.style.backgroundColor = "#f6f8fa";
                examplesListContainer.style.maxHeight = "300px";
                examplesListContainer.style.overflowY = "auto";
                codeContainer.appendChild(examplesListContainer);

                // Function to create example list item
                function createExampleListItem(example, index) {
                  const listItem = document.createElement("div");
                  listItem.style.display = "flex";
                  listItem.style.justifyContent = "space-between";
                  listItem.style.alignItems = "center";
                  listItem.style.padding = "8px";
                  listItem.style.borderBottom = "1px solid #e1e4e8";
                  listItem.style.transition = "background-color 0.2s";

                  // Repository link and info container
                  const linkContainer = document.createElement("div");
                  linkContainer.style.flex = "1";
                  linkContainer.style.display = "flex";
                  linkContainer.style.flexDirection = "column";

                  // Top row with repo link and stats
                  const topRow = document.createElement("div");
                  topRow.style.display = "flex";
                  topRow.style.alignItems = "center";

                  const repoLink = document.createElement("a");
                  repoLink.href = `https://github.com/${example.repoName}`;
                  repoLink.target = "_blank";
                  repoLink.style.color = "#0366d6";
                  repoLink.style.textDecoration = "none";
                  repoLink.style.fontWeight = "500";
                  repoLink.textContent = example.repoName;

                  // Stats container
                  const statsContainer = document.createElement("div");
                  statsContainer.style.display = "flex";
                  statsContainer.style.alignItems = "center";
                  statsContainer.style.marginLeft = "15px";
                  statsContainer.style.color = "#586069";
                  statsContainer.style.fontSize = "0.9em";

                  // Stars
                  const starsSpan = document.createElement("span");
                  starsSpan.style.display = "flex";
                  starsSpan.style.alignItems = "center";
                  starsSpan.style.marginRight = "15px";
                  const starIcon = document.createElement("i");
                  starIcon.className = "fas fa-star";
                  starIcon.style.marginRight = "4px";
                  starIcon.style.color = "#f1e05a";
                  starsSpan.appendChild(starIcon);
                  starsSpan.appendChild(document.createTextNode(example.fileContent.match(/# ⭐ Stars: (\d+)/)?.[1] || "0"));

                  // Forks
                  const forksSpan = document.createElement("span");
                  forksSpan.style.display = "flex";
                  forksSpan.style.alignItems = "center";
                  const forkIcon = document.createElement("i");
                  forkIcon.className = "fas fa-code-branch";
                  forkIcon.style.marginRight = "4px";
                  forkIcon.style.color = "#586069";
                  forksSpan.appendChild(forkIcon);
                  forksSpan.appendChild(document.createTextNode(example.fileContent.match(/# 🍴 Forks: (\d+)/)?.[1] || "0"));

                  statsContainer.appendChild(starsSpan);
                  statsContainer.appendChild(forksSpan);

                  topRow.appendChild(repoLink);
                  topRow.appendChild(statsContainer);

                  // File path in bottom row
                  const fileInfo = document.createElement("span");
                  fileInfo.style.color = "#586069";
                  fileInfo.style.fontSize = "0.9em";
                  fileInfo.style.marginTop = "4px";
                  fileInfo.textContent = `/${example.filePath}`;

                  linkContainer.appendChild(topRow);
                  linkContainer.appendChild(fileInfo);

                  // Load button
                  const loadButton = document.createElement("button");
                  loadButton.innerHTML = '<i class="fas fa-upload"></i>';
                  loadButton.title = "Load this example";
                  loadButton.style.padding = "4px 8px";
                  loadButton.style.marginLeft = "10px";
                  loadButton.style.backgroundColor = "#28a745";
                  loadButton.style.color = "white";
                  loadButton.style.border = "none";
                  loadButton.style.borderRadius = "3px";
                  loadButton.style.cursor = "pointer";
                  loadButton.style.transition = "background-color 0.2s";

                  loadButton.onmouseover = function () {
                    loadButton.style.backgroundColor = "#22863a";
                  };
                  loadButton.onmouseout = function () {
                    loadButton.style.backgroundColor = "#28a745";
                  };

                  loadButton.addEventListener("click", () => {
                    codeMirrorInstance.setValue(example.fileContent);
                    highlightSearchTerm(example.fileContent, term);
                    const originalColor = loadButton.style.backgroundColor;
                    loadButton.style.backgroundColor = "#2ea043";
                    loadButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                      loadButton.style.backgroundColor = originalColor;
                      loadButton.innerHTML = '<i class="fas fa-upload"></i>';
                    }, 1000);
                  });

                  listItem.appendChild(linkContainer);
                  listItem.appendChild(loadButton);

                  listItem.onmouseover = function () {
                    listItem.style.backgroundColor = "#f1f1f1";
                  };
                  listItem.onmouseout = function () {
                    listItem.style.backgroundColor = "transparent";
                  };

                  return listItem;
                }

                viewExamplesButton.addEventListener("click", async () => {
                  // Toggle the display of examples list
                  if (examplesListContainer.style.display === "none") {
                    // Only fetch examples if we haven't already
                    if (!examples.length) {
                      examples = await fetchGithubExamples(term);
                    }

                    // Clear previous examples
                    examplesListContainer.innerHTML = "";

                    if (examples.length > 0) {
                      examples.forEach((example, index) => {
                        const listItem = createExampleListItem(example, index);
                        examplesListContainer.appendChild(listItem);
                      });
                    } else {
                      const noExamplesMsg = document.createElement("div");
                      noExamplesMsg.style.padding = "10px";
                      noExamplesMsg.style.color = "#586069";
                      noExamplesMsg.textContent = "No examples found on GitHub.";
                      examplesListContainer.appendChild(noExamplesMsg);
                    }

                    examplesListContainer.style.display = "block";
                    viewExamplesButton.innerHTML = '<i class="fab fa-github"></i> Hide Examples';
                  } else {
                    examplesListContainer.style.display = "none";
                    viewExamplesButton.innerHTML = '<i class="fab fa-github"></i> View Examples from GitHub';
                  }
                });

                const reloadButton = document.createElement("button");
                reloadButton.innerHTML = '<i class="fas fa-sync-alt"></i>';
                reloadButton.title = "Reload Original Code";
                reloadButton.style.position = "absolute";
                reloadButton.style.top = "50px";
                reloadButton.style.right = "20px";
                reloadButton.style.padding = "8px";
                reloadButton.style.backgroundColor = "#007bff";
                reloadButton.style.color = "white";
                reloadButton.style.border = "none";
                reloadButton.style.borderRadius = "5px";
                reloadButton.style.cursor = "pointer";
                reloadButton.style.transition = "background-color 0.3s";

                // Add hover effect
                reloadButton.onmouseover = function () {
                  reloadButton.style.backgroundColor = "#0056b3";
                };
                reloadButton.onmouseout = function () {
                  reloadButton.style.backgroundColor = "#007bff";
                };
                codeContainer.appendChild(reloadButton);

                // Add event listener for Reload button
                reloadButton.addEventListener("click", () => {
                  codeMirrorInstance.setValue(processedCodeContent); // Reset CodeMirror to original code
                  // Remove exercise counter if it exists
                  const exerciseCounter = codeContainer.querySelector('.exercise-counter');
                  if (exerciseCounter) {
                    exerciseCounter.remove();
                  }
                  nextButton.disabled = true;
                  nextButton.style.opacity = "0.5";
                  nextButton.style.cursor = "not-allowed";

                  previousButton.disabled = true;
                  previousButton.style.opacity = "0.5";
                  previousButton.style.cursor = "not-allowed";
                });

                // Function to highlight search term in CodeMirror
                function highlightSearchTerm(content, searchTerm) {
                  const cm = codeMirrorInstance;
                  const text = cm.getValue();

                  console.log(text);

                  // Clear previous highlights
                  cm.getAllMarks().forEach(mark => mark.clear());

                  let startIndex = 0;
                  const regex = new RegExp(searchTerm, "gi"); // Create case insensitive regex for search term

                  while ((match = regex.exec(text)) !== null) {
                    const from = cm.posFromIndex(match.index);
                    const to = cm.posFromIndex(match.index + searchTerm.length);
                    cm.markText(from, to, { className: "highlight-search-term" });
                    startIndex += searchTerm.length;
                  }
                }

                //CSS for highlighting the search term in the document
                const searchTermStyle = document.createElement('style');
                searchTermStyle.innerHTML = `
  .highlight-search-term {
    background-color: #f5d76e; /* Highlight color for search term */
  }
`;
                document.head.appendChild(searchTermStyle);

                // Add event listener for Run button
                runButton.addEventListener("click", async () => {
                  let code = codeMirrorInstance.getValue();

                  outputBox.textContent = ""; // Clear previous output

                  try {
                    const response = await fetch(`${backend_url}/execute`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ code }),
                    });
                    const result = await response.json();
                    console.log("Execution result:", result);

                    // Display error or output
                    if (result.error && result.error.trim() !== "") {
                      outputBox.textContent = "Error: " + result.error;
                    } else if (result.output && result.output.trim() !== "") {
                      outputBox.textContent = "Output: " + result.output;
                    } else {
                      outputBox.textContent = "Executed successfully";
                    }
                  } catch (error) {
                    console.error("Error executing code:", error);
                    outputBox.textContent = "Error: " + error.message;
                  }
                });

                let currentExerciseIndex = 0;
                let correctAnswers = [];
                let exercises = []; // Store exercises fetched from the backend

                // Add event listener for Exercise button
                exerciseButton.addEventListener("click", async () => {
                  outputBox.textContent = ""; // Clear previous output

                  let exerciseResponse = await fetch(`${backend_url}/generate_exercise`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: processedCodeContent }),
                  }).then((response) => response.json());

                  console.log(exerciseResponse);
                  exercises = exerciseResponse.exercises;

                  if (exercises.length > 0) {
                    currentExerciseIndex = 0;
                    displayExercise(exercises[currentExerciseIndex]);

                    // Initialize button states
                    previousButton.disabled = true;
                    previousButton.style.opacity = "0.5";
                    previousButton.style.cursor = "not-allowed";

                    // Only enable next button if there are more exercises
                    nextButton.disabled = exercises.length <= 1;
                    nextButton.style.opacity = exercises.length <= 1 ? "0.5" : "1";
                    nextButton.style.cursor = exercises.length <= 1 ? "not-allowed" : "pointer";
                  } else {
                    outputBox.textContent = "No exercises available.";

                    // Remove exercise counter if it exists
                    const exerciseCounter = codeContainer.querySelector('.exercise-counter');
                    if (exerciseCounter) {
                      exerciseCounter.remove();
                    }

                    // Disable both buttons if no exercises
                    previousButton.disabled = true;
                    previousButton.style.opacity = "0.5";
                    previousButton.style.cursor = "not-allowed";
                    nextButton.disabled = true;
                    nextButton.style.opacity = "0.5";
                    nextButton.style.cursor = "not-allowed";
                  }
                });

                // Function to display exercises
                function displayExercise(exercise) {
                  correctAnswers = exercise.correctAnswers;

                  let modifiedCodeWithInputs = exercise.modifiedCode;

                  // Create exercise counter text
                  const exerciseCounterText = `Exercise ${currentExerciseIndex + 1}/${exercises.length}`;

                  // Create or update exercise counter display
                  let exerciseCounter = codeContainer.querySelector('.exercise-counter');
                  if (!exerciseCounter) {
                    exerciseCounter = document.createElement('div');
                    exerciseCounter.className = 'exercise-counter';
                    exerciseCounter.style.marginBottom = '10px';
                    exerciseCounter.style.fontSize = '1.1em';
                    exerciseCounter.style.fontWeight = 'bold';
                    exerciseCounter.style.color = '#4CAF50';
                    // Insert counter before the CodeMirror editor
                    codeMirrorInstance.getWrapperElement().parentNode.insertBefore(exerciseCounter, codeMirrorInstance.getWrapperElement());
                  }
                  exerciseCounter.textContent = exerciseCounterText;

                  // Loop through correctAnswers and replace each corresponding blank
                  correctAnswers.forEach((_, index) => {
                    let blankPlaceholder = `__BLANK${index + 1}__`;
                    modifiedCodeWithInputs = modifiedCodeWithInputs.replace(
                      blankPlaceholder,
                      `__BLANK${index + 1}__`
                    );
                  });

                  // Set the modified code into CodeMirror
                  codeMirrorInstance.setValue(modifiedCodeWithInputs);

                  highlightBlanks(correctAnswers.length);
                }

                // Function to highlight blanks
                function highlightBlanks(numberOfBlanks) {
                  const cm = codeMirrorInstance;
                  const text = cm.getValue();

                  // Clear previous highlights
                  cm.getAllMarks().forEach(mark => mark.clear());

                  for (let i = 0; i < numberOfBlanks; i++) {
                    const blankPlaceholder = `__BLANK${i + 1}__`;
                    let startIndex = 0;

                    while ((startIndex = text.indexOf(blankPlaceholder, startIndex)) !== -1) {
                      const from = cm.posFromIndex(startIndex);
                      const to = cm.posFromIndex(startIndex + blankPlaceholder.length);
                      cm.markText(from, to, { className: "highlight" });
                      startIndex += blankPlaceholder.length;
                    }
                  }
                }

                const style = document.createElement('style');
                style.innerHTML = `
  .highlight {
    background-color: #c3e6ae;
  }
`;
                document.head.appendChild(style);

                // Add event listener for Next button
                nextButton.addEventListener("click", () => {
                  if (exercises.length > 0 && currentExerciseIndex < exercises.length - 1) {
                    currentExerciseIndex++;
                    displayExercise(exercises[currentExerciseIndex]);

                    // Update button states
                    previousButton.disabled = false;
                    previousButton.style.opacity = "1";
                    previousButton.style.cursor = "pointer";

                    // Disable next button if we're at the last exercise
                    if (currentExerciseIndex === exercises.length - 1) {
                      nextButton.disabled = true;
                      nextButton.style.opacity = "0.5";
                      nextButton.style.cursor = "not-allowed";
                    }
                  }
                });

                // Add event listener for Previous button
                previousButton.addEventListener("click", () => {
                  if (exercises.length > 0 && currentExerciseIndex > 0) {
                    currentExerciseIndex--;
                    displayExercise(exercises[currentExerciseIndex]);

                    // Update button states
                    nextButton.disabled = false;
                    nextButton.style.opacity = "1";
                    nextButton.style.cursor = "pointer";

                    // Disable previous button if we're at the first exercise
                    if (currentExerciseIndex === 0) {
                      previousButton.disabled = true;
                      previousButton.style.opacity = "0.5";
                      previousButton.style.cursor = "not-allowed";
                    }
                  }
                });


                // Add event listener for the Answer button
                answerButton.addEventListener("click", () => {
                  if (processedCodeContent) {
                    // Restore the original code into the CodeMirror instance
                    codeMirrorInstance.setValue(processedCodeContent);

                    // Highlight the correct answers
                    correctAnswers.forEach((answer, index) => {
                      const regex = new RegExp(answer, "g"); 

                      let match;
                      while ((match = regex.exec(processedCodeContent)) !== null) {
                        const from = codeMirrorInstance.posFromIndex(match.index);
                        const to = codeMirrorInstance.posFromIndex(match.index + answer.length);
                        codeMirrorInstance.markText(from, to, { className: "highlight" });
                      }
                    });
                  } else {
                    outputBox.textContent = "Original code content not available.";
                  }
                });
                i++; // Increment index for the next code cell
              }
            }
          });
        }


        $(document).ready(function () {
          get_url_s();
        });
      },
      {},
    ],
  },
  {},
  ["sotagger.js"],
  null
);
