import {BrowserRouter, Routes, Route, Link} from "react-router-dom"
import Predictions from "./pages/Predictions"
import BestXI from "./pages/BestXI"

export default function App() {
    return (
        <BrowserRouter>
          <nav className="p-4 flex gap-4 bg-gray-800 text-white">
            <Link to="/">Predictions</Link>
            <Link to="/bestxi">Best XI</Link>
          </nav>
          <Routes>
            <Route path="/" element={<Predictions />}/>
            <Route path="/bestxi" element={<BestXI />}/>
          </Routes>
        </BrowserRouter>
    );
}
