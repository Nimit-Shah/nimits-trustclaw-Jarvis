import { scanForPII, extractStructuredPII } from "../src/server/api/routers/nimits-jarvis/agent/pii/pii-scanner";
const text = "Check out my profile at https://www.linkedin.com/in/jackson-407499275 for more info.";
const json = { vanityName: "jackson-407499275" };
console.log("Text Scan:", scanForPII(text));
console.log("JSON Extraction:", extractStructuredPII(json));
