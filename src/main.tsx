// 1. IMPORT AND CONFIGURE AMPLIFY FIRST
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
Amplify.configure(outputs);

// 2. THEN IMPORT REACT AND YOUR APP
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 3. RENDER
createRoot(document.getElementById("root")!).render(<App />);