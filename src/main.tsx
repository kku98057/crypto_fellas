import { createRoot } from "react-dom/client";
import "./reset.scss";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
  </>
);
