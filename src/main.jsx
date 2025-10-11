import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Intro from "./pages/Intro.jsx";
import "./app.css";

function Root() {
  const [visitorName, setVisitorName] = React.useState("");

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Intro onStart={(name) => setVisitorName(name)} />}
        />
        <Route path="/museum" element={<App initialName={visitorName} />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
