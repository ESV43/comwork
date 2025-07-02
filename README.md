# AI Comic Creator

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up your API Key:**
    You can provide your Gemini API key in one of two ways:
    *   **Environment Variable (recommended for local development):**
        Create a file named `.env` in the root of the project and add your API key:
        ```
        GEMINI_API_KEY="YOUR_API_KEY_HERE"
        ```
        The app will automatically load this key when you start it.
    *   **In-App Input:**
        If you don't set the environment variable, you can enter your API key directly in the application's configuration screen when you run it.

3.  **Run the app:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173` (or another port if 5173 is in use).
