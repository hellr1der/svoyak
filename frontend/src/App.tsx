import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Admin } from "./pages/Admin";
import { Display } from "./pages/Display";
import { Editor } from "./pages/Editor";
import { Player } from "./pages/Player";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/display" element={<Display />} />
        <Route path="/player" element={<Player />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
