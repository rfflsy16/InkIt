import { createBrowserRouter, redirect } from "react-router-dom";
import HomePage from "../views/HomePage";
import DrawingPage from "../views/DrawingPage";
import TypingPage from "../views/TypingPage";

const base_url = "https://server-inkit.rafflesy.site";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage base_url={base_url} />,
  },
  {
    path: "/drawing-game",
    element: <DrawingPage base_url={base_url} />,
  },
  {
    path: "/typing-game",
    element: <TypingPage base_url={base_url} />,
  },
]);

export default router;
