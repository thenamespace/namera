import ReactDOM from "react-dom/client";

import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "@/router";

import "@/styles.css";

const router = getRouter();
const root = document.getElementById("app");
if (!root) throw new Error("App root element not found");
ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
