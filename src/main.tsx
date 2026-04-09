import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 1. ADD THESE IMPORTS
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

// 2. CONFIGURE AMPLIFY
Amplify.configure(outputs);

createRoot(document.getElementById("root")!).render(<App />);