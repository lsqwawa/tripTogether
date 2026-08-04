import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useUserStore } from "./stores/userStore";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import CreateTrip from "./pages/CreateTrip";
import TripDetail from "./pages/TripDetail";
import JoinTrip from "./pages/JoinTrip";
import Guide from "./pages/Guide";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ShareTrip from "./pages/ShareTrip";

export default function App() {
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/trips/new" element={<CreateTrip />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
        <Route path="/join" element={<JoinTrip />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/share/:inviteCode" element={<ShareTrip />} />
      </Route>
    </Routes>
  );
}
