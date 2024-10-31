import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/home/Home";
import Patterns from "./pages/pattern/Patterns";
import Designers from "./pages/designer/Designers";
import Contribute from "./pages/contribute/Contribute";
import Layout from "./pages/Layout";
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/patterns"element={<Patterns />} />
          <Route path="/designers"element={<Designers />} />
          <Route path="/contribute"element={<Contribute />} />
          </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;