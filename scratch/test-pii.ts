import { scanForPII } from "../src/server/api/routers/nimits-jarvis/agent/pii/pii-scanner";
const text = "My linkedin urn is urn:li:person:123456789";
console.log(scanForPII(text));
