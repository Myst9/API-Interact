const CONFIG = {
    BACKEND_URL: "http://127.0.0.1:5000",
    GITHUB_TOKEN: "your token here" 
};

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var url = tabs[0].url;
            if (isPyTorchDocumentation(url)) {
                chrome.tabs.sendMessage(tabId, { message: 'pytorch_doc_url', url: url, backendUrl: CONFIG.BACKEND_URL, githubToken: CONFIG.GITHUB_TOKEN});
            }
        });
    }
});

function isPyTorchDocumentation(url) {
    // Logic to check if the URL belongs to PyTorch documentation
    return /^https:\/\/pytorch\.org\/docs\/.*$/.test(url);
}
