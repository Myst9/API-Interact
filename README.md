# API-Interact

## Installation:
### Step 1: Clone the repo:
 ```bash
git clone https://github.com/Myst9/API-Interact.git
```
### Step 2: Provide the GitHub Personal Token for rate limit extension
1. Create your [personalized fine-grained github token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token). (Leave permissions as default)
2. In `background.js` file, paste the token on line number 3
   
   ```JavaScript
   GITHUB_TOKEN: "your token here" 
   ```   
   
### Step 3: Open Chrome Extensions manager
1. Open Google Chrome 
2. Navigate to the `chrome://extensions` page


### Step 4: Enable Developer Mode
Toggle the *Developer Mode* switch in the top right corner to enable it.

### Step 5: Start the Backend Server
1. Navigate to the backend folder in the cloned repository. Run the following commands:
   
   ```bash
   pip install -r requirements.txt
   python server.py
   ```

### Step 6: Load the extension
1. Click the *Load Unpacked* button
2. When prompted, select the folder where the repository was cloned
3. Click on the pin icon to pin the extension to your browser's toolbar

### Step 7: 
1. Go to any PyTorch documentation page to try the tool
   
   https://pytorch.org/docs/stable/generated/torch.add.html
